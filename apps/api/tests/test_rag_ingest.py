"""R1: corpus front matter, structure-aware chunking, idempotent ingestion, staleness check."""

from __future__ import annotations

import datetime as dt
import shutil
from pathlib import Path

import pytest

from rag import CORPUS_DIR
from rag.chunking import estimate_tokens, split_sections, chunk_sections
from rag.embeddings import HashProvider
from rag.ingest import check, chunk_doc, ingest, is_stale, load_corpus, write_sources
from rag.schema import FrontMatter
from rag.store import FaissStore

GOOD = {
    "id": "test-doc",
    "title": "Test document",
    "topic": "transport",
    "source_url": "https://example.go.jp/page",
    "source_name": "Example Ministry",
    "source_type": "official-government",
    "language": "en",
    "fetched_on": "2026-10-24",
    "last_verified": "2026-10-24",
    "volatility": "slow-changing",
    "status": "needs-review",
    "licence_note": "Summary in our own words.",
}


def write_doc(folder: Path, name: str, meta: dict, body: str) -> Path:
    import yaml

    folder.mkdir(parents=True, exist_ok=True)
    path = folder / name
    path.write_text(f"---\n{yaml.safe_dump(meta, sort_keys=False)}---\n\n{body}\n", encoding="utf8")
    return path


# --- front matter --------------------------------------------------------------------------


def test_front_matter_accepts_a_complete_document():
    FrontMatter.model_validate(GOOD)


@pytest.mark.parametrize(
    "change, needle",
    [
        ({"topic": "shopping"}, "topic"),
        ({"source_type": "blog"}, "source_type"),
        ({"status": "approved"}, "status"),
        ({"volatility": "sometimes"}, "volatility"),
        ({"fetched_on": "yesterday"}, "fetched_on"),
        ({"id": "Not A Slug"}, "slug"),
        ({"source_url": None}, "https source_url"),
        ({"source_url": "http://insecure.example"}, "https source_url"),
        ({"source_type": "team-written", "status": "verified"}, "team-written"),
        ({"status": "verified", "last_verified": None}, "last_verified"),
        ({"surprise": "field"}, "surprise"),
    ],
)
def test_front_matter_rejects_bad_values(change, needle):
    with pytest.raises(Exception) as e:
        FrontMatter.model_validate({**GOOD, **change})
    assert needle in str(e.value)


def test_missing_field_is_reported_by_the_loader(tmp_path):
    meta = {k: v for k, v in GOOD.items() if k != "licence_note"}
    write_doc(tmp_path / "transport", "a.md", meta, "# Title\n\nBody text.")
    write_doc(tmp_path / "visa-entry", "b.md", GOOD, "# Title\n\nBody text.")  # wrong folder
    result = load_corpus(tmp_path)
    assert result.docs == []
    assert "licence_note" in result.errors["transport/a.md"]
    assert "does not match folder" in result.errors["visa-entry/b.md"]


def test_the_real_corpus_is_valid_and_honestly_labelled():
    result = load_corpus(CORPUS_DIR)
    assert result.errors == {}
    assert len(result.docs) >= 30
    topics = {d.meta.topic for d in result.docs}
    assert len(topics) == 11, "every topic folder has at least one document"
    for d in result.docs:
        m = d.meta
        # Nothing is verified until the owner checks it.
        assert m.status in {"needs-review", "sample"}, m.id
        if m.source_type == "team-written":
            assert m.source_url is None, m.id
        else:
            assert m.source_url and m.source_url.startswith("https://"), m.id
        if m.last_verified is None:
            assert m.status != "verified", m.id
    # Eval fixtures are present and clearly marked as samples.
    ids = {d.meta.id: d.meta for d in result.docs}
    assert ids["test-prompt-injection"].status == "sample"
    assert ids["test-stale-volatile"].volatility == "volatile"


# --- chunking -------------------------------------------------------------------------------

BODY = """# Title

Intro paragraph.

## Lost passport

### Steps

1. Report to police.
2. Contact the embassy.

## Phone numbers

Call 119 for an ambulance.
"""


def test_sections_keep_their_heading_path():
    secs = split_sections(BODY)
    assert [s.path for s in secs] == [[], ["Lost passport", "Steps"], ["Phone numbers"]]


