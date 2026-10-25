"""Import restaurant records (seed files, researched places, bulk updates).

Rules (addendum 5 v3):
- A verification is accepted only with `method`, `verifiedAt`, `verifierInitials` and at least
  one evidence reference; otherwise it is refused and reported, and the restaurant is imported
  without it (so it can never appear as fully verified).
- In production mode a sample record's verifications are always refused.
- "@now" as a date is a demo convenience for sample records only (seeded demo verifications
  restart their expiry clock on every reset).
- Verifications go through status.verify, the same path as the verifier area.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from . import rules, status
from .models import Certificate, Dish, DishDeclaration, Restaurant

SEED_DIR = Path(__file__).resolve().parent / "seed"
SEED_FILES = ("sample_restaurants.json", "real_research.json")


@dataclass
class ImportReport:
    imported: list[str] = field(default_factory=list)
    verified: list[tuple[str, str]] = field(default_factory=list)
    refused: list[tuple[str, str | None, list[str]]] = field(default_factory=list)


def _when(value: Any, *, origin: str, mode: str, now: datetime) -> datetime | None:
    if value in (None, ""):
        return None
    if value == "@now":
        if origin == "sample" and mode == "demo":
            return now
        raise ValueError("'@now' is only allowed for sample records in demo mode")
    dt = datetime.fromisoformat(str(value))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _restaurant(s: Session, rec: dict[str, Any], *, mode: str, now: datetime, book: rules.RuleBook) -> Restaurant:
    problems: list[str] = []
    origin = rec.get("dataOrigin")
    if origin not in ("real", "sample"):
        problems.append("dataOrigin must be 'real' or 'sample'")
    if not rec.get("id") or not rec.get("cityId"):
        problems.append("id and cityId are required")
    if not (rec.get("nameEn") or rec.get("nameJa")):
        problems.append("a name is required")
    unknown = [d for d in rec.get("dietsRequested", []) if d not in book.diets]
    if unknown:
        problems.append(f"unknown diets: {unknown}")
    if (rec.get("lat") is None) != (rec.get("lng") is None):
        problems.append("lat and lng go together")
    if problems:
        raise ValueError("; ".join(problems))
    decl = rec.get("declaration") or {}
    r = Restaurant(
        id=rec["id"],
        name_ja=rec.get("nameJa"),
        name_en=rec.get("nameEn"),
        city_id=rec["cityId"],
        address=rec.get("address"),
        lat=rec.get("lat"),
        lng=rec.get("lng"),
        location_source=rec.get("locationSource"),
        phone=rec.get("phone"),
        website=rec.get("website"),
        opening_info=rec.get("openingInfo"),
        cuisine=rec.get("cuisine"),
        diets_requested=list(dict.fromkeys(rec.get("dietsRequested", []))),
        kitchen=dict(rec.get("kitchen") or {}),
        declaration_accepted=bool(decl.get("accepted")),
        declared_at=_when(decl.get("declaredAt"), origin=str(origin), mode=mode, now=now),
        contradictions=list(rec.get("contradictions") or []),
        data_origin=str(origin),
        source=rec.get("source"),
        link=rec.get("link"),
        created_at=now,
        updated_at=now,
    )
    for i, d in enumerate(rec.get("dishes", [])):
        dish = Dish(id=d.get("id") or None, name_ja=d.get("nameJa"), name_en=d.get("nameEn"), position=i, created_at=now)
        dish.declarations.append(DishDeclaration(answers=dict(d.get("answers") or {}), source="importer", created_at=now))
        r.dishes.append(dish)
    for c in rec.get("certificates", []):
        r.certificates.append(
            Certificate(
                diet=c["diet"],
                issuer=c.get("issuer"),
                scope=c.get("scope"),
                valid_from=date.fromisoformat(c["validFrom"]) if c.get("validFrom") else None,
                valid_until=date.fromisoformat(c["validUntil"]) if c.get("validUntil") else None,
                reviewed=False,
            )
        )
    s.add(r)
    s.flush()
    return r


def verification_problems(v: dict[str, Any], *, origin: str, mode: str) -> list[str]:
    problems = []
    if mode == "production" and origin != "real":
        problems.append("sample records can never be fully verified in production")
    for key in ("method", "verifiedAt", "verifierInitials"):
        if not v.get(key):
            problems.append(f"{key} is required")
    if not [e for e in v.get("evidence", []) if str(e).strip()]:
        problems.append("at least one evidence reference is required")
    return problems


def import_records(s: Session, records: list[dict[str, Any]], *, mode: str | None = None, now: datetime | None = None, actor: str = "importer") -> ImportReport:
    mode = status.mode_of(mode)
    now = now or datetime.now(timezone.utc)
    book = rules.load()
    report = ImportReport()
    for rec in records:
        rid = rec.get("id")
        if rid and s.get(Restaurant, rid):
            report.refused.append((rid, None, ["already exists"]))
            continue
        try:
            with s.begin_nested():
                r = _restaurant(s, rec, mode=mode, now=now, book=book)
                status.recompute(s, r, now=now, actor=actor, reason="Imported")
                status.audit(s, actor=actor, reason=f"Imported ({r.data_origin})", restaurant_id=r.id, now=now)
        except (ValueError, KeyError) as e:
            report.refused.append((rid or "?", None, [str(e)]))
            continue
        report.imported.append(r.id)
        for v in rec.get("verifications", []):
            diet = v.get("diet")
            problems = verification_problems(v, origin=r.data_origin, mode=mode)
            if problems:
                report.refused.append((r.id, diet, problems))
                continue
            try:
                with s.begin_nested():
                    when = _when(v["verifiedAt"], origin=r.data_origin, mode=mode, now=now) or now
                    evidence = [status.evidence_reference(s, r, str(e)).id for e in v["evidence"] if str(e).strip()]
                    status.verify(
                        s,
                        r.id,
                        str(diet),
                        method=v["method"],
                        initials=v["verifierInitials"],
                        dish_ids=list(v.get("dishIds", [])),
                        evidence_ids=evidence,
                        notes=v.get("notes"),
                        now=when,
                        mode=mode,
                    )
                report.verified.append((r.id, str(diet)))
            except (status.VerificationError, ValueError) as e:
                report.refused.append((r.id, diet, getattr(e, "problems", [str(e)])))
    return report


def seed_records(files: tuple[str, ...] = SEED_FILES) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for name in files:
        out.extend(json.loads((SEED_DIR / name).read_text(encoding="utf-8"))["restaurants"])
    return out
