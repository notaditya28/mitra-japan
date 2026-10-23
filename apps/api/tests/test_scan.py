"""POST /api/scan-explain: Claude explains the matcher's verdict, never changes it."""

from __future__ import annotations

import json

from tests.conftest import FakeStream, chunked

BODY = {
    "menuText": "野菜ラーメン：かつお出汁、味噌、ねぎ",
    "diet": "vegetarian",
    "language": "en",
    "verdict": "conflict",
    "matches": [{"term": "かつお出汁", "en": "Bonito (fish) stock", "rule": "avoid"}],
}


def answer(explanation: str = "The broth is made with bonito, a fish.", ask_en: str = "Can you make it without bonito stock?") -> str:
    return json.dumps(
        {"explanation": explanation, "askStaffJa": "かつお出汁なしで作れますか？", "askStaffEn": ask_en},
        ensure_ascii=False,
    )


def test_demo_mode_says_so_with_503(api):
    r = api.post("/api/scan-explain", json=BODY)
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "demo_mode"


def test_valid_explanation_is_returned_with_the_verdict_in_the_prompt(api, fake):
    client = fake(FakeStream(chunked(answer())))
    r = api.post("/api/scan-explain", json=BODY)
    assert r.status_code == 200
    assert r.json()["askStaffJa"].startswith("かつお")
    sent = client.calls[0]
    assert '"verdict": "conflict"' in sent["messages"][0]["content"]
    assert "never change it" in sent["system"][0]["text"]
    assert sent["output_config"]["format"]["type"] == "json_schema"


def test_overclaiming_answers_are_rejected_then_reported_as_502(api, fake):
    bad = answer(explanation="This dish is safe for you.")
    fake(FakeStream([bad]), FakeStream([bad]))
    r = api.post("/api/scan-explain", json=BODY)
    assert r.status_code == 502
    assert r.json()["error"]["code"] == "ai_invalid"


def test_invalid_json_is_retried_once(api, fake):
    client = fake(FakeStream(['{"explanation": 1']), FakeStream(chunked(answer())))
    assert api.post("/api/scan-explain", json=BODY).status_code == 200
    assert len(client.calls) == 2


def test_bad_input_is_a_400(api):
    r = api.post("/api/scan-explain", json={**BODY, "verdict": "safe"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "bad_request"
    assert api.post("/api/scan-explain", json={**BODY, "menuText": "x" * 3000}).status_code == 400
