"""Demo data reset: back to the seed state in about a second. Demo mode only."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete
from sqlalchemy.orm import Session

from . import importer, status
from .models import (
    Certificate,
    Contact,
    DietStatus,
    Dish,
    DishDeclaration,
    EditToken,
    EvidenceFile,
    Report,
    Restaurant,
    VerificationRecord,
    VerifiedDish,
)

# Children first, so it works with or without database-level cascades.
WIPE_ORDER = (VerifiedDish, DietStatus, VerificationRecord, DishDeclaration, Dish, Certificate, EvidenceFile, Contact, Report, EditToken, Restaurant)


def reset_demo(s: Session, *, mode: str | None = None, now: datetime | None = None, actor: str = "admin") -> importer.ImportReport:
    """Wipe every restaurant and re-import the seed. The audit log is append-only, so it keeps
    its history and records the reset instead."""
    if status.mode_of(mode) != "demo":
        raise PermissionError("Reset is only available in demo mode")
    now = now or datetime.now(timezone.utc)
    for model in WIPE_ORDER:
        s.execute(delete(model))
    s.flush()
    status.audit(s, actor=actor, reason="Demo data reset to the seed state", now=now)
    return importer.import_records(s, importer.seed_records(), mode="demo", now=now, actor="seed")
