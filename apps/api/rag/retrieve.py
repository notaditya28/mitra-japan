"""Hybrid retrieval: BM25 keywords + dense multilingual vectors, merged with reciprocal rank
fusion, then reranked. Also computes the retrieval confidence used by the abstain gate."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from . import INDEX_DIR
from .bm25 import BM25
from .embeddings import EmbeddingProvider, get_provider
from .rerank import HeuristicReranker, Reranker
from .schema import Chunk
from .store import FaissStore
from .text import content_tokens, expand_query, tokenize

RRF_K = 60
CANDIDATES = 20
KEEP_MIN, KEEP_MAX = 4, 6

#: Below this retrieval confidence the assistant abstains. Tuned on the eval *dev* split only.
ABSTAIN_THRESHOLD = float(os.getenv("RAG_ABSTAIN_THRESHOLD", "0.42"))
HIGH_THRESHOLD = float(os.getenv("RAG_HIGH_THRESHOLD", "0.62"))


@dataclass
class Filters:
    """Hard filters narrow the candidate set; region/audience only boost (soft)."""

    topics: list[str] | None = None
    languages: list[str] | None = None
    source_types: list[str] | None = None
    region: list[str] | None = None
    audience: list[str] | None = None
    include_fixtures: bool = False

    def allows(self, c: Chunk) -> bool:
        if not self.include_fixtures and c.doc_id.startswith("test-"):
            return False
        if self.topics and c.topic not in self.topics:
            return False
        if self.languages and c.language not in self.languages:
            return False
        if self.source_types and c.source_type not in self.source_types:
            return False
        return True


@dataclass
class Candidate:
    chunk: Chunk
    tokens: set[str]
    dense: float | None = None
    dense_rank: int | None = None
    bm25: float | None = None
    bm25_rank: int | None = None
    rrf: float = 0.0
    coverage: float = 0.0
    score: float = 0.0

    def debug(self) -> dict:
        return {
            "chunk_id": self.chunk.id,
            "title": self.chunk.title,
            "section": " > ".join(self.chunk.section_path),
            "score": round(self.score, 4),
            "dense": None if self.dense is None else round(self.dense, 4),
            "dense_rank": self.dense_rank,
            "bm25": None if self.bm25 is None else round(self.bm25, 3),
            "bm25_rank": self.bm25_rank,
            "rrf": round(self.rrf, 4),
            "coverage": round(self.coverage, 3),
            "status": self.chunk.status,
            "source": self.chunk.source_name,
        }


@dataclass
class RetrievalResult:
    query: str
    expanded: str
    candidates: list[Candidate]
    selected: list[Candidate]
    confidence: float
    level: str  # high | medium | low | abstained
    signals: dict = field(default_factory=dict)


class Retriever:
    def __init__(self, store: FaissStore, provider: EmbeddingProvider, reranker: Reranker | None = None) -> None:
        if store.manifest.get("embedding_model") != provider.name:
            raise ValueError(
                f"Index was built with {store.manifest.get('embedding_model')}, not {provider.name}; "
                "run `python -m rag.ingest` again."
            )
        self.store = store
        self.provider = provider
        self.reranker = reranker or HeuristicReranker()
        self.chunk_tokens = [set(tokenize(c.embedding_text())) for c in store.chunks]
        self.bm25 = BM25([c.embedding_text() for c in store.chunks])

    def search(self, query: str, filters: Filters | None = None, k: int = CANDIDATES) -> RetrievalResult:
        filters = filters or Filters()
        expanded = expand_query(query)
        allowed = [i for i, c in enumerate(self.store.chunks) if filters.allows(c)]
        if not allowed:
            return RetrievalResult(query, expanded, [], [], 0.0, "abstained", {"reason": "no documents match filters"})

        # Dense: embed the original query (the model is multilingual) and the expansion.
        qvec = self.provider.embed_query(expanded)
        dense_hits = self.store.search(qvec, k=len(self.store.chunks))
        dense_rank: dict[int, int] = {}
        dense_score: dict[int, float] = {}
        id_to_idx = {c.id: i for i, c in enumerate(self.store.chunks)}
        allowed_set = set(allowed)
        r = 0
        for h in dense_hits:
            i = id_to_idx[h.chunk.id]
            if i in allowed_set:
                r += 1
                dense_rank[i] = r
                dense_score[i] = h.score

        q_tokens = tokenize(expanded)
        bm = self.bm25.scores(q_tokens)
        bm_order = sorted((i for i in allowed if bm[i] > 0), key=lambda i: bm[i], reverse=True)
        bm_rank = {i: n + 1 for n, i in enumerate(bm_order)}

        pool = set(sorted(dense_rank, key=dense_rank.get)[:k]) | set(bm_order[:k])
        cands: list[Candidate] = []
        for i in pool:
            c = Candidate(self.store.chunks[i], self.chunk_tokens[i])
            c.dense, c.dense_rank = dense_score.get(i), dense_rank.get(i)
            c.bm25, c.bm25_rank = (bm[i] if i in bm_rank else None), bm_rank.get(i)
            c.rrf = sum(1.0 / (RRF_K + rk) for rk in (c.dense_rank, c.bm25_rank) if rk is not None)
            cands.append(c)
        cands.sort(key=lambda c: c.rrf, reverse=True)
        cands = cands[:k]

        qset = content_tokens(query)
        ranked = self.reranker.rerank(qset, cands, filters)
        selected = _select(ranked)
        conf, signals = confidence(ranked, qset)
        level = (
            "abstained" if conf < ABSTAIN_THRESHOLD else "high" if conf >= HIGH_THRESHOLD else "medium" if conf >= (ABSTAIN_THRESHOLD + HIGH_THRESHOLD) / 2 else "low"
        )
        return RetrievalResult(query, expanded, ranked, selected if level != "abstained" else [], conf, level, signals)


def _select(ranked: list[Candidate]) -> list[Candidate]:
    """Best 4-6 chunks: always the top 4, more only if they score close to the best."""
    if not ranked:
        return []
    best = ranked[0].score
    out = ranked[:KEEP_MIN]
    for c in ranked[KEEP_MIN:KEEP_MAX]:
        if c.score >= best - 0.05:
            out.append(c)
    return out


# e5 cosine similarities are compressed (unrelated text still scores ~0.78), so we rescale.
DENSE_FLOOR, DENSE_CEIL = 0.80, 0.90


def confidence(ranked: list[Candidate], query_tokens: set[str]) -> tuple[float, dict]:
    """0..1 from three signals: how similar the best chunk is, how many query words it covers,
    and whether keyword and dense retrieval agree on it."""
    if not ranked:
        return 0.0, {"reason": "no candidates"}
    top = ranked[0]
    dense = top.dense or 0.0
    dense_n = min(1.0, max(0.0, (dense - DENSE_FLOOR) / (DENSE_CEIL - DENSE_FLOOR)))
    agree = 1.0 if (top.dense_rank and top.dense_rank <= 3 and top.bm25_rank and top.bm25_rank <= 3) else (
        0.5 if (top.dense_rank and top.dense_rank <= 5 and top.bm25_rank and top.bm25_rank <= 8) else 0.0
    )
    # Agreement between the top two documents (same doc twice = stronger evidence).
    same_doc = 1.0 if len(ranked) > 1 and ranked[1].chunk.doc_id == top.chunk.doc_id else 0.0
    conf = 0.55 * dense_n + 0.25 * top.coverage + 0.15 * agree + 0.05 * same_doc
    return round(conf, 4), {
        "dense": round(dense, 4),
        "dense_norm": round(dense_n, 3),
        "coverage": round(top.coverage, 3),
        "agreement": agree,
        "same_doc": same_doc,
        "query_tokens": len(query_tokens),
    }


@lru_cache(maxsize=2)
def get_retriever(index_dir: str = str(INDEX_DIR), provider_name: str | None = None) -> Retriever:
    path = Path(index_dir)
    if not FaissStore.exists(path):
        raise FileNotFoundError("Knowledge index not built yet: run `python -m rag.ingest` in apps/api.")
    return Retriever(FaissStore.load(path), get_provider(provider_name))
