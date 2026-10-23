"""Planner behaviour: validation, retry, grounding, feasibility, failures, demo mode."""

from __future__ import annotations

import json

import anthropic
import httpx2

from app import main
from app.ratelimit import RateLimiter
from app.sample import days_from_prompt
from app.stream_parse import DayStreamParser
from tests.conftest import FakeStream, chunked, day, plan

BODY = {"prompt": "5 days, parents, Jain", "persona": "family", "diet": "jain", "days": 2}


def events(resp) -> list[tuple[str, dict]]:
    out = []
    for block in resp.text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in block.splitlines())
        out.append((lines["event"], json.loads(lines["data"])))
    return out


def json_body(**extra):
    return {**BODY, "stream": False, **extra}


# --- Validation and grounding -------------------------------------------------


def test_valid_output_is_grounded_and_marked_live(api, fake):
    fake(FakeStream(chunked(plan(day(1, "tokyo"), day(2, "kyoto")))))
    r = api.post("/api/plan", json=json_body())
    assert r.status_code == 200
    it = r.json()
    assert it["source"] == "live"
    assert [d["cityId"] for d in it["days"]] == ["tokyo", "kyoto"]
    # Distance-based estimate from real coordinates, Tokyo -> Kyoto by Shinkansen.
    t = it["days"][1]["transport"]
    assert t["fromCityId"] == "tokyo" and 350 < t["distanceKm"] < 400 and t["estimatedHours"] < 3


def test_request_uses_structured_output_with_our_city_ids(api, fake):
    c = fake(FakeStream([plan(day(1, "tokyo"))]))
    api.post("/api/plan", json=json_body())
    call = c.calls[0]
    schema = call["output_config"]["format"]["schema"]
    assert "kyoto" in schema["properties"]["days"]["items"]["properties"]["cityId"]["enum"]
    assert call["fallbacks"] == "default"
    assert "certified" in call["system"][0]["text"]  # honesty rule is in the prompt


def test_malformed_output_is_retried_once(api, fake):
    c = fake(FakeStream(['{"summary": "oops", "days": [']), FakeStream([plan(day(1, "tokyo"))]))
    r = api.post("/api/plan", json=BODY)
    evs = events(r)
    stages = [d["stage"] for e, d in evs if e == "status"]
    assert stages == ["planning", "invalid", "retrying"]
    assert evs[-1][0] == "final" and evs[-1][1]["itinerary"]["source"] == "live"
    assert len(c.calls) == 2


def test_invalid_twice_falls_back_to_labelled_sample_with_502(api, fake):
    bad = json.dumps({"summary": "x", "days": [{"day": 1}]})  # schema-invalid
    fake(FakeStream([bad]), FakeStream(["not json at all"]))
    r = api.post("/api/plan", json=json_body())
    assert r.status_code == 502
    body = r.json()
    assert body["error"]["code"] == "ai_invalid"
    assert body["fallback"]["source"] == "sample"
    assert "sample itinerary" in body["fallback"]["notices"][0]


def test_unknown_city_day_is_dropped_with_a_notice(api, fake):
    fake(FakeStream([plan(day(1, "tokyo"), day(2, "atlantis"), day(3, "kyoto"))]))
    it = api.post("/api/plan", json=json_body()).json()
    assert [d["cityId"] for d in it["days"]] == ["tokyo", "kyoto"]
    assert [d["day"] for d in it["days"]] == [1, 2]
    assert any("atlantis" in n for n in it["notices"])


def test_unknown_or_misplaced_references_are_cleared_and_flagged(api, fake):
    d = day(1, "kyoto")
    d["stops"][0]["foodSpotId"] = "made-up-restaurant"
    d["stops"][1]["foodSpotId"] = "tokyo-vegan-ramen"  # real spot, wrong city
    fake(FakeStream([plan(d)]))
    it = api.post("/api/plan", json=json_body()).json()
    stops = it["days"][0]["stops"]
    assert all(s["foodSpotId"] is None and s["inOurData"] is False for s in stops)
    assert sum(f["code"] == "unknown-place" for f in it["days"][0]["flags"]) == 2


def test_real_references_are_kept_and_marked_in_our_data(api, fake):
    d = day(1, "kyoto")
    d["stops"][0].update(foodSpotId="kyoto-shojin", kind="food")
    d["stops"][1].update(heritageId="kichijoten", kind="heritage")
    fake(FakeStream([plan(d)]))
    stops = api.post("/api/plan", json=json_body()).json()["days"][0]["stops"]
    assert [s["inOurData"] for s in stops] == [True, True]


def test_feasibility_flags_overpacked_days_and_long_transfers(api, fake):
    fake(FakeStream([plan(day(1, "tokyo", stops=7), day(2, "sapporo"), day(3, "fukuoka"))]))
    days = api.post("/api/plan", json=json_body()).json()["days"]
    assert any(f["code"] == "overpacked" for f in days[0]["flags"])
    # Sapporo -> Fukuoka is ~1,400 km by "shinkansen": flag it.
    assert any(f["code"] == "long-transfer" for f in days[2]["flags"])


