"""Demo-mode sample itineraries: labelled, grounded, diet-aware, never overclaiming."""

from __future__ import annotations

import json

from app.data import load
from app.sample import sample_plan


def test_sample_respects_days_and_is_labelled():
    it = sample_plan(load(), persona="family", diet="jain", days=4)
    assert it.source == "sample" and it.model is None
    assert [d.day for d in it.days] == [1, 2, 3, 4]


def test_sample_only_suggests_food_places_that_suit_the_diet():
    data = load()
    it = sample_plan(data, persona="foodie", diet="halal", days=5)
    for d in it.days:
        for s in d.stops:
            if s.foodSpotId:
                assert "halal" in data.food[s.foodSpotId].diets


def test_sample_never_claims_certification_or_exact_schedules():
    text = json.dumps(sample_plan(load(), persona="spiritual", diet="vegan", days=7).model_dump()).lower()
    for word in ("certified", "guaranteed", "100% safe", "opening hours", "¥"):
        assert word not in text


def test_family_pace_is_gentle():
    it = sample_plan(load(), persona="family", diet="vegetarian", days=5)
    assert all(len(d.stops) <= 3 for d in it.days)


def test_catalogue_separates_sample_places_from_real_unconfirmed_ones():
    from app.prompts import catalogue

    places = json.loads(catalogue(load()))["foodPlaces"]
    statuses = {p["status"] for p in places}
    assert statuses == {"sample", "needs-review"}
    assert not any("certified" in json.dumps(p).lower() for p in places)
