"""Team-guide routes: OCR text analysis (parity with the browser matcher), presets, restaurants, visa."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.ingredients import match_ingredients
from app.main import app

FIXTURE = Path(__file__).resolve().parents[2] / "web" / "src" / "data" / "__fixtures__" / "scanVerdicts.json"
client = TestClient(app)


def _cases():
    return json.loads(FIXTURE.read_text(encoding="utf8"))["cases"]


@pytest.mark.parametrize("case", _cases(), ids=lambda c: c["id"])
def test_matcher_agrees_with_the_browser(case):
    for diet, want in case["results"].items():
        got = match_ingredients(case["text"], diet)
        assert got.verdict == want["verdict"], (case["id"], diet)
        assert [m.ingredient.id for m in got.matches] == want["ids"], (case["id"], diet)
        assert [m.matched_by for m in got.matches] == want["matchedBy"], (case["id"], diet)
        assert got.unknown == want["unknown"], (case["id"], diet)


def test_analyze_returns_the_guide_shape():
    r = client.post(
        "/api/ocr/analyze",
        json={"rawText": "原材料名: 油揚げ、食塩、かつおエキス、醤油、ねぎ", "dietaryRestrictions": ["vegetarian", "jain"]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "potential_conflict"
    assert body["detectedLanguage"] == "jpn"
    bonito = next(d for d in body["detectedIngredients"] if d["match"]["id"] == "bonito")
    assert bonito["severity"] == "critical" and bonito["matchedBy"] == "kana"
    assert any("vegetarian" in reason and "jain" in reason for reason in body["conflictReasons"])
    assert "guarantee" in body["disclaimer"]
    assert body["practicalAdvice"][-1] == "Show the waiter card to staff."


def test_analyze_never_calls_unknown_text_clear():
    r = client.post("/api/ocr/analyze", json={"rawText": "Ingredients: graham crackers", "dietaryRestrictions": ["vegan"]})
    assert r.json()["status"] == "unable_to_verify"
    low = client.post(
        "/api/ocr/analyze",
        json={"rawText": "抹茶もち 原材料名：もち米、砂糖、抹茶", "dietaryRestrictions": ["vegetarian"], "ocrConfidence": 30},
    )
    assert low.json()["status"] == "unable_to_verify"


def test_analyze_accepts_guide_diet_names_and_rejects_images():
    ok = client.post("/api/ocr/analyze", json={"rawText": "牛丼", "dietaryRestrictions": ["no_beef"]})
    assert ok.json()["status"] == "potential_conflict"
    image = client.post("/api/ocr/analyze", files={"image": ("a.jpg", b"xx", "image/jpeg")})
    assert image.status_code == 415
    assert image.json()["error"]["code"] == "ocr_on_device"
    bad = client.post("/api/ocr/analyze", json={"rawText": ""})
    assert bad.status_code == 400


def test_presets_are_labelled_samples():
    body = client.get("/api/ocr/demo-presets").json()
    assert body["status"] == "sample"
    assert [p["id"] for p in body["presets"]] == [
        "pack-miso-soup", "pack-zaru-soba", "pack-rice-cracker", "pack-matcha-mochi",
    ]


def test_restaurants_filter_by_city_diet_and_search():
    body = client.get("/api/restaurants", params={"city": "Tokyo", "dietary": "vegetarian,jain"}).json()
    assert body["count"] > 0
    for r in body["restaurants"]:
        assert r["cityId"] == "tokyo"
        diets = {o["diet"] for o in r["dietOptions"]}
        assert {"vegetarian", "jain"} <= diets
        assert r["status"] != "verified"
    none = client.get("/api/restaurants", params={"search": "zzzz-no-such-place"}).json()
    assert none["count"] == 0
    assert "certified" in client.get("/api/restaurants").json()["note"].lower()


def test_visa_checklist_keeps_guide_figures_labelled():
    body = client.get("/api/visa/checklist").json()
    assert body["status"] == "needs-review"
    assert body["types"]["source"] == "team-guide"
    assert body["finance"]["source"] == "team-guide"
    assert all(i["source"] in {"team-guide", "official-summary"} for i in body["items"])
    assert "not immigration advice" in body["disclaimer"]
