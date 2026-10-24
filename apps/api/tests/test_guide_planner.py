"""Team-guide planner inputs: pace, start city, slots, meals, and the /api/planner/* aliases."""

from fastapi.testclient import TestClient

from app.data import load
from app.main import app
from app.prompts import plan_message
from app.sample import sample_plan
from app.schema import PACE_STOPS, PlanRequest, RawDay, RawStay, RawStop, RawTransport
from app.validate import ground_day

client = TestClient(app)


def test_pace_sets_stops_per_day_and_every_stop_has_a_slot():
    data = load()
    for pace, (lo, hi) in PACE_STOPS.items():
        plan = sample_plan(data, persona="family", diet="vegetarian", days=4, pace=pace)
        for d in plan.days:
            assert d.pace == pace
            assert len(d.stops) <= hi
            assert all(s.slot in {"morning", "afternoon", "evening"} for s in d.stops)
            # Slots run in visiting order.
            order = [("morning", "afternoon", "evening").index(s.slot) for s in d.stops]
            assert order == sorted(order)
            assert not [f for f in d.flags if f.code == "overpacked"]


def test_start_city_meals_and_coordinates():
    data = load()
    plan = sample_plan(data, persona="family", diet="jain", days=3, start_city="osaka")
    assert plan.days[0].cityId == "osaka"
    for d in plan.days:
        assert d.meals.breakfast and d.meals.lunch and d.meals.dinner
        assert "jain" in d.meals.breakfast
        for s in d.stops:
            if s.inOurData:
                assert s.lat is not None and s.lng is not None


def test_overpacked_follows_the_pace():
    data = load()
    stops = [RawStop(name=f"Stop {i}", kind="sight") for i in range(4)]
    raw = RawDay(
        day=1, cityId="tokyo", title="Busy", stops=stops,
        transport=RawTransport(mode="local-train"), stay=RawStay(type="hotel"), pace="relaxed",
    )
    flags = ground_day(raw, data, None).flags
    assert any(f.code == "overpacked" and "relaxed" in f.message for f in flags)
    fast = ground_day(raw.model_copy(update={"pace": "fast"}), data, None).flags
    assert not any(f.code == "overpacked" for f in fast)


def test_prompt_carries_the_structured_inputs():
    req = PlanRequest(
        prompt="Parents walk slowly", diet="jain", diets=["vegan"], days=5, startCity="kyoto",
        travellers=3, pace="relaxed", budget="moderate", interests=["heritage", "nature"],
    )
    msg = plan_message(req, 5)
    for part in ("Start in: kyoto", "Number of travellers: 3", "Pace: relaxed", "Interests: heritage, nature", "vegan"):
        assert part in msg
    assert "\n\n\n" not in msg


def test_guide_generate_alias():
    r = client.post(
        "/api/planner/generate",
        json={
            "preferences": {
                "persona": "family", "durationDays": 5, "startingCity": "Tokyo", "numberOfTravellers": 3,
                "budgetRange": "moderate", "dietaryRestrictions": ["jain"], "interests": ["heritage", "nature"],
                "travelPace": "relaxed",
            },
            "customPrompt": "My parents walk slowly. We want to see Mount Fuji and visit temples.",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "sample"
    assert len(body["days"]) == 5
    assert body["days"][0]["cityId"] == "tokyo"
    assert all(d["pace"] == "relaxed" for d in body["days"])
    assert body["notices"], "a sample plan always says why it is a sample"


def test_guide_generate_validates_input():
    r = client.post("/api/planner/generate", json={"preferences": {"durationDays": 30}})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "bad_request"


def test_guide_regenerate_day_alias_in_demo_mode():
    trip = client.post("/api/planner/generate", json={"preferences": {"durationDays": 3}}).json()
    r = client.post("/api/planner/regenerate-day", json={"trip": trip, "dayNumber": 2, "instructions": "More temples"})
    # Demo mode has no AI to redesign a day, and says so (never a silent fake).
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "demo_mode"
    missing = client.post("/api/planner/regenerate-day", json={"trip": trip, "dayNumber": 9})
    assert missing.status_code == 400
