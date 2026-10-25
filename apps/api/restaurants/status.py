"""The status engine: the only place that changes a (restaurant, diet) status.

- Automated checks (verification/checks.py) decide everything up to `partially_verified`.
- `verify` is the only path to `fully_verified`. INDEPENDENCE RULE: it may be called only from
  the verifier area (admin passcode). A restaurant's edit token, its own form, a model or an
  automated check can never reach it, and nothing commercial (payment, partnership, volume)
  may influence a status.
- Expiry, an edit that changes a diet's answers, a new conflict or an unresolved contradiction
  downgrades a verification automatically; a traveller report pauses the listing.
- Every transition is written to the append-only audit log.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from verification import checks

from . import rules
from .models import AuditLog, DietStatus, EditToken, EvidenceFile, Report, Restaurant, VerificationRecord, VerifiedDish, new_id
from .rules import FULLY, NOT_SUITABLE, NOT_VERIFIED, PARTIAL, RuleBook

INITIALS = re.compile(r"^[A-Za-z]{2,4}$")


class VerificationError(ValueError):
    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems))
        self.problems = problems


def aware(dt: datetime | None) -> datetime | None:
    """SQLite hands back naive datetimes; everything here is UTC."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def add_months(dt: datetime, months: int) -> datetime:
    return dt + timedelta(days=round(30.44 * months))


def mode_of(mode: str | None) -> str:
    return "production" if (mode or settings.app_mode) == "production" else "demo"


def facts_for(r: Restaurant) -> checks.RestaurantFacts:
    return checks.RestaurantFacts(
        diets_requested=tuple(r.diets_requested or ()),
        kitchen=dict(r.kitchen or {}),
        dishes=tuple(checks.DishFacts(d.id, d.display_name, d.answers) for d in r.dishes),
        declaration_accepted=bool(r.declaration_accepted),
        declared_at=aware(r.declared_at),
        contradictions=tuple(r.contradictions or ()),
        certificates=tuple(
            {
                "id": c.id,
                "diet": c.diet,
                "issuer": c.issuer,
                "scope": c.scope,
                "validFrom": c.valid_from.isoformat() if c.valid_from else None,
                "validUntil": c.valid_until.isoformat() if c.valid_until else None,
                "reviewed": c.reviewed,
            }
            for c in r.certificates
        ),
    )


