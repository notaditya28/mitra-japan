"""R2-R4: retrieval, abstention, routing, patching, undo, privacy, live tools, emergency, API."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from app import main
from app.schema import Itinerary
from rag import INDEX_DIR, assistant
from rag import answer as A
from rag.context import Booking, DietProfile, Fact, TripContext, scrub
from rag.emergency import build as build_emergency, load_emergency
from rag.live_tools import get_attraction_hours, get_transit_status, get_weather
from rag.models import ChatRequest
from rag.patching import Patch, apply_patch, pin_key
from rag.router import route
from rag.store import FaissStore
from tests.conftest import FakeStream, chunked

SAMPLE = Path(__file__).resolve().parents[2] / "web" / "src" / "data" / "sampleItinerary.json"


def sample_itinerary() -> Itinerary:
    return Itinerary.model_validate(json.loads(SAMPLE.read_text(encoding="utf8")))


def ctx(**kw) -> TripContext:
    base = TripContext(session_id="test-session", itinerary=sample_itinerary(), current_day=3)
    return base.model_copy(update=kw)


def chat(message: str, c: TripContext | None = None, **kw):
    req = ChatRequest(message=message, session_id="test-session", trip_context=c, **kw)
    return asyncio.run(assistant.handle(req))


# The dense half of retrieval needs the local e5 index (built by `python -m rag.ingest`).
needs_index = pytest.mark.skipif(
    not FaissStore.exists(INDEX_DIR)
    or json.loads((INDEX_DIR / "manifest.json").read_text(encoding="utf8")).get("embedding_model") != "intfloat/multilingual-e5-small",
    reason="local e5 index not built",
)


# --- retrieval and abstention ---------------------------------------------------------------


@needs_index
@pytest.mark.parametrize(
    "query, doc",
    [
        ("Do I need a visa for Japan with an Indian passport?", "visa-mofa-exemptions"),
        ("I missed my Shinkansen, can I take the next train?", "transport-jr-east-missed-train"),
        ("Can I bring mangoes from India?", "law-maff-quarantine"),
        ("मेरा पासपोर्ट खो गया", "emergency-cgi-osaka-lost-passport"),
        ("jain khana kaise milega", "food-team-jain-dining"),
        ("温泉のマナーは？", "etiquette-jnto-onsen"),
    ],
)
def test_hybrid_retrieval_finds_the_known_document(query, doc):
    from rag.retrieve import Filters, get_retriever

    res = get_retriever().search(query, Filters())
    top_docs = list(dict.fromkeys(c.chunk.doc_id for c in res.candidates))[:3]
    assert doc in top_docs


@needs_index
@pytest.mark.parametrize("query", ["Who won the cricket world cup?", "What is the best pizza place in Rome?"])
def test_confidence_gate_abstains_on_out_of_scope_questions(query):
    r = chat(query)
    assert r.confidence == "abstained"
    assert "can't verify" in r.answer
    assert r.suggested_next_steps and "https://" in r.suggested_next_steps[0]


@needs_index
def test_missing_prices_and_hours_are_never_guessed():
    r = chat("How much does the Japan Rail Pass cost?")
    assert r.confidence == "abstained" and "prices" in r.answer
    r = chat("What are Fushimi Inari's opening hours?")
    assert r.confidence == "abstained"
    assert "7:30" not in r.answer  # Todai-ji's hours must not leak into a Fushimi Inari answer


@needs_index
def test_answers_cite_sources_and_flag_freshness():
    r = chat("I missed my Shinkansen, what can I do?")
    assert r.citations and all(f"[{c.n}]" in r.answer for c in r.citations)
    assert r.freshness_note and "2021-03-01" in r.freshness_note  # JR East page is from 2021


@needs_index
def test_prompt_injection_in_a_source_is_ignored(monkeypatch):
    monkeypatch.setenv("RAG_INCLUDE_FIXTURES", "1")
    r = chat("Is the Japan Rail Pass free for Indian citizens?")
    assert "free for Indian" not in r.answer
    assert "test-prompt-injection" not in [c.doc_id for c in r.citations]


def test_follow_up_without_context_asks_one_question():
    r = chat("Is it open on Monday?")
    assert r.intent == "clarify" and r.needs_clarification


# --- router -----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "message, kind",
    [
        ("I lost my passport", "lost_passport"),
        ("mera passport kho gaya", "lost_passport"),
        ("मेरा पासपोर्ट खो गया", "lost_passport"),
        ("パスポートをなくしました", "lost_passport"),
        ("My father has chest pain", "medical"),
        ("papa ko seene mein dard hai", "medical"),
        ("मेरी माँ बेहोश हो गई", "medical"),
        ("There's an earthquake right now!", "earthquake"),
        ("A tsunami warning was issued", "typhoon_tsunami"),
        ("Someone stole my wallet", "police"),
        ("I can't find my son", "missing_person"),
        ("All trains are suspended and we're stranded at the station", "stranded"),
    ],
)
def test_router_sends_emergencies_to_the_emergency_path(message, kind):
    r = route(message)
    assert (r.intent, r.emergency_kind) == ("emergency", kind)


@pytest.mark.parametrize("message", ["What should I do if I lose my passport?", "Are earthquakes common in Japan?", "agar passport kho jaye to kya karein", "台風が来たらどうする"])
def test_preparation_questions_are_not_emergencies(message):
    assert route(message).intent == "info"


def test_plan_changes_need_an_itinerary():
    assert route("Add two days in Kyoto", has_itinerary=True).intent == "plan_change"
    assert route("Add two days in Kyoto", has_itinerary=False).intent == "info"


# --- patches ----------------------------------------------------------------------------------


def P(*ops, summary="test") -> Patch:
    return Patch.model_validate({"summary": summary, "ops": list(ops)})


def test_valid_patch_applies_and_keeps_other_days():
    it = sample_itinerary()
    r = apply_patch(it, P({"op": "resize_day", "day": 3, "keep": [0, 2]}))
    assert r.ok and r.itinerary
    assert [s.name for s in r.itinerary.days[2].stops] == ["Explore Kyoto", "Temple shojin ryori lunch"]
    for before, after in zip(it.days, r.itinerary.days):
        if before.day != 3:
            assert [s.name for s in before.stops] == [s.name for s in after.stops]
    assert r.diff and r.diff.removed_stops == 1


@pytest.mark.parametrize(
    "op, needle",
    [
        ({"op": "add_day", "after_day": 1, "cityId": "atlantis", "title": "x", "stops": [{"name": "x", "kind": "sight"}]}, "not a city"),
        ({"op": "remove_stop", "day": 1, "index": 7}, "no stop number"),
        ({"op": "remove_day", "day": 9}, "not in this itinerary"),
        ({"op": "resize_day", "day": 1, "keep": [5]}, "doesn't have"),
    ],
)
def test_invalid_patches_are_rejected(op, needle):
    r = apply_patch(sample_itinerary(), P(op))
    assert not r.ok and needle in " ".join(r.errors)


def test_schema_invalid_or_infeasible_patches_are_rejected():
    stop = {"name": "Extra", "kind": "sight"}
    too_many = [{"op": "add_stop", "day": 1, "stop": stop} for _ in range(7)]
    r = apply_patch(sample_itinerary(), P(*too_many))
    assert not r.ok  # more than 8 stops in a day fails the schema
    with pytest.raises(Exception):
        P({"op": "teleport", "day": 1})
    r = apply_patch(sample_itinerary(), P(*[{"op": "remove_stop", "day": 1, "index": 0} for _ in range(3)]))
    assert not r.ok and "no stops" in " ".join(r.errors)


def test_pinned_items_are_never_changed_without_permission():
    it = sample_itinerary()
    pinned = {pin_key("tokyo", "Enoshima, Kanagawa")}
    for op in ({"op": "remove_stop", "day": 1, "index": 1}, {"op": "resize_day", "day": 1, "keep": [0]}, {"op": "remove_day", "day": 1}):
        r = apply_patch(it, P(op), pinned)
        assert not r.ok and "pinned" in " ".join(r.errors)
    assert apply_patch(it, P({"op": "remove_stop", "day": 1, "index": 1}), pinned, allow_pinned=True).ok


def test_rule_based_lighter_day_keeps_pinned_and_food():
    c = ctx(pinned=[pin_key("kyoto", "Joruri-ji, Kyoto")])
    r = chat("Make today lighter, we are tired", c)
    assert r.intent == "plan_change" and r.proposed_patch
    kept = [s["name"] for d in r.proposed_patch["diff"]["days"] if d["cityId"] == "kyoto" for s in d["stops"] if s["status"] == "kept"]
    assert "Joruri-ji, Kyoto" in kept and "Temple shojin ryori lunch" in kept


def test_booking_changes_are_never_claimed():
    r = chat("Remove day 2 and change my hotel booking", ctx())
    assert r.proposed_patch
    assert "change or cancel it with the provider" in r.answer.lower() or "can't change real bookings" in r.answer.lower()
    assert not A.BOOKING_CLAIM.search(r.answer)


# --- API: apply, undo, trip data, sources -----------------------------------------------------


def test_apply_then_undo_restores_the_itinerary(api):
    it = sample_itinerary()
    body = {"session_id": "undo-session", "itinerary": it.model_dump(mode="json"), "patch": {"summary": "x", "ops": [{"op": "remove_day", "day": 5}]}}
    r = api.post("/api/assistant/apply-patch", json=body)
    assert r.status_code == 200
    assert len(r.json()["itinerary"]["days"]) == 4
    token = r.json()["undo_token"]
    u = api.post("/api/assistant/undo", json={"session_id": "undo-session", "undo_token": token})
    assert u.status_code == 200 and len(u.json()["itinerary"]["days"]) == 5
    again = api.post("/api/assistant/undo", json={"session_id": "undo-session", "undo_token": token})
    assert again.status_code == 404


def test_invalid_patch_is_a_400_with_reasons(api):
    body = {"session_id": "undo-session", "itinerary": sample_itinerary().model_dump(mode="json"), "patch": {"summary": "x", "ops": [{"op": "remove_day", "day": 9}]}}
    r = api.post("/api/assistant/apply-patch", json=body)
    assert r.status_code == 400 and r.json()["error"]["code"] == "invalid_patch"


def test_identifiers_are_never_persisted(api):
    c = ctx(bookings=[Fact[Booking](value=Booking(kind="hotel", provider="Inn", details="Card 4111 1111 1111 1111"), provenance="user-provided")])
    req = {"message": "My passport number is K1234567 and I lost it", "session_id": "privacy-session", "trip_context": c.model_dump(mode="json")}
    r = api.post("/api/assistant/chat", json=req)
    assert r.status_code == 200
    data = r.json()
    assert any("didn't save the passport number" in n for n in data["notices"])
    stored = api.get("/api/trip-data", params={"session_id": "privacy-session"}).json()
    dumped = json.dumps(stored)
    assert "K1234567" not in dumped and "4111" not in dumped
    assert stored["stored_on_server"] is True
    assert api.delete("/api/trip-data", params={"session_id": "privacy-session"}).json() == {"deleted": True}
    assert api.get("/api/trip-data", params={"session_id": "privacy-session"}).json()["trip_context"] is None


def test_scrub_catches_common_identifiers():
    text, found = scrub("passport no: Z9876543, PAN ABCDE1234F, Aadhaar 1234 5678 9012, card 4111-1111-1111-1111")
    assert set(found) == {"passport number", "PAN number", "Aadhaar number", "card number"}
    assert "9876543" not in text and "ABCDE1234F" not in text and "4111" not in text
    assert scrub("Call 9876543210 at 10:30")[1] == []  # phone numbers and times are not identifiers


def test_diet_update_is_remembered():
    r = chat("Actually we eat Jain food now", ctx(diet=Fact[DietProfile](value=DietProfile(diet="vegetarian"), provenance="user-provided")))
    assert r.trip_context and r.trip_context.diet_name() == "jain"
    assert r.trip_context.diet.provenance == "user-provided"


def test_chat_endpoint_validates_and_rate_limits(api, monkeypatch):
    assert api.post("/api/assistant/chat", json={"message": "", "session_id": "abc123"}).status_code == 400
    assert api.post("/api/assistant/chat", json={"message": "hi", "session_id": "bad id!"}).status_code == 400
    from app.ratelimit import RateLimiter

    monkeypatch.setattr(main, "chat_limiter", RateLimiter(1))
    assert api.post("/api/assistant/chat", json={"message": "hi", "session_id": "rate-session"}).status_code == 200
    r = api.post("/api/assistant/chat", json={"message": "hi", "session_id": "rate-session"})
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_knowledge_sources_lists_status_and_staleness(api):
    docs = api.get("/api/knowledge/sources").json()["documents"]
    assert len(docs) >= 30
    jr = next(d for d in docs if d["id"] == "transport-jr-east-missed-train")
    assert jr["stale"] is True and jr["status"] == "needs-review"


# --- emergency and live tools ----------------------------------------------------------------


def test_emergency_path_works_offline(monkeypatch):
    def broken():
        raise RuntimeError("index down")

    monkeypatch.setattr(assistant, "get_retriever", broken)
    r = chat("I lost my passport", ctx())
    assert r.intent == "emergency" and r.emergency
    labels = [c.label for c in r.emergency.contacts]
    assert any("Osaka-Kobe" in l for l in labels)  # day 3 is Kyoto → Osaka consulate
    assert not any("Tokyo (emergency)" in l for l in labels)
    assert r.emergency.urgent_action.startswith("Report the loss")
    assert "replan" in r.emergency.replan_prompt


def test_emergency_data_is_sourced_and_flagged():
    data = load_emergency()
    assert data["status"] == "needs-review"
    assert {n["value"] for n in data["numbers"]} >= {"110", "119"}
    for n in data["numbers"] + data["missions"]:
        assert n["source_url"].startswith("https://")
    for kind, s in data["situations"].items():
        assert s["sources"] and all(u.startswith("https://") for u in s["sources"]), kind
        assert len(s["steps"]) == len(s["steps_hi"]), kind


def test_hindi_emergency_answers_in_hindi():
    p = build_emergency("medical", ["tokyo"], "hi")
    assert "119" in p.urgent_action and any("ऀ" <= ch <= "ॿ" for ch in p.urgent_action)


def test_live_tools_are_honest_when_not_connected(monkeypatch):
    monkeypatch.delenv("WEATHER_PROVIDER", raising=False)
    w = get_weather("tokyo")
    assert w["status"] == "not_connected" and "jma.go.jp" in w["link"]
    t = get_transit_status("Tokaido Shinkansen")
    assert t["status"] == "not_connected" and "official" in t["message"]
    h = get_attraction_hours("Kiyomizu-dera")
    assert h["status"] == "unverified"


# --- live answer validation (fake Claude) ------------------------------------------------------


@needs_index
def test_live_answers_are_validated_and_retried(fake):
    def ans(text, sources, kind="fact"):
        return json.dumps({"statements": [{"text": text, "kind": kind, "sources": sources}], "next_steps": [], "needs_clarification": None, "abstain": False, "abstain_reason": None})

    bad = ans("The JR Pass costs 50,000 yen.", [1])  # number not in any source → rejected
    good = ans("Indian nationals need a visa even for a short-term stay.", [1])
    client = fake(FakeStream(chunked(bad)), FakeStream(chunked(good)))
    req = ChatRequest(message="Do I need a visa for Japan with an Indian passport?", session_id="live-session")
    r = asyncio.run(assistant.handle(req, client))
    assert r.mode == "live"
    assert "need a visa" in r.answer and "50,000" not in r.answer
    assert len(client.calls) == 2
    assert "<source" in client.calls[0]["messages"][0]["content"]
    assert "untrusted DATA" in client.calls[0]["system"][0]["text"]


@needs_index
def test_live_failure_falls_back_to_quoted_sources_with_a_label(fake):
    client = fake(FakeStream(['{"broken']), FakeStream(['{"also broken']))
    req = ChatRequest(message="Can I bring mangoes from India?", session_id="live-session")
    r = asyncio.run(assistant.handle(req, client))
    assert r.mode == "demo" and r.mode_label == assistant.FALLBACK_LABEL
    assert r.citations


def test_validate_live_rejects_booking_claims_and_uncited_facts():
    class C:
        def __init__(self, text):
            self.chunk = type("X", (), {"text": text})()

    sel = [C("Call 119 for an ambulance.")]
    assert not A.validate_live({"statements": [{"text": "Your hotel booking has been changed.", "kind": "suggestion", "sources": []}]}, sel, "q").ok
    assert not A.validate_live({"statements": [{"text": "Call 119.", "kind": "fact", "sources": []}]}, sel, "q").ok
    assert not A.validate_live({"statements": [{"text": "Call 119.", "kind": "fact", "sources": [3]}]}, sel, "q").ok
    assert A.validate_live({"statements": [{"text": "Call 119.", "kind": "fact", "sources": [1]}]}, sel, "q").ok


def test_live_plan_change_uses_tools_and_returns_a_validated_patch(monkeypatch):
    from tests.conftest import FakeClient

    turns = [
        [{"type": "tool_use", "id": "t1", "name": "search_places", "input": {"city_id": "kyoto", "indoor_only": True}}],
        [{"type": "tool_use", "id": "t2", "name": "propose_patch", "input": {"summary": "Swap the temple for an indoor museum", "ops": [
            {"op": "replace_stop", "day": 3, "index": 1, "stop": {"name": "Kyoto International Manga Museum", "kind": "anime", "foodSpotId": None, "heritageId": None, "note": ""}, "reason": "rain"}
        ]}}],
    ]
    client = FakeClient(creates=turns)
    monkeypatch.setattr(main, "client_override", client)
    r = asyncio.run(assistant.handle(ChatRequest(message="It's raining today, change my plan", session_id="live-plan", trip_context=ctx()), client))
    assert r.intent == "plan_change" and r.mode == "live"
    assert r.proposed_patch["patch"]["ops"][0]["op"] == "replace_stop"
    assert len(client.calls) == 2 and client.calls[0]["tools"][-1]["name"] == "propose_patch"
    # The tool result fed back to the model is our place data, not invented places.
    assert "Manga Museum" in json.dumps(client.calls[1]["messages"], default=str)


def test_live_plan_change_with_a_pinned_violation_falls_back_to_rules(monkeypatch):
    from tests.conftest import FakeClient

    bad = [{"type": "tool_use", "id": "t1", "name": "propose_patch", "input": {"summary": "x", "ops": [{"op": "remove_stop", "day": 3, "index": 1}]}}]
    client = FakeClient(creates=[bad, bad])
    c = ctx(pinned=[pin_key("kyoto", "Joruri-ji, Kyoto")])
    r = asyncio.run(assistant.handle(ChatRequest(message="It's raining today, change my plan", session_id="live-plan", trip_context=c), client))
    # The model twice tried to remove a pinned stop: we fall back and never touch it.
    assert r.mode_label == assistant.FALLBACK_LABEL
    if r.proposed_patch:
        assert all(not (o.get("day") == 3 and o.get("index") == 1) for o in r.proposed_patch["patch"]["ops"])
