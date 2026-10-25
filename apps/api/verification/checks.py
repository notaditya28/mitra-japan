"""Deterministic automated checks for one (restaurant, diet).

Software checks, people verify. This module structures answers, applies diet_rules.json and
reports what is missing or contradictory. It can never produce `fully_verified`: the highest
it returns is `partially_verified` (restaurant-reported). Only a recorded verifier action in
restaurants/status.py may set `fully_verified`, and no model output is ever used here.

Fail safe: an unknown answer is a missing item, an unresolved contradiction blocks anything
above `not_verified`, and a conflict that can't be left out makes a dish not suitable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Any, Literal

from restaurants.rules import NOT_SUITABLE, NOT_VERIFIED, PARTIAL, Condition, Rule, RuleBook

DishState = Literal["suitable", "suitable_with_change", "unsuitable", "incomplete"]
CERT_SCOPES = ("kitchen", "product", "dish")


@dataclass(frozen=True)
class DishFacts:
    id: str
    name: str
    answers: dict[str, Any]


@dataclass(frozen=True)
class RestaurantFacts:
    diets_requested: tuple[str, ...]
    kitchen: dict[str, Any]
    dishes: tuple[DishFacts, ...]
    declaration_accepted: bool
    declared_at: datetime | None
    #: [{id, diets: [...], field, declared, found, source, resolved}]
    contradictions: tuple[dict[str, Any], ...] = ()
    #: [{id, diet, issuer, scope, validFrom, validUntil, reviewed}]
    certificates: tuple[dict[str, Any], ...] = ()


@dataclass
class DishResult:
    state: DishState
    missing: list[str] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)
    changes: list[str] = field(default_factory=list)
    cautions: list[str] = field(default_factory=list)


@dataclass
class CheckResult:
    diet: str
    status: str
    missing_items: list[str]
    contradictions: list[dict[str, Any]]
    reasons: list[str]
    suitable_dish_ids: list[str]
    dishes: dict[str, DishResult]


def _values(answer: Any) -> set[str] | None:
    """An answer as a set of values, or None when it was never given."""
    if answer is None or answer == "" or answer == []:
        return None
    if isinstance(answer, (list, tuple, set)):
        return {str(v) for v in answer}
    return {str(answer)}


def _holds(cond: Condition, answers: dict[str, Any], kitchen: dict[str, Any], unknown: frozenset[str] = frozenset()) -> bool | None:
    """True / False, or None when the answer is missing or unknown (so we must ask)."""
    src = kitchen if cond.field.startswith("kitchen.") else answers
    vals = _values(src.get(cond.field))
    if vals is None or vals & unknown:
        return None
    return bool(vals & cond.values)


def _applies(rule: Rule, answers: dict[str, Any], kitchen: dict[str, Any], profile: str, unknown: frozenset[str] = frozenset()) -> bool:
    if rule.profile and rule.profile != profile:
        return False
    if not rule.when:
        return True
    # An unanswered condition might hold, so the rule applies (fail safe).
    return any(_holds(c, answers, kitchen, unknown) is not False for c in rule.when)


def _check(rule: Rule, answers: dict[str, Any], kitchen: dict[str, Any], book: RuleBook) -> tuple[str, str | None]:
    """('ok' | 'missing' | 'conflict' | 'caution', field still to ask about)."""
    src = kitchen if rule.kitchen else answers
    vals = _values(src.get(rule.field))
    if vals is None or vals & (book.unknown_values | rule.unknown):
        return "missing", rule.field
    if vals & rule.conflict:
        if rule.unless:
            held = _holds(rule.unless, answers, kitchen, book.unknown_values)
            if held is None:
                return "missing", rule.unless.field
            if held:
                return "caution", None
        return "conflict", None
    if vals & rule.caution:
        return "caution", None
    return "ok", None


def _dish(d: DishFacts, rules: list[Rule], kitchen: dict[str, Any], book: RuleBook, profile: str) -> DishResult:
    res = DishResult(state="suitable")
    can_change = _values(d.answers.get("dish.modifiable")) == {"yes"}
    for rule in rules:
        if rule.kitchen or not _applies(rule, d.answers, kitchen, profile, book.unknown_values):
            continue
        outcome, ask = _check(rule, d.answers, kitchen, book)
        if outcome == "missing" and ask:
            res.missing.append(book.question(ask))
        elif outcome == "conflict":
            (res.changes if rule.modifiable and can_change else res.conflicts).append(rule.reason)
        elif outcome == "caution":
            res.cautions.append(rule.reason)
    res.missing = list(dict.fromkeys(res.missing))
    # A conflict that can't be left out decides it, even if other answers are missing.
    res.state = "unsuitable" if res.conflicts else "incomplete" if res.missing else "suitable_with_change" if res.changes else "suitable"
    return res


def certificate_notes(certs: tuple[dict[str, Any], ...], diet: str, today: date) -> tuple[list[str], list[str]]:
    """Sanity only: fields present, dates valid, scope recorded. Authenticity needs a person."""
    reasons: list[str] = []
    missing: list[str] = []
    for c in (c for c in certs if c.get("diet") == diet):
        issuer = (c.get("issuer") or "").strip()
        problems = []
        if not issuer:
            problems.append("issuer")
        if c.get("scope") not in CERT_SCOPES:
            problems.append("scope (kitchen, product or dish)")
        start, end = c.get("validFrom"), c.get("validUntil")
        if not start or not end:
            problems.append("validity dates")
        if problems:
            missing.append(f"Certificate: add the {', '.join(problems)}")
            continue
        s, e = date.fromisoformat(str(start)), date.fromisoformat(str(end))
        if e < s:
            missing.append(f"Certificate from {issuer}: valid-until is before valid-from")
        elif e < today:
            reasons.append(f"Certificate from {issuer} expired on {e.isoformat()}")
        else:
            reviewed = "reviewed by a verifier" if c.get("reviewed") else "not yet reviewed by a verifier"
            reasons.append(f"Certificate from {issuer} ({c.get('scope')} scope, valid until {e.isoformat()}) recorded, {reviewed}")
    return reasons, missing


def evaluate(facts: RestaurantFacts, diet: str, book: RuleBook, now: datetime, profile: str | None = None) -> CheckResult:
    profile = profile or book.jain_strictness
    rules_note = f"Rules applied: {book.diets[diet].summary} (diet rules v{book.version}, {book.status})"
    if diet not in facts.diets_requested:
        return CheckResult(diet, NOT_VERIFIED, [], [], ["Not assessed: the restaurant hasn't asked to be assessed for this diet"], [], {})

    rules = list(book.diets[diet].rules)
    # Restaurant-level gaps block the status; dish-level gaps only exclude that dish.
    missing: list[str] = []
    dish_missing: list[str] = []
    reasons: list[str] = [rules_note]

    if not facts.dishes:
        missing.append("Add at least one dish with its answers")
    if not facts.declaration_accepted:
        missing.append("Confirm the declaration")
    stale = bool(facts.declared_at and now - facts.declared_at > timedelta(days=30 * book.stale_months))
    if stale:
        reasons.append(f"Answers are older than {book.stale_months} months: the restaurant needs to re-confirm them")

    kitchen_conflict = False
    for rule in rules:
        if not rule.kitchen or not _applies(rule, {}, facts.kitchen, profile, book.unknown_values):
            continue
        outcome, ask = _check(rule, {}, facts.kitchen, book)
        if outcome == "missing" and ask:
            missing.append(f"Kitchen: {book.question(ask)}")
        elif outcome == "conflict":
            kitchen_conflict = True
            reasons.append(f"Kitchen: not suitable, {rule.reason.lower()}")
        elif outcome == "caution":
            reasons.append(f"Kitchen: {rule.reason.lower()} (cross-contact possible)")

    dishes = {d.id: _dish(d, rules, facts.kitchen, book, profile) for d in facts.dishes}
    names = {d.id: d.name for d in facts.dishes}
    for did, r in dishes.items():
        if r.state == "unsuitable":
            reasons.append(f"{names[did]}: not suitable ({'; '.join(r.conflicts).lower()})")
        elif r.state == "incomplete":
            dish_missing.extend(f"{names[did]}: {q}" for q in r.missing)
        elif r.state == "suitable_with_change":
            reasons.append(f"{names[did]}: suitable only if staff leave out what is listed ({'; '.join(r.changes).lower()})")
    suitable = [did for did, r in dishes.items() if r.state in ("suitable", "suitable_with_change")]

    cert_reasons, cert_missing = certificate_notes(facts.certificates, diet, now.date())
    reasons.extend(cert_reasons)
    missing.extend(cert_missing)

    open_contradictions = [c for c in facts.contradictions if not c.get("resolved") and diet in c.get("diets", [])]
    for c in open_contradictions:
        reasons.append(f"Contradiction: declared {c.get('declared')} but {c.get('source', 'evidence')} shows {c.get('found')}")

    if kitchen_conflict or (dishes and all(r.state == "unsuitable" for r in dishes.values())):
        status = NOT_SUITABLE
    elif open_contradictions or stale or missing or not suitable:
        # A dish we can't judge is only skipped when another dish is fully answered and suitable.
        status = NOT_VERIFIED
    else:
        status = PARTIAL
    missing = list(dict.fromkeys(missing + dish_missing))
    if status == PARTIAL:
        reasons.append("Restaurant-reported: no one has independently confirmed these answers yet")
    return CheckResult(diet, status, missing, open_contradictions, reasons, suitable if status == PARTIAL else [], dishes)