def answers_hash(r: Restaurant, diet: str, dish_ids: Iterable[str], book: RuleBook) -> str:
    """Fingerprint of everything this diet's rules read, for the verified dishes."""
    fields = {rule.field for rule in book.diets[diet].rules} | {
        c.field for rule in book.diets[diet].rules for c in (*rule.when, *([rule.unless] if rule.unless else []))
    } | {"dish.modifiable"}
    ids = sorted(dish_ids)
    by_id = {d.id: d for d in r.dishes}
    payload = {
        "kitchen": {f: (r.kitchen or {}).get(f) for f in sorted(fields) if f.startswith("kitchen.")},
        "dishes": {i: {f: by_id[i].answers.get(f) for f in sorted(fields) if f.startswith("dish.")} if i in by_id else None for i in ids},
        "declaration": bool(r.declaration_accepted),
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def audit(
    s: Session,
    *,
    actor: str,
    reason: str,
    restaurant_id: str | None = None,
    diet: str | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
    details: dict[str, Any] | None = None,
    now: datetime | None = None,
) -> None:
    s.add(
        AuditLog(
            at=now or datetime.now(timezone.utc),
            actor=actor,
            restaurant_id=restaurant_id,
            diet=diet,
            from_status=from_status,
            to_status=to_status,
            reason=reason,
            details=details or {},
        )
    )


def _status_row(s: Session, r: Restaurant, diet: str) -> DietStatus:
    for ds in r.statuses:
        if ds.diet == diet:
            return ds
    ds = DietStatus(restaurant_id=r.id, diet=diet, status=NOT_VERIFIED, data_origin=r.data_origin, paused=False, demo=False)
    r.statuses.append(ds)
    s.add(ds)
    return ds


def _clear_verification(ds: DietStatus) -> None:
    ds.method = None
    ds.verified_at = None
    ds.expires_at = None
    ds.verifier_initials = None
    ds.evidence_ids = []
    ds.verified_dish_ids = []
    ds.verification_id = None
    ds.demo = False


def _breaks(vr: VerificationRecord | None, r: Restaurant, diet: str, res: checks.CheckResult, now: datetime, book: RuleBook) -> str | None:
    """Why an existing verification no longer holds, or None."""
    if vr is None or vr.revoked_at:
        return "The verification record is missing or was revoked"
    expires = aware(vr.expires_at)
    if expires and expires <= now:
        return f"Verification expired on {expires.date().isoformat()}"
    if diet not in (r.diets_requested or []):
        return "The restaurant no longer asks to be assessed for this diet"
    if res.status == NOT_SUITABLE:
        return "A conflict was declared or detected after verification"
    if res.contradictions:
        return "An unresolved contradiction was found after verification"
    if answers_hash(r, diet, [d.dish_id for d in vr.dishes], book) != vr.answers_hash:
        return "Answers that affect this diet changed after verification"
    return None


def recompute(s: Session, r: Restaurant, *, now: datetime | None = None, actor: str = "system", reason: str = "Answers re-checked") -> dict[str, DietStatus]:
    """Re-run the automated checks for every diet and apply automatic downgrades."""
    now = now or datetime.now(timezone.utc)
    book = rules.load()
    facts = facts_for(r)
    out: dict[str, DietStatus] = {}
    existing = {ds.diet for ds in r.statuses}
    for diet in book.diets:
        if diet not in facts.diets_requested and diet not in existing:
            continue
        res = checks.evaluate(facts, diet, book, now)
        ds = _status_row(s, r, diet)
        before = ds.status
        why = reason
        if ds.status == FULLY:
            vr = s.get(VerificationRecord, ds.verification_id) if ds.verification_id else None
            broken = _breaks(vr, r, diet, res, now, book)
            if broken is None:
                ds.missing_items, ds.reasons, ds.data_origin = res.missing_items, res.reasons, r.data_origin
                out[diet] = ds
                continue
            if vr and not vr.revoked_at:
                vr.revoked_at, vr.revoked_reason = now, broken
            why = broken
        _clear_verification(ds)
        ds.status = res.status
        ds.missing_items, ds.contradictions, ds.reasons = res.missing_items, res.contradictions, res.reasons
        ds.data_origin = r.data_origin
        if ds.status != before:
            audit(s, actor=actor, reason=why, restaurant_id=r.id, diet=diet, from_status=before, to_status=ds.status, now=now)
        out[diet] = ds
    return out


def verify(
    s: Session,
    restaurant_id: str,
    diet: str,
    *,
    method: str,
    initials: str,
    dish_ids: list[str],
    evidence_ids: list[str] | None = None,
    notes: str | None = None,
    now: datetime | None = None,
    mode: str | None = None,
    expiry_months: int | None = None,
) -> DietStatus:
    """Record a human or third-party verification. The ONLY way to reach `fully_verified`.

    Independence rule: callable only from the verifier area. Restaurants cannot verify
    themselves, and nothing commercial may influence the outcome.
    """
    now = now or datetime.now(timezone.utc)
    mode = mode_of(mode)
    book = rules.load()
    evidence_ids = list(evidence_ids or [])
    r = s.get(Restaurant, restaurant_id)
    problems: list[str] = []
    if r is None or r.removed_at:
        raise VerificationError(["Listing not found"])
    if diet not in book.diets:
        raise VerificationError([f"Unknown diet: {diet}"])
    if method not in book.methods:
        problems.append(f"Method must be one of: {', '.join(book.methods)}")
    if not INITIALS.match(initials or ""):
        problems.append("Verifier initials: 2-4 letters")
    if not dish_ids:
        problems.append("Confirm at least one dish for this diet")
    if mode == "production":
        if r.data_origin != "real":
            problems.append("Sample records can never be verified in production")
        if not evidence_ids:
            problems.append("Attach at least one piece of evidence")
    owned = {e.id for e in r.evidence}
    if any(e not in owned for e in evidence_ids):
        problems.append("Evidence must belong to this listing")
    res = checks.evaluate(facts_for(r), diet, book, now)
    if diet not in (r.diets_requested or []):
        problems.append("The restaurant hasn't asked to be assessed for this diet")
    elif res.contradictions:
        problems.append("Resolve the open contradictions first")
    elif res.status == NOT_SUITABLE:
        problems.append("Automated checks found a conflict that can't be left out")
    elif res.status != PARTIAL:
        problems.append("Record the missing answers first: " + "; ".join(res.missing_items[:5]))
    suitable = set(res.suitable_dish_ids)
    if any(d not in suitable for d in dish_ids):
        problems.append("Only dishes whose answers suit this diet can be confirmed")
    if problems:
        raise VerificationError(problems)

    ds = _status_row(s, r, diet)
    before = ds.status
    if ds.verification_id:
        old = s.get(VerificationRecord, ds.verification_id)
        if old and not old.revoked_at:
            old.revoked_at, old.revoked_reason = now, "Replaced by a newer verification"
    months = expiry_months or settings.verification_expiry_months or book.expiry_months
    vr = VerificationRecord(
        restaurant_id=r.id,
        diet=diet,
        method=method,
        verified_at=now,
        expires_at=add_months(now, months),
        verifier_initials=initials.upper(),
        notes=notes,
        evidence_ids=evidence_ids,
        answers_hash=answers_hash(r, diet, dish_ids, book),
        demo=mode == "demo",
        dishes=[VerifiedDish(dish_id=d) for d in dict.fromkeys(dish_ids)],
    )
    s.add(vr)
    s.flush()
    ds.status = FULLY
    ds.method, ds.verified_at, ds.expires_at = method, now, vr.expires_at
    ds.verifier_initials, ds.evidence_ids = vr.verifier_initials, evidence_ids
    ds.verified_dish_ids = list(dict.fromkeys(dish_ids))
    ds.verification_id, ds.demo, ds.data_origin = vr.id, vr.demo, r.data_origin
    ds.missing_items, ds.contradictions, ds.reasons = res.missing_items, [], res.reasons
    audit(
        s,
        actor=f"verifier:{vr.verifier_initials}",
        reason=f"Verified by {method}" + (" (DEMO)" if vr.demo else ""),
        restaurant_id=r.id,
        diet=diet,
        from_status=before,
        to_status=FULLY,
        details={"dishIds": ds.verified_dish_ids, "evidenceIds": evidence_ids, "expiresAt": vr.expires_at.isoformat(), "demo": vr.demo},
        now=now,
    )
    return ds


def downgrade(s: Session, restaurant_id: str, diet: str, *, reason: str, actor: str, now: datetime | None = None) -> DietStatus:
    """A verifier withdraws a verification; the status falls back to what the checks say."""
    now = now or datetime.now(timezone.utc)
    r = s.get(Restaurant, restaurant_id)
    if r is None:
        raise VerificationError(["Listing not found"])
    ds = _status_row(s, r, diet)
    if ds.verification_id:
        vr = s.get(VerificationRecord, ds.verification_id)
        if vr and not vr.revoked_at:
            vr.revoked_at, vr.revoked_reason = now, reason
    before = ds.status
    _clear_verification(ds)
    res = checks.evaluate(facts_for(r), diet, rules.load(), now)
    ds.status, ds.missing_items, ds.contradictions, ds.reasons = res.status, res.missing_items, res.contradictions, res.reasons
    audit(s, actor=actor, reason=reason, restaurant_id=r.id, diet=diet, from_status=before, to_status=ds.status, now=now)
    return ds


def refresh_expired(s: Session, now: datetime | None = None) -> int:
    """Downgrade every verification past its expiry. Cheap enough to run on reads."""
    now = now or datetime.now(timezone.utc)
    rows = s.scalars(select(DietStatus).where(DietStatus.status == FULLY)).all()
    ids = {ds.restaurant_id for ds in rows if (aware(ds.expires_at) or now) <= now}
    for rid in ids:
        r = s.get(Restaurant, rid)
        if r:
            recompute(s, r, now=now, reason="Verification expired")
    return len(ids)


PAUSING = ("report",)


def report(
    s: Session,
    restaurant_id: str,
    *,
    kind: str,
    diet: str | None = None,
    message: str | None = None,
    accurate: bool | None = None,
    now: datetime | None = None,
) -> Report:
    """A traveller report or feedback. Reports and "not accurate" feedback pause the listing;
    a traveller's "staff confirmed" note is stored but never upgrades a status."""
    now = now or datetime.now(timezone.utc)
    r = s.get(Restaurant, restaurant_id)
    if r is None or r.removed_at:
        raise VerificationError(["Listing not found"])
    rep = Report(id=new_id(), restaurant_id=r.id, diet=diet, kind=kind, accurate=accurate, message=message, created_at=now)
    s.add(rep)
    if kind in PAUSING or (kind == "feedback" and accurate is False):
        for ds in r.statuses:
            if diet is None or ds.diet == diet:
                if not ds.paused:
                    ds.paused = True
                    audit(
                        s,
                        actor="traveller-report",
                        reason="Paused for review after a traveller report",
                        restaurant_id=r.id,
                        diet=ds.diet,
                        from_status=ds.status,
                        to_status=ds.status,
                        details={"paused": True},
                        now=now,
                    )
    return rep


def resolve_report(s: Session, report_id: str, *, resolution: str, actor: str, now: datetime | None = None) -> Report:
    now = now or datetime.now(timezone.utc)
    rep = s.get(Report, report_id)
    if rep is None:
        raise VerificationError(["Report not found"])
    rep.resolved_at, rep.resolution = now, resolution
    s.flush()
    r = s.get(Restaurant, rep.restaurant_id)
    if r is None:
        return rep
    open_reports = s.scalars(
        select(Report).where(Report.restaurant_id == r.id, Report.resolved_at.is_(None), Report.id != rep.id)
    ).all()
    for ds in r.statuses:
        still = any(
            (o.diet in (None, ds.diet)) and (o.kind in PAUSING or (o.kind == "feedback" and o.accurate is False)) for o in open_reports
        )
        if ds.paused and not still and (rep.diet in (None, ds.diet)):
            ds.paused = False
            audit(s, actor=actor, reason=f"Review finished: {resolution}", restaurant_id=r.id, diet=ds.diet, from_status=ds.status, to_status=ds.status, details={"paused": False}, now=now)
    return rep


def remove_listing(s: Session, r: Restaurant, *, actor: str, now: datetime | None = None) -> None:
    """Immediate removal: hidden everywhere, contact details deleted, edit links revoked."""
    now = now or datetime.now(timezone.utc)
    r.removed_at = now
    for c in list(r.contacts):
        s.delete(c)
    for t in s.scalars(select(EditToken).where(EditToken.restaurant_id == r.id, EditToken.revoked_at.is_(None))):
        t.revoked_at = now
    audit(s, actor=actor, reason="Listing removed", restaurant_id=r.id, now=now)


# --- What the planner and the traveller app may use -------------------------------------------


def recommendable(ds: DietStatus | None, *, now: datetime, mode: str | None = None) -> bool:
    """Fully verified, unexpired, unpaused, with confirmed dishes; real data in production."""
    if ds is None or ds.status != FULLY or ds.paused or not ds.verified_dish_ids:
        return False
    expires = aware(ds.expires_at)
    if expires is None or expires <= now:
        return False
    if mode_of(mode) == "production" and (ds.data_origin != "real" or ds.demo):
        return False
    return True


def meal_eligible(r: Restaurant, diets: Iterable[str], *, now: datetime, mode: str | None = None) -> bool:
    """The planner's hard rule: recommendable for EVERY diet in the trip."""
    wanted = list(dict.fromkeys(diets))
    if not wanted or r.removed_at:
        return False
    by_diet: Mapping[str, DietStatus] = {ds.diet: ds for ds in r.statuses}
    return all(recommendable(by_diet.get(d), now=now, mode=mode) for d in wanted)


@dataclass(frozen=True)
class Label:
    status: str
    label: str
    demo: bool
    paused: bool


def traveller_label(ds: DietStatus | None, *, mode: str | None = None, book: RuleBook | None = None) -> Label:
    book = book or rules.load()
    status = ds.status if ds else NOT_VERIFIED
    demo = bool(ds and ds.demo)
    # Production never shows sample or demo data as fully verified.
    if status == FULLY and mode_of(mode) == "production" and ds is not None and (ds.data_origin != "real" or ds.demo):
        status, demo = NOT_VERIFIED, False
    meta = book.status_labels[status]
    label = meta.get("demoLabel", meta["label"]) if status == FULLY and demo else meta["label"]
    paused = bool(ds and ds.paused)
    return Label(status=status, label=book.paused_label if paused else label, demo=demo, paused=paused)


def evidence_reference(s: Session, r: Restaurant, note: str) -> EvidenceFile:
    """A recorded reference (a call note, a link) rather than an uploaded file."""
    ev = EvidenceFile(id=new_id(), restaurant_id=r.id, kind="reference", filename=note[:200])
    r.evidence.append(ev)
    s.add(ev)
    s.flush()
    return ev
