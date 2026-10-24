"""Ingredient matcher for POST /api/ocr/analyze.

A line-for-line port of apps/web/src/features/scanner/matchIngredients.ts, reading the same
ingredients.json, so the browser and the API give the same verdicts (checked against
apps/web/src/data/__fixtures__/scanVerdicts.json in tests/test_ocr_api.py). OCR itself stays
on the device; this only judges text.
"""

from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Literal

from .config import settings

Rule = Literal["avoid", "ask"]
Verdict = Literal["clear", "conflict", "unverified"]
MatchedBy = Literal["kanji", "kana", "romaji", "english", "custom"]
Severity = Literal["critical", "warning", "info"]

JAPANESE = re.compile(r"[぀-ヿ㐀-鿿]")
JAPANESE_CHAR = re.compile(r"^[぀-ヿ㐀-鿿]$")
KANJI = re.compile(r"[㐀-鿿]")
LATIN = re.compile(r"[a-z]", re.I)
SEPARATOR = re.compile(r"[、，,・／/\s()（）「」『』【】［］\[\]。.:：;；]")


@dataclass(frozen=True)
class Ingredient:
    id: str
    terms: tuple[str, ...]
    romaji: tuple[str, ...]
    english: tuple[str, ...]
    en: str
    category: str
    rules: dict[str, str]
    note: str
    ambiguity: str


@dataclass
class Match:
    ingredient: Ingredient
    term: str
    index: int
    rule: str | None
    matched_by: str
    severity: str


@dataclass
class ScanResult:
    matches: list[Match]
    verdict: str
    unknown: list[str] = field(default_factory=list)
    reason: str | None = None


@dataclass(frozen=True)
class Dictionary:
    ingredients: tuple[Ingredient, ...]
    terms: tuple[tuple[str, Ingredient, str], ...]
    latin_terms: tuple[tuple[str, Ingredient, str], ...]
    menu_words: tuple[str, ...]
    latin_stop: frozenset[str]


@lru_cache(maxsize=1)
def dictionary() -> Dictionary:
    with open(settings.data_dir / "ingredients.json", encoding="utf8") as f:
        raw = json.load(f)
    items = tuple(
        Ingredient(
            id=e["id"], terms=tuple(e["terms"]), romaji=tuple(e.get("romaji", [])),
            english=tuple(e.get("english", [])), en=e["en"], category=e["category"],
            rules=dict(e["rules"]), note=e.get("note", ""), ambiguity=e.get("ambiguity", ""),
        )
        for e in raw["ingredients"]
    )
    by_script = lambda t: "kanji" if KANJI.search(t) else "kana"  # noqa: E731
    terms = sorted(((t, i, by_script(t)) for i in items for t in i.terms), key=lambda x: -len(x[0]))
    latin = sorted(
        [(t, i, "romaji") for i in items for t in i.romaji] + [(t, i, "english") for i in items for t in i.english],
        key=lambda x: -len(x[0]),
    )
    return Dictionary(
        ingredients=items,
        terms=tuple(terms),
        latin_terms=tuple(latin),
        menu_words=tuple(sorted(raw["menuWords"]["terms"], key=len, reverse=True)),
        latin_stop=frozenset(raw["latinWords"]["terms"]),
    )


def severity_for(rule: str | None) -> str:
    return "critical" if rule == "avoid" else "warning" if rule == "ask" else "info"


def _fold_latin(text: str) -> str:
    """Lower-case and strip accents one character at a time, keeping positions aligned."""
    out = []
    for ch in text:
        base = "".join(c for c in unicodedata.normalize("NFKD", ch) if not unicodedata.combining(c)).lower()
        out.append(base[:1] or ch)
    return "".join(out)


def _is_word_char(s: str, i: int) -> bool:
    return 0 <= i < len(s) and "a" <= s[i] <= "z"


def _custom(term: str, label: str) -> Ingredient:
    return Ingredient(f"custom:{term}", (term,), (), (), label, "custom", {}, "Your own restriction.", "")