def test_every_chunk_carries_title_and_section_path(tmp_path):
    write_doc(tmp_path / "transport", "a.md", GOOD, BODY)
    doc = load_corpus(tmp_path).docs[0]
    chunks = chunk_doc(doc)
    assert chunks
    for c in chunks:
        assert c.embedding_text().startswith("Test document")
    joined = "\n".join(c.text for c in chunks)
    # Headings survive inside packed chunks as labels.
    assert "[Lost passport > Steps]" in joined
    assert "[Phone numbers]" in joined


def test_long_sections_are_split_with_overlap_and_size_limits():
    para = " ".join(f"word{i}" for i in range(120))
    body = "# T\n\n## Long\n\n" + "\n\n".join(f"{para} p{n}." for n in range(8))
    chunks = chunk_sections(split_sections(body))
    assert len(chunks) > 1
    assert all(estimate_tokens(c.text) <= 520 for c in chunks)
    assert all(c.path == ["Long"] for c in chunks)
    # Overlap: the start of each later chunk repeats the end of the previous one.
    for a, b in zip(chunks, chunks[1:]):
        tail = a.text.split()[-5:]
        assert " ".join(tail) in b.text


def test_real_corpus_chunk_sizes_are_reasonable():
    chunks = [c for d in load_corpus(CORPUS_DIR).docs for c in chunk_doc(d)]
    assert 45 <= len(chunks) <= 150
    assert max(estimate_tokens(c.text) for c in chunks) <= 520


# --- ingestion ---------------------------------------------------------------------------


def test_ingestion_is_idempotent_and_only_reembeds_changed_docs(tmp_path):
    corpus = tmp_path / "corpus"
    index = tmp_path / "index"
    write_doc(corpus / "transport", "a.md", GOOD, BODY)
    write_doc(corpus / "transport", "b.md", {**GOOD, "id": "test-doc-b"}, "# B\n\nOther text.")
    provider = HashProvider()

    first = ingest(corpus, index, provider)
    assert first.embedded == first.chunks > 0

    second = ingest(corpus, index, provider)
    assert second.embedded == 0 and second.reused == first.chunks

    write_doc(corpus / "transport", "b.md", {**GOOD, "id": "test-doc-b"}, "# B\n\nChanged text.")
    third = ingest(corpus, index, provider)
    assert third.embedded == 1

    store = FaissStore.load(index)
    assert store.manifest["counts"]["documents"] == 2
    assert set(store.manifest["documents"]) == {"test-doc", "test-doc-b"}
    hits = store.search(provider.embed_query("ambulance 119"), 2)
    assert hits[0].chunk.doc_id == "test-doc"


def test_invalid_documents_are_skipped_not_indexed(tmp_path):
    corpus = tmp_path / "corpus"
    write_doc(corpus / "transport", "ok.md", GOOD, BODY)
    write_doc(corpus / "transport", "bad.md", {**GOOD, "id": "bad-doc", "status": "maybe"}, "# X\n\nY")
    report = ingest(corpus, tmp_path / "index", HashProvider())
    assert report.docs == 1
    assert "transport/bad.md" in report.errors


# --- staleness check and sources -------------------------------------------------------------


def test_volatile_documents_go_stale_sooner():
    today = dt.date(2026, 10, 24)
    old = dt.date(2026, 5, 1)  # ~176 days
    assert is_stale(FrontMatter.model_validate({**GOOD, "last_verified": old, "volatility": "volatile"}), today)
    assert not is_stale(FrontMatter.model_validate({**GOOD, "last_verified": old}), today)


def test_check_reports_stale_unverified_and_needs_review(tmp_path):
    write_doc(tmp_path / "transport", "a.md", {**GOOD, "last_verified": "2020-01-01"}, BODY)
    write_doc(
        tmp_path / "phrases",
        "b.md",
        {**GOOD, "id": "team-doc", "topic": "phrases", "source_type": "team-written", "source_url": None, "last_verified": None},
        "# P\n\nPhrase.",
    )
    r = check(tmp_path, today=dt.date(2026, 10, 24))
    assert [i for i, _ in r.stale] == ["test-doc"]
    assert r.unverified == ["team-doc"]
    assert set(r.needs_review) == {"test-doc", "team-doc"}
    assert r.ok()


def test_sources_file_lists_every_document(tmp_path):
    corpus = tmp_path / "corpus"
    shutil.copytree(CORPUS_DIR, corpus)
    out = write_sources(corpus)
    text = out.read_text(encoding="utf8")
    for d in load_corpus(corpus).docs:
        assert d.meta.title in text
    assert "URLs the owner needs to check or supply" in text
    assert "https://inari.jp/en/" in text
