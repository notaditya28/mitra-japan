"""Tiny in-memory sliding-window rate limiter (per client IP). Enough for a demo server."""

from __future__ import annotations

import time
from collections import defaultdict, deque


class RateLimiter:
    def __init__(self, limit: int, window_s: float = 60.0) -> None:
        self.limit = limit
        self.window_s = window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, now: float | None = None) -> float | None:
        """Record a hit. Returns None if allowed, else seconds until the next slot frees up."""
        t = time.monotonic() if now is None else now
        hits = self._hits[key]
        while hits and t - hits[0] >= self.window_s:
            hits.popleft()
        if len(hits) >= self.limit:
            return round(self.window_s - (t - hits[0]), 1)
        hits.append(t)
        return None
