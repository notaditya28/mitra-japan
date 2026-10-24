"""Request and response models for the assistant API (structured, validated both ways)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from .context import TripContext

Confidence = Literal["high", "medium", "low", "abstained"]
StatementKind = Literal["fact", "suggestion", "estimate"]
Intent = Literal["info", "plan_change", "emergency", "smalltalk", "clarify"]


class Citation(BaseModel):
    n: int
    chunk_id: str
    doc_id: str
    title: str
    section: str
    source_name: str
    source_url: str | None
    source_type: str
    status: str
    volatility: str
    last_verified: str | None
    excerpt: str


class Statement(BaseModel):
    text: str
    kind: StatementKind
    citations: list[int] = Field(default_factory=list)


class ChatTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    text: str = Field(max_length=2000)


class Location(BaseModel):
    """Opt-in, per request, never stored or logged."""

    model_config = ConfigDict(extra="forbid")
    lat: float = Field(ge=20, le=50)
    lng: float = Field(ge=120, le=155)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: str = Field(min_length=1, max_length=1000)
    session_id: str = Field(min_length=6, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    trip_context: TripContext | None = None
    language: Literal["en", "hi", "gu"] | None = None
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)
    location: Location | None = None


class EmergencyContact(BaseModel):
    label: str
    value: str
    kind: Literal["phone", "url", "email", "text"]
    note: str = ""
    source_url: str | None = None


class EmergencyPayload(BaseModel):
    kind: str
    title: str
    urgent_action: str
    steps: list[str]
    contacts: list[EmergencyContact]
    replan_prompt: str
    disclaimer: str
    status: str
    last_verified: str | None
    sources: list[str]
    offline: bool = False


class AssistantResponse(BaseModel):
    answer: str
    statements: list[Statement] = Field(default_factory=list)
    language: str = "en"
    citations: list[Citation] = Field(default_factory=list)
    confidence: Confidence = "abstained"
    freshness_note: str | None = None
    suggested_next_steps: list[str] = Field(default_factory=list)
    proposed_patch: dict[str, Any] | None = None
    needs_clarification: str | None = None
    intent: Intent = "info"
    emergency: EmergencyPayload | None = None
    mode: Literal["live", "demo"] = "demo"
    mode_label: str = ""
    notices: list[str] = Field(default_factory=list)
    trip_context: TripContext | None = None
    debug: dict[str, Any] | None = None
