"""Build the local knowledge index from rag/corpus.

    python -m rag.ingest            load, validate, chunk, embed changed docs, write the index
    python -m rag.ingest --check    report invalid, stale and needs-review documents (no writes)
    python -m rag.ingest --sources  regenerate rag/corpus/SOURCES.md

Re-running is idempotent: chunks whose text hash is unchanged reuse their stored vectors, so
only edited documents are re-embedded.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import yaml
from pydantic import ValidationError

from . import CORPUS_DIR, INDEX_DIR
from .chunking import chunk_sections, split_sections, text_hash
from .embeddings import EmbeddingProvider, get_provider
from .schema import Chunk, FrontMatter
from .store import FaissStore

#: Days after which last_verified counts as stale. Volatile docs (fees, hours, contacts) go
#: stale much sooner. Override with RAG_STALE_DAYS / RAG_STALE_DAYS_VOLATILE.
STALE_DAYS = {"static": 730, "slow-changing": 365, "volatile": 90}
SKIP_FILES = {"SOURCES.md", "README.md"}


@dataclass
class Doc:
    path: Path
    meta: FrontMatter
    body: str
    hash: str


@dataclass
class LoadResult:
    docs: list[Doc] = field(default_factory=list)
    errors: dict[str, str] = field(default_factory=dict)


def _split_front_matter(raw: str) -> tuple[dict, str]:
    if not raw.startswith("---"):
        raise ValueError("missing front matter (file must start with ---)")
    try:
        _, fm, body = raw.split("---", 2)
    except ValueError as e:
        raise ValueError("front matter is not closed with ---") from e
    data = yaml.safe_load(fm) or {}
    if not isinstance(data, dict):
        raise ValueError("front matter must be a mapping")
    return data, body.strip()


def load_corpus(corpus: Path = CORPUS_DIR) -> LoadResult:
    result = LoadResult()
    seen: dict[str, Path] = {}
    for path in sorted(corpus.rglob("*.md")):
        if path.name in SKIP_FILES or path.name.startswith("_"):
            continue
        rel = path.relative_to(corpus).as_posix()
        try:
            raw = path.read_text(encoding="utf8")
            data, body = _split_front_matter(raw)
            meta = FrontMatter.model_validate(data)
            if meta.topic != path.parent.name:
                raise ValueError(f"topic '{meta.topic}' does not match folder '{path.parent.name}'")
            if meta.id in seen:
                raise ValueError(f"duplicate id '{meta.id}' (also in {seen[meta.id].name})")
            if not body:
                raise ValueError("document body is empty")
        except ValidationError as e:
            fields = ", ".join(".".join(str(p) for p in err["loc"]) or "document" for err in e.errors())
            result.errors[rel] = f"invalid front matter: {fields}: {e.errors()[0]['msg']}"
            continue
        except (ValueError, yaml.YAMLError) as e:
            result.errors[rel] = str(e)
            continue
        seen[meta.id] = path
        result.docs.append(Doc(path, meta, body, hashlib.sha256(raw.encode("utf8")).hexdigest()[:16]))
    return result


def chunk_doc(doc: Doc) -> list[Chunk]:
    m = doc.meta
    raw = chunk_sections(split_sections(doc.body))
    return [
        Chunk(
            id=f"{m.id}#{i}",
            doc_id=m.id,
            ordinal=i,
            title=m.title,
            section_path=rc.path,
            text=rc.text,
            hash=text_hash(f"{m.title}|{'/'.join(rc.path)}|{rc.text}|{m.status}|{m.last_verified}|{m.region}|{m.audience}"),
            topic=m.topic,
            language=m.language,
            source_type=m.source_type,
            source_name=m.source_name,
            source_url=m.source_url,
            status=m.status,
            volatility=m.volatility,
            last_verified=m.last_verified.isoformat() if m.last_verified else None,
            region=m.region,
            audience=m.audience,
        )
        for i, rc in enumerate(raw)
    ]


@dataclass
class IngestReport:
    docs: int
    chunks: int
    embedded: int
    reused: int
    errors: dict[str, str]
    index_dir: Path


def ingest(
    corpus: Path = CORPUS_DIR,
    index_dir: Path = INDEX_DIR,
    provider: EmbeddingProvider | None = None,
) -> IngestReport:
    provider = provider or get_provider()
    loaded = load_corpus(corpus)
    chunks = [c for d in loaded.docs for c in chunk_doc(d)]

    # Reuse vectors for unchanged chunks (same text hash, same embedding model).
    cache: dict[str, np.ndarray] = {}
    if FaissStore.exists(index_dir):
        old = FaissStore.load(index_dir)
        if old.manifest.get("embedding_model") == provider.name:
            cache = {c.hash: v for c, v in zip(old.chunks, old.vectors)}

    todo = [c for c in chunks if c.hash not in cache]
    fresh = provider.embed_documents([c.embedding_text() for c in todo]) if todo else None
    for i, c in enumerate(todo):
        assert fresh is not None
        cache[c.hash] = fresh[i]
    vectors = (
        np.stack([cache[c.hash] for c in chunks]) if chunks else np.zeros((0, provider.dim), dtype="float32")
    )

    manifest = {
        "built_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "embedding_model": provider.name,
        "dim": provider.dim,
        "counts": {
            "documents": len(loaded.docs),
            "chunks": len(chunks),
            "invalid_documents": len(loaded.errors),
            "by_topic": _count(d.meta.topic for d in loaded.docs),
            "by_status": _count(d.meta.status for d in loaded.docs),
        },
        "documents": {
            d.meta.id: {
                "path": d.path.relative_to(corpus).as_posix(),
                "hash": d.hash,
                "chunks": [c.id for c in chunks if c.doc_id == d.meta.id],
                "status": d.meta.status,
                "last_verified": d.meta.last_verified.isoformat() if d.meta.last_verified else None,
            }
            for d in loaded.docs
        },
        "errors": loaded.errors,
    }
    FaissStore(chunks, vectors, manifest).save(index_dir)
    return IngestReport(len(loaded.docs), len(chunks), len(todo), len(chunks) - len(todo), loaded.errors, index_dir)


def _count(values) -> dict[str, int]:
    out: dict[str, int] = {}
    for v in values:
        out[v] = out.get(v, 0) + 1
    return dict(sorted(out.items()))


# --- staleness check -------------------------------------------------------------------


def stale_threshold(volatility: str) -> int:
    if volatility == "volatile":
        return int(os.getenv("RAG_STALE_DAYS_VOLATILE", STALE_DAYS["volatile"]))
    return int(os.getenv("RAG_STALE_DAYS", STALE_DAYS[volatility]))


def is_stale(meta: FrontMatter, today: dt.date | None = None) -> bool:
    if meta.last_verified is None:
        return True
    return ((today or dt.date.today()) - meta.last_verified).days > stale_threshold(meta.volatility)


@dataclass
class CheckReport:
    errors: dict[str, str]
    stale: list[tuple[str, str]]
    unverified: list[str]
    needs_review: list[str]
    total: int

    def ok(self) -> bool:
        return not self.errors


def check(corpus: Path = CORPUS_DIR, today: dt.date | None = None) -> CheckReport:
    loaded = load_corpus(corpus)
    stale, unverified, review = [], [], []
    for d in loaded.docs:
        m = d.meta
        if m.last_verified is None:
            unverified.append(m.id)
        elif is_stale(m, today):
            stale.append((m.id, f"{m.volatility}, last verified {m.last_verified}"))
        if m.status == "needs-review":
            review.append(m.id)
    return CheckReport(loaded.errors, stale, unverified, review, len(loaded.docs) + len(loaded.errors))


# --- SOURCES.md ---------------------------------------------------------------------------


def write_sources(corpus: Path = CORPUS_DIR) -> Path:
    loaded = load_corpus(corpus)
    notes_path = corpus / "_fetch_notes.yaml"
    notes = yaml.safe_load(notes_path.read_text(encoding="utf8")) if notes_path.exists() else []
    lines = [
        "# Knowledge base sources",
        "",
        "Generated by `python -m rag.ingest --sources`. Do not edit the tables by hand.",
        "Status: `verified` = checked by the owner; `needs-review` = fetched or written by us, not yet checked;",
        "`sample` = test fixture, not real guidance.",
        "",
    ]
    for topic in sorted({d.meta.topic for d in loaded.docs}):
        lines += [f"## {topic}", "", "| Document | Source | Type | Status | Last verified |", "| --- | --- | --- | --- | --- |"]
        for d in sorted((d for d in loaded.docs if d.meta.topic == topic), key=lambda d: d.meta.id):
            m = d.meta
            src = f"[{m.source_name}]({m.source_url})" if m.source_url else m.source_name
            lines.append(
                f"| {m.title} (`{d.path.relative_to(corpus).as_posix()}`) | {src} | {m.source_type} | {m.status} | {m.last_verified or 'never'} |"
            )
        lines.append("")
    lines += ["## URLs the owner needs to check or supply", ""]
    for n in notes or []:
        lines.append(f"- {n['url']}: {n['problem']}")
    lines += ["", "Every document is `needs-review` until the owner confirms it against the source."]
    if loaded.errors:
        lines += ["", "## Invalid documents (not indexed)", ""]
        lines += [f"- `{p}`: {e}" for p, e in loaded.errors.items()]
    out = corpus / "SOURCES.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf8")
    return out


# --- CLI ------------------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m rag.ingest", description=__doc__.split("\n\n")[0])
    ap.add_argument("--check", action="store_true", help="report stale / invalid / needs-review docs")
    ap.add_argument("--sources", action="store_true", help="regenerate rag/corpus/SOURCES.md")
    ap.add_argument("--corpus", type=Path, default=CORPUS_DIR)
    ap.add_argument("--index", type=Path, default=INDEX_DIR)
    ap.add_argument("--embeddings", choices=["e5", "hash"], default=None)
    args = ap.parse_args(argv)

    if args.sources:
        print(f"Wrote {write_sources(args.corpus)}")
        return 0

    if args.check:
        r = check(args.corpus)
        print(f"{r.total} documents checked")
        print(f"\nInvalid ({len(r.errors)}):")
        for p, e in r.errors.items():
            print(f"  - {p}: {e}")
        print(f"\nStale ({len(r.stale)}):")
        for i, why in r.stale:
            print(f"  - {i}: {why}")
        print(f"\nNever verified / no date ({len(r.unverified)}):")
        for i in r.unverified:
            print(f"  - {i}")
        print(f"\nNeeds owner review ({len(r.needs_review)}):")
        for i in r.needs_review:
            print(f"  - {i}")
        return 0 if r.ok() else 1

    report = ingest(args.corpus, args.index, get_provider(args.embeddings))
    print(
        f"Indexed {report.docs} documents -> {report.chunks} chunks "
        f"({report.embedded} embedded, {report.reused} reused) in {report.index_dir}"
    )
    for p, e in report.errors.items():
        print(f"  skipped {p}: {e}", file=sys.stderr)
    return 1 if report.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
