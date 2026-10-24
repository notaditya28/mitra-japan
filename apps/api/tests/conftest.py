"""Test setup: force Demo mode so no test can ever call the real API."""

from __future__ import annotations

import json
import os
from collections.abc import Iterable
from types import SimpleNamespace
from typing import Any

import pytest

os.environ["MITRA_DEMO_MODE"] = "1"
os.environ["PLAN_RATE_PER_MINUTE"] = "1000"

from fastapi.testclient import TestClient  # noqa: E402

from app import main  # noqa: E402


class FakeStream:
    def __init__(self, chunks: Iterable[str], stop_reason: str = "end_turn", exc: Exception | None = None):
        self.chunks = list(chunks)
        self.stop_reason = stop_reason
        self.exc = exc

    async def __aenter__(self) -> "FakeStream":
        if self.exc:
            raise self.exc
        return self

    async def __aexit__(self, *args: Any) -> None:
        return None

    @property
    def text_stream(self):
        async def gen():
            for c in self.chunks:
                yield c

        return gen()

    async def get_final_message(self):
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text="".join(self.chunks))],
            stop_reason=self.stop_reason,
        )


class FakeClient:
    """Scripted stand-in for AsyncAnthropic: each call pops the next FakeStream."""

    def __init__(self, *streams: FakeStream, creates: list[list[dict]] | None = None):
        self.streams = list(streams)
        self.creates = list(creates or [])
        self.calls: list[dict[str, Any]] = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self._stream, create=self._create))

    async def _create(self, **kwargs: Any):
        """Non-streamed calls (tool use): each scripted turn is a list of content blocks."""
        self.calls.append(kwargs)
        blocks = [SimpleNamespace(**b) for b in self.creates.pop(0)]
        stop = "tool_use" if any(b.type == "tool_use" for b in blocks) else "end_turn"
        return SimpleNamespace(content=blocks, stop_reason=stop)

    def _stream(self, **kwargs: Any) -> FakeStream:
        self.calls.append(kwargs)
        return self.streams.pop(0)


def chunked(text: str, size: int = 37) -> list[str]:
    return [text[i : i + size] for i in range(0, len(text), size)]


def day(n: int, city: str, stops: int = 2, **extra: Any) -> dict[str, Any]:
    d = {
        "day": n,
        "cityId": city,
        "title": f"Day in {city}",
        "stops": [
            {"name": f"Stop {i}", "kind": "sight", "foodSpotId": None, "heritageId": None, "note": ""}
            for i in range(stops)
        ],
        "transport": {"mode": "shinkansen", "fromCityId": None, "note": "about 2 hours"},
        "stay": {"area": "Central", "type": "hotel", "note": ""},
        "foodNotes": "Ask about dashi.",
        "foodReasons": ["Two sample places usually suit you."],
        "tips": [],
    }
    d.update(extra)
    return d


def plan(*days: dict[str, Any]) -> str:
    return json.dumps(
        {
            "summary": "A gentle trip.",
            "days": list(days),
            "visaChecklist": ["Passport (confirm with official source)"],
            "bestSeason": "Spring",
            "etiquetteTips": ["Carry a towel"],
        }
    )


@pytest.fixture
def api():
    client = TestClient(main.app)
    yield client
    main.client_override = None


@pytest.fixture
def fake(monkeypatch):
    def install(*streams: FakeStream) -> FakeClient:
        c = FakeClient(*streams)
        monkeypatch.setattr(main, "client_override", c)
        return c

    return install
