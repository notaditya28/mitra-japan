"""Rerankers behind one interface. The default is a transparent heuristic (no extra model):
dense similarity, keyword coverage of the query, and soft boosts for the traveller's city and
diet. A cross-encoder could be plugged in later via `Reranker`."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from .retrieve import Candidate, Filters


class Reranker(Protocol):
    def rerank(self, query_tokens: set[str], candidates: list["Candidate"], filters: "Filters") -> list["Candidate"]: ...


class HeuristicReranker:
    name = "heuristic-v1"

    def rerank(self, query_tokens: set[str], candidates: list["Candidate"], filters: "Filters") -> list["Candidate"]:
        for c in candidates:
            c.coverage = _coverage(query_tokens, c.tokens)
            boost = 0.0
            if filters.region and c.chunk.region:
                boost += 0.015 if set(filters.region) & set(c.chunk.region) else -0.06
            if filters.audience and c.chunk.audience:
                boost += 0.03 if set(filters.audience) & set(c.chunk.audience) else -0.03
            if c.chunk.status == "sample":
                boost -= 0.05  # test fixtures and illustrative docs never outrank real sources
            c.score = (c.dense or 0.0) + 0.12 * c.coverage + 0.25 * c.rrf + boost
        return sorted(candidates, key=lambda c: c.score, reverse=True)


def _coverage(query_tokens: set[str], chunk_tokens: set[str]) -> float:
    if not query_tokens:
        return 0.0
    return len(query_tokens & chunk_tokens) / len(query_tokens)
