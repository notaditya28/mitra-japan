"""Scanner explanations: Claude puts our matcher's result into friendly words.

The verdict always comes from the rule-based matcher in the browser. Claude
only explains it and drafts a question for staff; it may not change the
verdict, call anything safe, or add ingredients that were not listed.
"""

from __future__ import annotations

import json
import re
from typing import Any, Literal

from pydantic import Field, ValidationError

from .planner import UpstreamError, _stream_json, get_client
from .config import settings
from .data import PlaceData
from .schema import Diet, Language, Strict

Verdict = Literal["clear", "conflict", "unverified"]
Rule = Literal["avoid", "ask"]


class Flagged(Strict):
    term: str = Field(min_length=1, max_length=40)
    en: str = Field(min_length=1, max_length=80)
    rule: Rule | None = None


class CustomTerm(Strict):
    term: str = Field(min_length=1, max_length=40)
    label: str = Field(min_length=1, max_length=60)


class ScanExplainRequest(Strict):
    menuText: str = Field(min_length=1, max_length=2000)
    diet: Diet
    language: Language = "en"
    verdict: Verdict
    matches: list[Flagged] = Field(default_factory=list, max_length=40)
    unknown: list[str] = Field(default_factory=list, max_length=30)
    custom: list[CustomTerm] = Field(default_factory=list, max_length=10)


class ScanExplanation(Strict):
    explanation: str = Field(min_length=1, max_length=700)
    askStaffJa: str = Field(min_length=1, max_length=200)
    askStaffEn: str = Field(min_length=1, max_length=200)


SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["explanation", "askStaffJa", "askStaffEn"],
    "properties": {
        "explanation": {"type": "string"},
        "askStaffJa": {"type": "string"},
        "askStaffEn": {"type": "string"},
    },
}

RULES = """You help travellers from India understand a Japanese menu or food label that a rule-based
scanner has already checked. You explain the scanner's result; you never change it.

- The verdict is final: "clear" means no listed conflicts were detected in the text that could be
  read, "conflict" means a potential dietary conflict was detected, "unverified" means the scanner
  could not verify the dish (unreadable text, unknown words, or ambiguous broths and sauces).
- Never say a dish is safe, guaranteed, certified or 100% suitable, even when the verdict is clear.
  Always remind the traveller that menus can leave things out and recipes change.
- Only talk about ingredients that appear in the text or in the scanner's matches. Do not guess
  hidden ingredients beyond saying which listed items commonly hide others (dashi, tare, tsuyu…).
- Diets stay distinct: vegetarian is not Jain (Jain also avoids onion, garlic and root vegetables);
  halal avoids pork and alcohol including mirin and sake; vegan and no-beef are separate again.
- `explanation`: 2-4 short sentences in the traveller's language (en English, hi Hindi, gu Gujarati).
- `askStaffJa`: one polite, natural Japanese question for staff about the specific items that
  matter. `askStaffEn`: the same question in English."""

#: Words that would overstate certainty. Checked on the English fields.
OVERCLAIM = re.compile(r"\b(safe|guaranteed|certified|100\s*%)", re.IGNORECASE)


def _message(req: ScanExplainRequest) -> str:
    payload = req.model_dump(mode="json")
    return "Scanner result to explain:\n" + json.dumps(payload, ensure_ascii=False)


def _valid(text: str) -> ScanExplanation | None:
    try:
        out = ScanExplanation.model_validate_json(text)
    except (ValidationError, ValueError):
        return None
    # "not safe to assume" is fine; a bare "safe" claim is not. Keep it simple and strict.
    if OVERCLAIM.search(out.askStaffEn) or re.search(
        r"\b(is|are|looks|it's)\s+(safe|guaranteed|certified)", out.explanation, re.IGNORECASE
    ):
        return None
    return out


async def explain_scan(req: ScanExplainRequest, data: PlaceData, client: Any | None = None) -> ScanExplanation:
    if not settings.live and client is None:
        raise UpstreamError("demo_mode", "AI explanations are off in Demo mode.")
    client = client or get_client()
    system = [{"type": "text", "text": RULES, "cache_control": {"type": "ephemeral"}}]
    for _ in (1, 2):
        text = await _stream_json(client, data, SCHEMA, _message(req), system=system, max_tokens=2000)
        out = _valid(text)
        if out is not None:
            return out
    raise UpstreamError("ai_invalid", "The AI explanation could not be validated.")