def test_spread_out_stops_are_flagged(api, fake):
    d = day(1, "kyoto")
    d["stops"][0].update(heritageId="kichijoten")  # Kyoto area
    d["stops"][1].update(heritageId="benzaiten")  # Enoshima, ~350 km away
    fake(FakeStream([plan(d)]))
    flags = api.post("/api/plan", json=json_body()).json()["days"][0]["flags"]
    assert any(f["code"] == "spread-out" for f in flags)


# --- Upstream failures ---------------------------------------------------------


def _request() -> httpx2.Request:
    return httpx2.Request("POST", "https://api.anthropic.com/v1/messages")


def test_rate_limit_upstream_falls_back_with_ai_busy(api, fake):
    exc = anthropic.RateLimitError("slow down", response=httpx2.Response(429, request=_request()), body=None)
    fake(FakeStream([], exc=exc))
    r = api.post("/api/plan", json=json_body())
    assert r.status_code == 502 and r.json()["error"]["code"] == "ai_busy"


def test_connection_failure_streams_notice_then_sample(api, fake):
    fake(FakeStream([], exc=anthropic.APIConnectionError(request=_request())))
    evs = events(api.post("/api/plan", json=BODY))
    kinds = [e for e, _ in evs]
    assert kinds[-2:] == ["notice", "final"]
    assert evs[-2][1]["code"] == "ai_unavailable"
    assert evs[-1][1]["itinerary"]["source"] == "sample"


def test_refusal_is_reported_not_hidden(api, fake):
    fake(FakeStream([""], stop_reason="refusal"))
    r = api.post("/api/plan", json=json_body())
    assert r.status_code == 502 and r.json()["error"]["code"] == "ai_declined"


def test_streaming_sends_day_previews_before_the_final_plan(api, fake):
    fake(FakeStream(chunked(plan(day(1, "tokyo"), day(2, "kyoto")), 11)))
    kinds = [e for e, _ in events(api.post("/api/plan", json=BODY))]
    assert kinds == ["status", "day", "day", "final"]


# --- Demo mode, input validation, limits ----------------------------------------


def test_demo_mode_without_key_returns_labelled_sample(api):
    assert api.get("/health").json()["mode"] == "demo"
    it = api.post("/api/plan", json=json_body(days=3)).json()
    assert it["source"] == "sample" and len(it["days"]) == 3
    assert it["notices"][0].startswith("Demo mode")


def test_bad_input_is_a_structured_400(api):
    r = api.post("/api/plan", json={"prompt": "", "days": 99, "diet": "carnivore"})
    assert r.status_code == 400
    body = r.json()["error"]
    assert body["code"] == "bad_request"
    assert {d["field"] for d in body["details"]} >= {"prompt", "days", "diet"}


def test_oversized_body_is_rejected(api):
    r = api.post("/api/plan", content=b"x" * 70000, headers={"content-type": "application/json"})
    assert r.status_code == 413


def test_rate_limit_returns_429_with_retry_after(api, monkeypatch):
    monkeypatch.setattr(main, "limiter", RateLimiter(2))
    for _ in range(2):
        assert api.post("/api/plan", json=json_body()).status_code == 200
    r = api.post("/api/plan", json=json_body())
    assert r.status_code == 429 and r.json()["error"]["code"] == "rate_limited"
    assert "Retry-After" in r.headers


# --- Single-day regeneration ------------------------------------------------------


def _itinerary(api) -> dict:
    return api.post("/api/plan", json=json_body(days=3)).json()


def test_regenerate_day_in_demo_mode_explains_itself(api):
    r = api.post("/api/plan/day", json={"itinerary": _itinerary(api), "day": 2})
    assert r.status_code == 503 and r.json()["error"]["code"] == "demo_mode"


def test_regenerate_day_returns_a_grounded_day(api, fake):
    it = _itinerary(api)
    fake(FakeStream([json.dumps(day(9, "nara", stops=1))]))
    r = api.post("/api/plan/day", json={"itinerary": it, "day": 2, "instruction": "lighter"})
    assert r.status_code == 200
    d = r.json()
    assert d["day"] == 2 and d["cityId"] == "nara"


def test_regenerate_day_invalid_twice_is_502(api, fake):
    it = _itinerary(api)
    fake(FakeStream(["{}"]), FakeStream(["nope"]))
    r = api.post("/api/plan/day", json={"itinerary": it, "day": 1})
    assert r.status_code == 502 and r.json()["error"]["code"] == "ai_invalid"


def test_regenerate_unknown_day_is_400(api):
    r = api.post("/api/plan/day", json={"itinerary": _itinerary(api), "day": 9})
    assert r.status_code == 400


# --- Helpers -----------------------------------------------------------------


def test_stream_parser_emits_each_day_once_and_survives_braces_in_strings():
    text = plan(day(1, "tokyo", title="Braces {here} and \"quotes\""), day(2, "kyoto"))
    p = DayStreamParser()
    got = []
    for c in chunked(text, 5):
        got += p.feed(c)
    assert [d["cityId"] for d in got] == ["tokyo", "kyoto"]
    assert got[0]["title"] == 'Braces {here} and "quotes"'


def test_days_from_prompt():
    assert days_from_prompt("5 days, parents, Jain") == 5
    assert days_from_prompt("a 7-day honeymoon") == 7
    assert days_from_prompt("10 दिन जापान") == 10
    assert days_from_prompt("Japan please") == 5
