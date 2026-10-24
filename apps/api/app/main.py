"""Mitra Japan API: the Claude trip guide. The API key never leaves this server."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from . import planner as planner_mod
from .config import settings
from .data import load
from .planner import UpstreamError, plan_events, regenerate_day
from .ratelimit import RateLimiter
from .scan import ScanExplainRequest, explain_scan
from .schema import DayRequest, Itinerary, PlanRequest

from pydantic import BaseModel, ConfigDict, Field
from rag import assistant
from rag import ingest as rag_ingest
from rag.context import SESSIONS
from rag.models import ChatRequest
from rag.patching import UNDO, Patch, apply_patch
from rag.retrieve import Filters, get_retriever

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Mitra Japan API", version="0.5.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)

limiter = RateLimiter(settings.plan_rate_per_minute)
chat_limiter = RateLimiter(settings.chat_rate_per_minute)
#: Tests swap this for a fake Anthropic client.
client_override: Any = None

FAILURE_CODES = {"ai_unavailable", "ai_busy", "ai_invalid", "ai_declined"}


def error(status: int, code: str, message: str, **extra: Any) -> JSONResponse:
    headers = {"Retry-After": str(int(extra["retryAfter"]) + 1)} if "retryAfter" in extra else None
    return JSONResponse({"error": {"code": code, "message": message, **extra}}, status_code=status, headers=headers)


@app.middleware("http")
async def limit_body(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > settings.max_body_bytes:
        return error(413, "payload_too_large", f"Request body is larger than {settings.max_body_bytes} bytes.")
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def bad_request(_: Request, exc: RequestValidationError) -> JSONResponse:
    details = [
        {"field": ".".join(str(p) for p in e.get("loc", [])[1:]), "message": e.get("msg", "")} for e in exc.errors()
    ]
    return error(400, "bad_request", "Some fields are missing or invalid.", details=details)


def _rate_limited(request: Request, which: RateLimiter | None = None) -> JSONResponse | None:
    key = request.client.host if request.client else "anon"
    wait = (which or limiter).check(key)
    if wait is None:
        return None
    return error(429, "rate_limited", "Too many plans in a short time. Please wait a moment.", retryAfter=wait)


def _serialise(event: dict[str, Any]) -> dict[str, Any]:
    out = dict(event)
    for k in ("day", "itinerary"):
        if k in out and hasattr(out[k], "model_dump"):
            out[k] = out[k].model_dump(mode="json")
    return out


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "live" if settings.live else "demo", "model": settings.model}


@app.post("/api/plan")
async def plan(req: PlanRequest, request: Request):
    limited = _rate_limited(request)
    if limited:
        return limited
    data = load()
    events = plan_events(req, data, client_override)

    if not req.stream:
        final: dict[str, Any] | None = None
        failure: dict[str, Any] | None = None
        async for ev in events:
            if ev["type"] == "notice" and ev["code"] in FAILURE_CODES:
                failure = ev
            if ev["type"] == "final":
                final = _serialise(ev)["itinerary"]
        if failure is not None:
            # Upstream AI failure: real 502, with the labelled sample attached as a fallback.
            return JSONResponse(
                {"error": {"code": failure["code"], "message": failure["message"]}, "fallback": final},
                status_code=502,
            )
        return JSONResponse(final)

    async def sse() -> AsyncIterator[bytes]:
        async for ev in events:
            payload = json.dumps(_serialise(ev), ensure_ascii=False)
            yield f"event: {ev['type']}\ndata: {payload}\n\n".encode()

    return StreamingResponse(
        sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/plan/day")
async def plan_day(req: DayRequest, request: Request):
    limited = _rate_limited(request)
    if limited:
        return limited
    if not any(d.day == req.day for d in req.itinerary.days):
        return error(400, "bad_request", f"Day {req.day} is not in this itinerary.")
    try:
        day = await regenerate_day(req, load(), client_override)
    except UpstreamError as e:
        status = 503 if e.code == "demo_mode" else 502
        return error(status, e.code, e.message)
    return JSONResponse(day.model_dump(mode="json"))


@app.post("/api/scan-explain")
async def scan_explain(req: ScanExplainRequest, request: Request):
    limited = _rate_limited(request)
    if limited:
        return limited
    try:
        out = await explain_scan(req, load(), client_override)
    except UpstreamError as e:
        status = 503 if e.code == "demo_mode" else 502
        return error(status, e.code, e.message)
    return JSONResponse(out.model_dump(mode="json"))


# --- Knowledge assistant (RAG) -----------------------------------------------------------


@app.post("/api/assistant/chat")
async def assistant_chat(req: ChatRequest, request: Request):
    limited = _rate_limited(request, chat_limiter)
    if limited:
        return limited
    resp = await assistant.handle(req, client_override)
    out = resp.model_dump(mode="json")
    if not settings.debug_endpoints:
        out.pop("debug", None)
    return JSONResponse(out)


class ApplyPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=6, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    itinerary: Itinerary
    patch: Patch
    pinned: list[str] = Field(default_factory=list, max_length=60)
    allow_pinned: bool = False


class UndoRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: str = Field(min_length=6, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    undo_token: str = Field(min_length=8, max_length=64)


@app.post("/api/assistant/apply-patch")
def assistant_apply(req: ApplyPatchRequest, request: Request):
    limited = _rate_limited(request, chat_limiter)
    if limited:
        return limited
    result = apply_patch(req.itinerary, req.patch, set(req.pinned), allow_pinned=req.allow_pinned)
    if not result.ok or result.itinerary is None:
        return error(400, "invalid_patch", "This change can't be applied as it is.", details=result.errors)
    token = UNDO.put(req.session_id, req.itinerary)
    stored = SESSIONS.get(req.session_id)
    if stored is not None:
        SESSIONS.put(stored.model_copy(update={"itinerary": result.itinerary}))
    return JSONResponse(
        {
            "itinerary": result.itinerary.model_dump(mode="json"),
            "undo_token": token,
            "diff": result.diff.model_dump(mode="json") if result.diff else None,
            "warnings": result.warnings,
        }
    )


@app.post("/api/assistant/undo")
def assistant_undo(req: UndoRequest):
    previous = UNDO.pop(req.session_id, req.undo_token)
    if previous is None:
        return error(404, "undo_unavailable", "Nothing to undo (the change is too old or was already undone).")
    stored = SESSIONS.get(req.session_id)
    if stored is not None:
        SESSIONS.put(stored.model_copy(update={"itinerary": previous}))
    return JSONResponse({"itinerary": previous.model_dump(mode="json")})


@app.get("/api/knowledge/search")
def knowledge_search(q: str = "", k: int = 8, include_fixtures: bool = False):
    if not settings.debug_endpoints:
        return error(404, "not_found", "Not available in production.")
    if not (1 <= len(q) <= 500) or not (1 <= k <= 20):
        return error(400, "bad_request", "q must be 1-500 characters and k 1-20.")
    try:
        res = get_retriever().search(q, Filters(include_fixtures=include_fixtures))
    except FileNotFoundError as e:
        return error(503, "index_missing", str(e))
    return JSONResponse(
        {
            "query": res.query,
            "expanded": res.expanded,
            "confidence": res.confidence,
            "level": res.level,
            "signals": res.signals,
            "candidates": [c.debug() | {"text": c.chunk.text, "source_url": c.chunk.source_url} for c in res.candidates[:k]],
        }
    )


@app.get("/api/knowledge/sources")
def knowledge_sources():
    report = rag_ingest.check()
    loaded = rag_ingest.load_corpus()
    stale = {i for i, _ in report.stale} | set(report.unverified)
    return JSONResponse(
        {
            "documents": [
                {
                    "id": d.meta.id,
                    "title": d.meta.title,
                    "topic": d.meta.topic,
                    "source_name": d.meta.source_name,
                    "source_url": d.meta.source_url,
                    "source_type": d.meta.source_type,
                    "status": d.meta.status,
                    "last_verified": d.meta.last_verified.isoformat() if d.meta.last_verified else None,
                    "volatility": d.meta.volatility,
                    "stale": d.meta.id in stale,
                }
                for d in loaded.docs
            ],
            "invalid": report.errors,
        }
    )


@app.get("/api/trip-data")
def trip_data(session_id: str = ""):
    if not (6 <= len(session_id) <= 64):
        return error(400, "bad_request", "session_id is required.")
    ctx = SESSIONS.get(session_id)
    return JSONResponse(
        {
            "stored_on_server": ctx is not None,
            "storage": "server memory only (cleared on restart); your browser keeps its own copy",
            "trip_context": ctx.model_dump(mode="json") if ctx else None,
        }
    )


@app.delete("/api/trip-data")
def trip_data_delete(session_id: str = ""):
    if not (6 <= len(session_id) <= 64):
        return error(400, "bad_request", "session_id is required.")
    deleted = SESSIONS.delete(session_id)
    return JSONResponse({"deleted": deleted})


@app.post("/api/ingest")
def run_ingest():
    if not settings.debug_endpoints:
        return error(404, "not_found", "Not available in production.")
    report = rag_ingest.ingest()
    get_retriever.cache_clear()
    return JSONResponse({"documents": report.docs, "chunks": report.chunks, "embedded": report.embedded, "errors": report.errors})


# Re-exported for tests that need the notice texts.
NOTICES = planner_mod.NOTICES