def match_ingredients(text: str, diet: str, custom: list[tuple[str, str]] | None = None) -> ScanResult:
    d = dictionary()
    if not JAPANESE.search(text) and not LATIN.search(text):
        return ScanResult(matches=[], verdict="unverified", unknown=[], reason="unreadable")

    taken = [False] * len(text)
    matches: list[Match] = []
    customs = [(t.strip(), _custom(t.strip(), label), "custom") for t, label in (custom or []) if t.strip()]
    all_terms = sorted([*customs, *d.terms], key=lambda x: -len(x[0]))

    def record(ing: Ingredient, term: str, index: int, by: str) -> None:
        rule = "avoid" if by == "custom" else ing.rules.get(diet)
        matches.append(Match(ing, term, index, rule, by, severity_for(rule)))

    for term, ing, by in all_terms:
        start = 0
        while True:
            index = text.find(term, start)
            if index == -1:
                break
            start = index + len(term)
            if any(taken[index : index + len(term)]):
                continue
            for k in range(index, index + len(term)):
                taken[k] = True
            record(ing, term, index, by)

    folded = _fold_latin(text)
    for term, ing, by in d.latin_terms:
        start = 0
        while True:
            index = folded.find(term, start)
            if index == -1:
                break
            start = index + len(term)
            end = index + len(term)
            if _is_word_char(folded, index - 1) or _is_word_char(folded, end):
                continue
            if any(taken[index:end]):
                continue
            for k in range(index, end):
                taken[k] = True
            record(ing, text[index:end], index, by)

    matches.sort(key=lambda m: m.index)
    unknown = _unknown_words(text, taken, d) + _unknown_latin(folded, taken, d)
    verdict = verdict_for(matches)
    deduped = _dedupe(matches)
    if verdict == "clear" and unknown:
        return ScanResult(matches=deduped, verdict="unverified", unknown=unknown, reason="unknown")
    return ScanResult(matches=deduped, verdict=verdict, unknown=unknown)


def _unknown_words(text: str, taken: list[bool], d: Dictionary) -> list[str]:
    covered = list(taken)
    skip = [False] * len(text)
    line_start = 0
    for line in text.split("\n"):
        m = re.search(r"[：:]", line)
        if m and m.start() > 0:
            for k in range(line_start, line_start + m.start()):
                skip[k] = True
        line_start += len(line) + 1
    for word in d.menu_words:
        start = 0
        while True:
            i = text.find(word, start)
            if i == -1:
                break
            start = i + len(word)
            if not any(covered[i : i + len(word)]):
                for k in range(i, i + len(word)):
                    covered[k] = True
    words: list[str] = []
    current = ""
    for i, ch in enumerate(text):
        if SEPARATOR.match(ch) or covered[i] or skip[i] or not JAPANESE_CHAR.match(ch):
            if current:
                words.append(current)
            current = ""
        else:
            current += ch
    if current:
        words.append(current)
    return list(dict.fromkeys(words))


def _unknown_latin(folded: str, taken: list[bool], d: Dictionary) -> list[str]:
    words: list[str] = []
    current = ""
    touched = False
    for i in range(len(folded) + 1):
        if i < len(folded) and _is_word_char(folded, i):
            current += folded[i]
            touched = touched or taken[i]
            continue
        if len(current) > 1 and not touched and current not in d.latin_stop:
            words.append(current)
        current = ""
        touched = False
    return list(dict.fromkeys(words))


def _dedupe(matches: list[Match]) -> list[Match]:
    seen: set[str] = set()
    out = []
    for m in matches:
        if m.ingredient.id not in seen:
            seen.add(m.ingredient.id)
            out.append(m)
    return out


def verdict_for(matches: list[Match]) -> str:
    if any(m.rule == "avoid" for m in matches):
        return "conflict"
    if any(m.rule == "ask" for m in matches):
        return "unverified"
    return "clear"
