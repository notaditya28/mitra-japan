"""The trip guide: Claude plans, we validate and ground, the UI streams it in.

Every response is parsed, validated against the Pydantic schema and grounded
against our place data. Invalid output is retried once; after that, or on any
upstream failure, the caller gets a clearly labelled sample itinerary plus a
notice saying the AI planner was unavailable. Nothing is silently swapped.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import anthropic
from pydantic import ValidationError

from .config import settings
from .data import PlaceData
from .prompts import day_message, plan_message, system_blocks
from .sample import days_from_prompt, sample_plan
from .schema import Day, DayRequest, PlanRequest, RawDay, RawPlan, day_json_schema, plan_json_schema
from .stream_parse import DayStreamParser
from .validate import ground_day, ground_plan

log = logging.getLogger("mitra.planner")

#: Server-side refusal fallback: a declined request is re-run on Anthropic's recommended model.
FALLBACK_BETA = "server-side-fallback-2026-07-01"
MAX_TOKENS = 16000
EFFORT = "medium"

Event = dict[str, Any]


class UpstreamError(Exception):
    """The AI call failed in a way the user should hear about."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


NOTICES = {
    "demo_mode": "Demo mode: no AI key is configured, so this is a sample itinerary built from our city data.",
    "ai_unavailable": "AI planner unavailable, showing the sample itinerary.",
    "ai_busy": "The AI planner is busy right now, showing the sample itinerary. Try again in a minute.",
    "ai_invalid": "The AI planner returned an itinerary we could not validate, showing the sample itinerary.",
    "ai_declined": "The AI planner could not help with this request, showing the sample itinerary.",
}

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(timeout=settings.upstream_timeout_s, max_retries=1)
    return _client


def _text_of(message: Any) -> str:
    return "".join(getattr(b, "text", "") for b in message.content if getattr(b, "type", None) == "text")


async def _stream_json(
    client: Any,
    data: PlaceData,
    schema: dict[str, Any],
    user: str,
    on_text: Any = None,
) -> str:
    """One streamed, schema-constrained call. Returns the JSON text or raises UpstreamError."""
    try:
        async with client.beta.messages.stream(
            model=settings.model,
            max_tokens=MAX_TOKENS,
            system=system_blocks(data),
            messages=[{"role": "user", "content": user}],
            output_config={"effort": EFFORT, "format": {"type": "json_schema", "schema": schema}},
            betas=[FALLBACK_BETA],
            fallbacks="default",
        ) as stream:
            async for text in stream.text_stream:
                if on_text is not None:
                    on_text(text)
            final = await stream.get_final_message()
    except anthropic.RateLimitError as e:
        raise UpstreamError("ai_busy", "Rate limited by the AI provider") from e
    except anthropic.AuthenticationError as e:
        raise UpstreamError("ai_unavailable", "AI key was rejected") from e
    except (anthropic.APIConnectionError, anthropic.APITimeoutError) as e:
        raise UpstreamError("ai_unavailable", "Could not reach the AI provider") from e
    except anthropic.APIStatusError as e:
        raise UpstreamError("ai_unavailable", f"AI provider error {e.status_code}") from e

    if final.stop_reason == "refusal":
        raise UpstreamError("ai_declined", "The request was declined")
    if final.stop_reason == "max_tokens":
        # Truncated JSON never validates; treat like invalid output so we retry once.
        return ""
    return _text_of(final)


async def plan_events(req: PlanRequest, data: PlaceData, client: Any | None = None) -> AsyncIterator[Event]:
    """Yield status, day previews, notices and exactly one final itinerary."""
    days = req.days or days_from_prompt(req.prompt)

    def fallback(code: str) -> list[Event]:
        plan = sample_plan(data, persona=req.persona, diet=req.diet, days=days)
        plan.notices.insert(0, NOTICES[code])
        return [{"type": "notice", "code": code, "message": NOTICES[code]}, {"type": "final", "itinerary": plan}]

    if not settings.live and client is None:
        yield {"type": "status", "stage": "sample"}
        for e in fallback("demo_mode"):
            yield e
        return

    client = client or get_client()
    for attempt in (1, 2):
        yield {"type": "status", "stage": "planning" if attempt == 1 else "retrying", "days": days}
        parser = DayStreamParser()
        queue: asyncio.Queue[tuple[str, Any]] = asyncio.Queue()
        previous_city: list[str | None] = [None]

        def on_text(text: str) -> None:
            # Runs inside the stream: ground each completed day and hand it to the client now.
            for raw in parser.feed(text):
                try:
                    day = ground_day(RawDay.model_validate(raw), data, previous_city[0])
                except ValidationError:
                    continue
                if day is not None:
                    previous_city[0] = day.cityId
                    queue.put_nowait(("day", day))

        async def run(user: str = plan_message(req, days)) -> None:
            try:
                text = await _stream_json(client, data, plan_json_schema(data), user, on_text)
                await queue.put(("done", text))
            except UpstreamError as e:
                await queue.put(("error", e))
            except Exception as e:  # never leave the client hanging on an unexpected bug
                log.exception("planner crashed")
                await queue.put(("error", UpstreamError("ai_unavailable", str(e))))

        task = asyncio.create_task(run())
        text = ""
        try:
            while True:
                kind, payload = await queue.get()
                if kind == "day":
                    yield {"type": "day", "day": payload}
                elif kind == "error":
                    log.warning("planner upstream failure: %s", payload.message)
                    for ev in fallback(payload.code):
                        yield ev
                    return
                else:
                    text = payload
                    break
        finally:
            if not task.done():
                task.cancel()

        try:
            raw_plan = RawPlan.model_validate(json.loads(text))
            plan = ground_plan(raw_plan, data, source="live", model=settings.model)
        except (json.JSONDecodeError, ValidationError, ValueError) as e:
            log.warning("planner output invalid (attempt %d): %s", attempt, str(e)[:300])
            if attempt == 1:
                # Tell the client to discard this attempt's previews before the retry.
                yield {"type": "status", "stage": "invalid"}
                continue
            for ev in fallback("ai_invalid"):
                yield ev
            return
        yield {"type": "final", "itinerary": plan}
        return


async def regenerate_day(req: DayRequest, data: PlaceData, client: Any | None = None) -> Day:
    """Rewrite one day. Raises UpstreamError (502) after one retry, or in Demo mode."""
    if not settings.live and client is None:
        raise UpstreamError("demo_mode", "Regenerating a day needs the AI planner, which is off in Demo mode.")
    client = client or get_client()
    previous_city = next((d.cityId for d in req.itinerary.days if d.day == req.day - 1), None)
    for attempt in (1, 2):
        text = await _stream_json(client, data, day_json_schema(data), day_message(req))
        try:
            raw = RawDay.model_validate(json.loads(text))
            raw.day = req.day
            day = ground_day(raw, data, previous_city)
            if day is None:
                raise ValueError("day city not in our data")
            return day
        except (json.JSONDecodeError, ValidationError, ValueError) as e:
            log.warning("day output invalid (attempt %d): %s", attempt, str(e)[:300])
    raise UpstreamError("ai_invalid", "The AI planner returned a day we could not validate.")
