"""TripContext: the traveller's trip, as the assistant understands it, with provenance on every
fact. Stored by the browser (localStorage) and sent with each request; the API keeps a copy in
memory per session only (never on disk) so "View my trip data" / "Delete" can show and clear it.

Privacy: identifiers (passport, card, Aadhaar, PAN numbers) are stripped from messages and
context before anything else sees them, and are never stored.
"""

from __future__ import annotations

import datetime as dt
import re
import threading
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from app.schema import Diet, Itinerary

Provenance = Literal["confirmed", "user-provided", "estimate", "assumption"]
T = TypeVar("T")


class Fact(BaseModel, Generic[T]):
    model_config = ConfigDict(extra="forbid")
    value: T
    provenance: Provenance
    note: str = Field(default="", max_length=200)


class DateRange(BaseModel):
    start: dt.date | None = None
    end: dt.date | None = None


class DietProfile(BaseModel):
    diet: Diet
    custom: list[str] = Field(default_factory=list, max_length=10)


class Budget(BaseModel):
    amountINR: int | None = Field(default=None, ge=0, le=100_000_000)
    style: Literal["budget", "mid", "comfort", "luxury"] | None = None


class Party(BaseModel):
    adults: int = Field(default=1, ge=0, le=20)
    seniors: int = Field(default=0, ge=0, le=20)
    children: int = Field(default=0, ge=0, le=20)


class Accommodation(BaseModel):
    cityId: str = Field(max_length=40)
    name: str = Field(default="", max_length=120)
    area: str = Field(default="", max_length=120)


class Booking(BaseModel):
    kind: Literal["hotel", "train", "flight", "tour", "restaurant", "other"]
    provider: str = Field(default="", max_length=120)
    details: str = Field(default="", max_length=300)
    date: dt.date | None = None
    providerUrl: str | None = Field(default=None, max_length=300)


class TransportPlan(BaseModel):
    mode: str = Field(max_length=40)
    fromCityId: str | None = None
    toCityId: str | None = None
    date: dt.date | None = None
    note: str = Field(default="", max_length=200)


class ChangeRecord(BaseModel):
    at: dt.datetime
    request: str = Field(max_length=300)
    summary: str = Field(max_length=300)


class TripContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str = Field(min_length=6, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    language: Literal["en", "hi", "gu"] = "en"
    dates: Fact[DateRange] | None = None
    cities: Fact[list[str]] | None = None
    diet: Fact[DietProfile] | None = None
    party: Fact[Party] | None = None
    budget: Fact[Budget] | None = None
    travel_style: Fact[str] | None = None
    accessibility: list[Fact[str]] = Field(default_factory=list, max_length=10)
    accommodation: list[Fact[Accommodation]] = Field(default_factory=list, max_length=20)
    transport_plans: list[Fact[TransportPlan]] = Field(default_factory=list, max_length=20)
    bookings: list[Fact[Booking]] = Field(default_factory=list, max_length=20)
    itinerary: Itinerary | None = None
    #: Stop keys "cityId|stop name" the traveller locked; the assistant must ask before touching them.
    pinned: list[str] = Field(default_factory=list, max_length=60)
    #: Stop keys ("cityId|stop name") already done.
    completed: list[str] = Field(default_factory=list, max_length=120)
    #: Which itinerary day is "today" during the trip (None before the trip).
    current_day: int | None = Field(default=None, ge=1, le=30)
    requested_changes: list[ChangeRecord] = Field(default_factory=list, max_length=20)

    def assumptions(self) -> list[str]:
        """Facts marked as assumptions, which the assistant must surface before relying on."""
        out = []
        for name in ("dates", "cities", "diet", "party", "budget", "travel_style"):
            f = getattr(self, name)
            if f is not None and f.provenance == "assumption":
                out.append(name)
        return out

    def diet_name(self) -> str:
        return self.diet.value.diet if self.diet else "none"


# --- identifier scrubbing ---------------------------------------------------------------

PASSPORT = re.compile(r"\b[A-Z][0-9]{7}\b")
PASSPORT_LABELLED = re.compile(r"(passport|पासपोर्ट|旅券)\s*(no\.?|number|num|#|नंबर|番号)?\s*(is|:|-)?\s*(?=[A-Z0-9]*\d)[A-Z0-9]{6,9}\b", re.IGNORECASE)
PAN = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")
AADHAAR = re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}\b")
CARD = re.compile(r"\b(?:\d[ -]?){13,19}\b")


