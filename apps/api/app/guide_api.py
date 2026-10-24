"""Routes from the team's system guide (MITRA_JAPAN_SYSTEM_GUIDE.md, section 5).

Owner decision (2026-10-24): keep our FastAPI stack and on-device OCR, and offer the guide's
endpoints as aliases on top of it:
  POST /api/ocr/analyze        judge ingredient text (OCR runs in the browser, so send text)
  GET  /api/ocr/demo-presets   the packaging presets
  GET  /api/restaurants        filter restaurants by city, diet and search terms
  GET  /api/visa/checklist     the visa readiness data
The planner aliases (/api/planner/generate, /api/planner/regenerate-day) live in main.py,
next to the routes they wrap.
"""

from __future__ import annotations

import json
import unicodedata
from functools import lru_cache
from typing import Literal

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .config import settings
from .ingredients import Match, ScanResult, match_ingredients

router = APIRouter()

GuideDiet = Literal["jain", "vegetarian", "vegan", "halal", "no_beef", "no-beef", "eggless", "custom"]
DISCLAIMER = (
    "OCR and ingredient lists cannot show unlisted cooking oils, shared fryers or shared equipment, "
    "and recipes change. This is not a guarantee; ask the staff and show the waiter card."
)
WORST = {"conflict": 2, "unverified": 1, "clear": 0}
STATUS = {"clear": "no_conflicts", "conflict": "potential_conflict", "unverified": "unable_to_verify"}


@lru_cache(maxsize=None)
def _json(name: str) -> dict:
    with open(settings.data_dir / name, encoding="utf8") as f:
        return json.load(f)


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


class CustomTerm(BaseModel):
    model_config = ConfigDict(extra="forbid")
    term: str = Field(min_length=1, max_length=40)
    label: str = Field(default="", max_length=60)


