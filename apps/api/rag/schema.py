"""Front matter every corpus document must carry, and the chunk record we index."""

from __future__ import annotations

import datetime as dt
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

TOPICS = (
    "visa-entry",
    "transport",
    "food-dietary",
    "attractions",
    "etiquette-law",
    "emergency",
    "disaster",
    "phrases",
    "accommodation-luggage",
    "payments-connectivity",
    "heritage",
)

Topic = Literal[
    "visa-entry",
    "transport",
    "food-dietary",
    "attractions",
    "etiquette-law",
    "emergency",
    "disaster",
    "phrases",
    "accommodation-luggage",
    "payments-connectivity",
    "heritage",
]
SourceType = Literal[
    "official-government", "official-transport", "official-tourism", "reputable-local", "team-written"
]
Volatility = Literal["static", "slow-changing", "volatile"]
Status = Literal["verified", "needs-review", "sample"]
Language = Literal["en", "hi", "gu", "ja"]

ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class FrontMatter(BaseModel):
    """Validated metadata. Unknown keys are rejected so typos surface at ingest time."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    id: str = Field(min_length=3, max_length=80)
    title: str = Field(min_length=3, max_length=200)
    topic: Topic
    source_url: str | None
    source_name: str = Field(min_length=2, max_length=200)
    source_type: SourceType
    language: Language
    fetched_on: dt.date
    last_verified: dt.date | None
    volatility: Volatility
    status: Status
    licence_note: str = Field(min_length=10, max_length=600)
    #: Optional: city ids from cities.json this document applies to (None = everywhere).
    region: list[str] | None = None
    #: Optional: who it is for, e.g. ["jain"], ["halal"], ["family"] (None = everyone).
    audience: list[str] | None = None

    @model_validator(mode="after")
    def _rules(self) -> "FrontMatter":
        if not ID_RE.match(self.id):
            raise ValueError("id must be a lowercase slug (a-z, 0-9, hyphens)")
        if self.source_type != "team-written":
            if not self.source_url or not self.source_url.startswith("https://"):
                raise ValueError("non-team documents need an https source_url")
        elif self.status == "verified":
            # Team-written text is never official; only the owner can approve it, and even then it
            # stays labelled team-written. Approval is recorded via last_verified, not 'verified'.
            raise ValueError("team-written documents cannot be marked verified")
        if self.status == "verified" and self.last_verified is None:
            raise ValueError("a verified document needs a last_verified date")
        if self.last_verified and self.last_verified > dt.date.today():
            raise ValueError("last_verified is in the future")
        return self


class Chunk(BaseModel):
    """One retrievable piece of a document, carrying everything needed to cite it."""

    id: str
    doc_id: str
    ordinal: int
    title: str
    section_path: list[str]
    text: str
    hash: str
    topic: str
    language: str
    source_type: str
    source_name: str
    source_url: str | None
    status: str
    volatility: str
    last_verified: str | None
    region: list[str] | None = None
    audience: list[str] | None = None

    @property
    def heading(self) -> str:
        return " > ".join([self.title, *self.section_path])

    def embedding_text(self) -> str:
        """What we embed and keyword-index: title and section path travel with the text."""
        return f"{self.heading}\n{self.text}"