def _luhn(digits: str) -> bool:
    total, alt = 0, False
    for d in reversed(digits):
        n = int(d)
        if alt:
            n *= 2
            if n > 9:
                n -= 9
        total += n
        alt = not alt
    return total % 10 == 0


def scrub(text: str) -> tuple[str, list[str]]:
    """Remove identifiers. Returns the cleaned text and which kinds were found."""
    found: list[str] = []

    def card(m: re.Match[str]) -> str:
        digits = re.sub(r"\D", "", m.group(0))
        if 13 <= len(digits) <= 19 and _luhn(digits):
            found.append("card number")
            raw = m.group(0)
            return "[removed]" + raw[len(raw.rstrip(" -")):]
        return m.group(0)

    out = CARD.sub(card, text)
    if PASSPORT_LABELLED.search(out):
        found.append("passport number")
        out = PASSPORT_LABELLED.sub(lambda m: f"{m.group(1)} number [removed]", out)
    for rx, kind in ((PASSPORT, "passport number"), (PAN, "PAN number"), (AADHAAR, "Aadhaar number")):
        if rx.search(out):
            found.append(kind)
            out = rx.sub("[removed]", out)
    return out, sorted(set(found))


def scrub_context(ctx: TripContext) -> tuple[TripContext, list[str]]:
    """Scrub every string inside the context (notes, booking details, names...)."""
    found: list[str] = []

    def walk(v):
        if isinstance(v, str):
            clean, f = scrub(v)
            found.extend(f)
            return clean
        if isinstance(v, list):
            return [walk(x) for x in v]
        if isinstance(v, dict):
            return {k: walk(x) for k, x in v.items()}
        return v

    data = walk(ctx.model_dump(mode="json"))
    return TripContext.model_validate(data), sorted(set(found))


# --- preference updates from a message ----------------------------------------------------

DIET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("jain", re.compile(r"\b(we|i)('re| are| am| eat| follow| now eat)?\b.*\bjain\b|\bjain (food|diet|khana)\b|जैन", re.I)),
    ("vegan", re.compile(r"\b(we|i)('re| are| am)\b.*\bvegan\b|\bvegan now\b", re.I)),
    ("halal", re.compile(r"\b(we|i)\b.*\b(eat|need|only) halal\b|\bhalal (only|food)\b", re.I)),
    ("eggless", re.compile(r"\b(no eggs?|eggless|egg[- ]free)\b", re.I)),
    ("vegetarian", re.compile(r"\b(we|i)('re| are| am)\b.*\bvegetarian\b|\bshakahari\b|शाकाहारी", re.I)),
    ("no-beef", re.compile(r"\b(no beef|don'?t eat beef|do not eat beef)\b", re.I)),
]
CHANGE_MARKER = re.compile(r"\b(actually|now|from now|instead|change|switch|we eat|i eat|we follow|i follow|we are|we're|i am|i'm)\b|अब", re.I)


def detect_diet_update(message: str) -> str | None:
    if not CHANGE_MARKER.search(message):
        return None
    for diet, rx in DIET_PATTERNS:
        if rx.search(message):
            return diet
    return None


def apply_diet_update(ctx: TripContext, diet: str) -> TripContext:
    custom = ctx.diet.value.custom if ctx.diet else []
    ctx.diet = Fact[DietProfile](value=DietProfile(diet=diet, custom=custom), provenance="user-provided", note="Updated in chat")
    return ctx


# --- in-memory session store (no disk) ----------------------------------------------------


class SessionStore:
    """Per-session copy of the context, in memory only, bounded and thread-safe."""

    def __init__(self, max_sessions: int = 500) -> None:
        self._data: dict[str, TripContext] = {}
        self._lock = threading.Lock()
        self.max_sessions = max_sessions

    def put(self, ctx: TripContext) -> None:
        with self._lock:
            if ctx.session_id not in self._data and len(self._data) >= self.max_sessions:
                self._data.pop(next(iter(self._data)))
            self._data[ctx.session_id] = ctx

    def get(self, session_id: str) -> TripContext | None:
        with self._lock:
            return self._data.get(session_id)

    def delete(self, session_id: str) -> bool:
        with self._lock:
            return self._data.pop(session_id, None) is not None


SESSIONS = SessionStore()