class AnalyzeRequest(BaseModel):
    """The guide sends an image; our OCR runs on the device, so this takes the recognised text."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    raw_text: str = Field(alias="rawText", min_length=1, max_length=4000)
    dietary_restrictions: list[GuideDiet] = Field(
        default_factory=lambda: ["vegetarian"], alias="dietaryRestrictions", min_length=1, max_length=7
    )
    custom: list[CustomTerm] = Field(default_factory=list, max_length=20)
    ocr_confidence: float | None = Field(default=None, alias="ocrConfidence", ge=0, le=100)

    @field_validator("dietary_restrictions")
    @classmethod
    def normalise(cls, v: list[str]) -> list[str]:
        out = ["no-beef" if d == "no_beef" else d for d in v if d != "custom"]
        return list(dict.fromkeys(out)) or ["vegetarian"]


def _language(text: str) -> str:
    jp = any("぀" <= c <= "ヿ" or "㐀" <= c <= "鿿" for c in text)
    en = any(c.isascii() and c.isalpha() for c in text)
    return "jpn+eng" if jp and en else "jpn" if jp else "eng" if en else "unknown"


def _notes(result: ScanResult, low_confidence: bool) -> list[str]:
    notes: list[str] = []
    if result.reason == "unreadable":
        notes.append("No readable text. Try a sharper photo, or type the ingredients.")
    if low_confidence:
        notes.append("The photo was hard to read; check the text before trusting the result.")
    for m in result.matches:
        if m.rule == "ask" and m.ingredient.ambiguity:
            notes.append(f"{m.term}: {m.ingredient.ambiguity}")
    if result.unknown:
        notes.append("Words not in our dictionary: " + "、".join(result.unknown[:6]) + ".")
    return list(dict.fromkeys(notes))


def _advice(verdict: str, ids: set[str], diets: list[str]) -> list[str]:
    out: list[str] = []
    if verdict == "conflict":
        out.append("Choose something else, or ask whether the kitchen can make it without the flagged ingredient.")
    if verdict == "unverified":
        out.append("Ask the staff before you order; the result depends on how the kitchen makes it.")
    if ids & {"dashi", "bonito", "niboshi", "tsuyu"}:
        out.append("Ask whether the stock is kombu (kelp) or shiitake dashi instead of bonito or sardine.")
    if "jain" in diets and ids & {"onion", "garlic", "root-veg"}:
        out.append("Ask for no onion, garlic, leeks or root vegetables.")
    if "halal" in diets and ids & {"alcohol", "soy-sauce", "miso"}:
        out.append("Ask whether mirin or sake is used; soy sauce and miso can contain alcohol.")
    if ids & {"seasoning-generic", "emulsifier", "colouring"}:
        out.append("Additives like seasoning (amino acids), emulsifiers and colouring can be animal-based.")
    out.append("Show the waiter card to staff.")
    return out


def _match_json(m: Match) -> dict:
    return {
        "term": m.term,
        "match": {"id": m.ingredient.id, "english": m.ingredient.en, "category": m.ingredient.category},
        "matchedBy": m.matched_by,
        "severity": m.severity,
    }


@router.post("/api/ocr/analyze")
async def ocr_analyze(request: Request):
    if request.headers.get("content-type", "").startswith("multipart/"):
        return _error(
            415,
            "ocr_on_device",
            "OCR runs on the traveller's device so photos never leave it. Send the recognised text as JSON "
            "({\"rawText\": ..., \"dietaryRestrictions\": [...]}).",
        )
    try:
        req = AnalyzeRequest.model_validate(await request.json())
    except ValueError as e:
        return _error(400, "bad_request", str(e).splitlines()[0][:300])

    text = unicodedata.normalize("NFC", req.raw_text)
    custom = [(c.term, c.label or c.term) for c in req.custom]
    per_diet = {d: match_ingredients(text, d, custom) for d in req.dietary_restrictions}
    low = req.ocr_confidence is not None and req.ocr_confidence < 60
    worst = max(per_diet.values(), key=lambda r: WORST[r.verdict])
    verdict = "unverified" if low else worst.verdict

    detected: dict[str, dict] = {}
    reasons: list[str] = []
    for diet, r in per_diet.items():
        for m in r.matches:
            entry = detected.setdefault(m.ingredient.id, _match_json(m))
            # The most severe reading across the chosen diets.
            if ["info", "warning", "critical"].index(m.severity) > ["info", "warning", "critical"].index(entry["severity"]):
                entry["severity"] = m.severity
    for m in worst.matches:
        conflicts = [d for d, r in per_diet.items() for x in r.matches if x.ingredient.id == m.ingredient.id and x.rule == "avoid"]
        if conflicts:
            reasons.append(f"Contains {m.ingredient.en} ({m.term}), which conflicts with: {', '.join(conflicts)}.")
    reasons = list(dict.fromkeys(reasons))
    ids = set(detected)

    return {
        "rawText": req.raw_text,
        "detectedLanguage": _language(text),
        "status": STATUS[verdict],
        "detectedIngredients": list(detected.values()),
        "conflictReasons": reasons,
        "uncertaintyNotes": _notes(worst, low) + ([] if verdict == "conflict" else [
            "The text can't show unlisted cooking oils, shared fryers or shared equipment."
        ]),
        "practicalAdvice": _advice(verdict, ids, req.dietary_restrictions),
        "unknownWords": worst.unknown,
        "disclaimer": DISCLAIMER,
    }


@router.get("/api/ocr/demo-presets")
def ocr_presets():
    scans = _json("sampleScans.json")["scans"]
    return {
        "status": "sample",
        "note": "Illustrative packaging text for trying the scanner; not copied from real products.",
        "presets": [
            {"id": s["id"], "ja": s["ja"], "en": s["en"], "rawText": s["menuText"]} for s in scans if s.get("preset")
        ],
    }


def _fold(s: str) -> str:
    return unicodedata.normalize("NFKC", s or "").lower()


@router.get("/api/restaurants")
def restaurants(
    city: str | None = Query(default=None, max_length=40),
    dietary: str | None = Query(default=None, max_length=120),
    search: str | None = Query(default=None, max_length=120),
):
    data = _json("restaurants.json")["restaurants"]
    cities = {c["id"]: c for c in _json("cities.json")["cities"]}
    diets = [("no-beef" if d.strip() == "no_beef" else d.strip()) for d in (dietary or "").split(",") if d.strip()]
    want_city = _fold(city) if city else None
    terms = _fold(search).split() if search else []
    out = []
    for r in data:
        c = cities.get(r["cityId"], {})
        if want_city and want_city not in {_fold(r["cityId"]), _fold(c.get("name", "")), _fold(c.get("nameJa", ""))}:
            continue
        options = {o["diet"] for o in r["dietOptions"]}
        if diets and not all(d in options for d in diets):
            continue
        hay = _fold(" ".join(str(x) for x in (r["name"], r.get("nameJa"), r["cuisine"], r["area"], r.get("address"), c.get("name"))))
        if not all(t in hay for t in terms):
            continue
        out.append(r)
    order = {"verified": 0, "needs-review": 1, "sample": 2}
    out.sort(key=lambda r: (order.get(r["status"], 3), r["name"]))
    return {
        "note": "Real places are needs-review (details unconfirmed); samples are illustrative kinds of places. Nothing is certified.",
        "count": len(out),
        "restaurants": out,
    }


@router.get("/api/visa/checklist")
def visa_checklist():
    v = _json("visa.json")
    return {
        "disclaimer": "Preparation help, not immigration advice. Lines with source 'team-guide' come from our team guide and need review; confirm everything with the official links.",
        **{k: v[k] for k in ("status", "lastReviewed", "researched", "guideNote", "links", "purposes", "travellers", "categories", "items", "types", "finance", "jurisdictions", "pitfalls")},
    }
