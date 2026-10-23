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
from .schema import DayRequest, PlanRequest

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Mitra Japan API", version="0.5.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

limiter = RateLimiter(settings.plan_rate_per_minute)
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


def _rate_limited(request: Request) -> JSONResponse | None:
    key = request.client.host if request.client else "anon"
    wait = limiter.check(key)
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


# Re-exported for tests that need the notice texts.
NOTICES = planner_mod.NOTICES
