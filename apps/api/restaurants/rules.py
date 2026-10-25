"""Diet ids, statuses and diet rules, read from packages/shared (one source for all three apps)."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import settings

FULLY = "fully_verified"
PARTIAL = "partially_verified"
NOT_VERIFIED = "not_verified"
NOT_SUITABLE = "not_suitable"
STATUSES = (FULLY, PARTIAL, NOT_VERIFIED, NOT_SUITABLE)


@dataclass(frozen=True)
class Condition:
    """`field` has any of `values` (a list answer counts if it contains one)."""

    field: str
    values: frozenset[str]


@dataclass(frozen=True)
class Rule:
    id: str
    field: str
    reason: str
    conflict: frozenset[str] = frozenset()
    caution: frozenset[str] = frozenset()
    #: Extra answers this diet treats as missing (on top of the global unknown values).
    unknown: frozenset[str] = frozenset()
    #: Leaving the ingredient out on request fixes the conflict (needs dish.modifiable = yes).
    modifiable: bool = False
    #: The rule applies only when one of these holds (e.g. slaughter only matters for meat).
    when: tuple[Condition, ...] = ()
    #: If this holds, a conflict becomes a caution (e.g. separate utensils on request).
    unless: Condition | None = None
    #: Only under this strictness profile (Jain ginger).
    profile: str | None = None

    @property
    def kitchen(self) -> bool:
        return self.field.startswith("kitchen.")


@dataclass(frozen=True)
class DietRules:
    diet: str
    summary: str
    rules: tuple[Rule, ...]
    profiles: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class RuleBook:
    status: str
    version: int
    expiry_months: int
    stale_months: int
    jain_strictness: str
    fields: dict[str, dict[str, Any]]
    unknown_values: frozenset[str]
    diets: dict[str, DietRules]
    diet_labels: dict[str, str]
    status_labels: dict[str, dict[str, str]]
    methods: tuple[str, ...]
    paused_label: str

    def question(self, field_id: str) -> str:
        return str(self.fields.get(field_id, {}).get("question", field_id))


def _cond(raw: dict[str, Any]) -> Condition:
    return Condition(field=raw["field"], values=frozenset(raw["in"]))


def _rule(raw: dict[str, Any]) -> Rule:
    when = raw.get("when", {}).get("anyOf", [])
    return Rule(
        id=raw["id"],
        field=raw["field"],
        reason=raw["reason"],
        conflict=frozenset(raw.get("conflict", [])),
        caution=frozenset(raw.get("caution", [])),
        unknown=frozenset(raw.get("unknown", [])),
        modifiable=bool(raw.get("modifiable", False)),
        when=tuple(_cond(c) for c in when),
        unless=_cond(raw["unless"]) if raw.get("unless") else None,
        profile=raw.get("profile"),
    )


def build(rules_raw: dict[str, Any], diets_raw: dict[str, Any]) -> RuleBook:
    raw_diets: dict[str, Any] = rules_raw["diets"]

    def collect(diet: str, seen: tuple[str, ...] = ()) -> list[Rule]:
        if diet in seen:
            raise ValueError(f"diet_rules.json: circular 'extends' at {diet}")
        d = raw_diets[diet]
        parent = collect(d["extends"], seen + (diet,)) if d.get("extends") else []
        return parent + [_rule(r) for r in d.get("rules", [])]

    ids = [d["id"] for d in diets_raw["diets"]]
    missing = set(ids) ^ set(raw_diets)
    if missing:
        raise ValueError(f"diets.json and diet_rules.json disagree on: {sorted(missing)}")
    defaults = rules_raw.get("defaults", {})
    return RuleBook(
        status=rules_raw.get("status", "needs-review"),
        version=int(rules_raw.get("version", 1)),
        expiry_months=int(defaults.get("verificationExpiryMonths", 6)),
        stale_months=int(defaults.get("declarationStaleMonths", 6)),
        jain_strictness=str(defaults.get("jainStrictness", "strict")),
        fields=rules_raw["fields"],
        unknown_values=frozenset(rules_raw.get("unknownValues", ["unknown"])),
        diets={
            d: DietRules(diet=d, summary=raw_diets[d]["summary"], rules=tuple(collect(d)), profiles=raw_diets[d].get("profiles", {}))
            for d in ids
        },
        diet_labels={d["id"]: d["label"] for d in diets_raw["diets"]},
        status_labels={s["id"]: s for s in diets_raw["statuses"]},
        methods=tuple(diets_raw["methods"]),
        paused_label=diets_raw.get("pausedLabel", "Under review"),
    )


@lru_cache(maxsize=4)
def load(shared_dir: Path | None = None) -> RuleBook:
    base = shared_dir or settings.shared_dir
    rules_raw = json.loads((base / "diet_rules.json").read_text(encoding="utf-8"))
    diets_raw = json.loads((base / "diets.json").read_text(encoding="utf-8"))
    return build(rules_raw, diets_raw)


def diet_ids(book: RuleBook | None = None) -> tuple[str, ...]:
    return tuple((book or load()).diets)
