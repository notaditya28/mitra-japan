"""Database tables (SQLAlchemy 2). Generic column types only, so SQLite and Postgres share one schema."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    type_annotation_map = {dict[str, Any]: JSON, list[Any]: JSON}


class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    name_ja: Mapped[str | None] = mapped_column(String(200))
    name_en: Mapped[str | None] = mapped_column(String(200))
    city_id: Mapped[str] = mapped_column(String(40), index=True)
    address: Mapped[str | None] = mapped_column(Text)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    #: place-picker | geocoder | research-approximate | sample-area. Never invented.
    location_source: Mapped[str | None] = mapped_column(String(40))
    phone: Mapped[str | None] = mapped_column(String(40))
    website: Mapped[str | None] = mapped_column(String(300))
    opening_info: Mapped[str | None] = mapped_column(Text)  # self-reported
    cuisine: Mapped[str | None] = mapped_column(String(120))
    diets_requested: Mapped[list[Any]] = mapped_column(JSON, default=list)
    kitchen: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    declaration_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    declared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    #: [{id, diets, field, declared, found, source, resolved, resolvedBy, resolvedAt}]
    contradictions: Mapped[list[Any]] = mapped_column(JSON, default=list)
    #: real | sample. Demo-mode submissions are always sample.
    data_origin: Mapped[str] = mapped_column(String(10), default="sample")
    source: Mapped[str | None] = mapped_column(Text)
    link: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    dishes: Mapped[list[Dish]] = relationship(back_populates="restaurant", cascade="all, delete-orphan", order_by="Dish.position")
    statuses: Mapped[list[DietStatus]] = relationship(back_populates="restaurant", cascade="all, delete-orphan")
    certificates: Mapped[list[Certificate]] = relationship(cascade="all, delete-orphan")
    contacts: Mapped[list[Contact]] = relationship(cascade="all, delete-orphan")
    evidence: Mapped[list[EvidenceFile]] = relationship(cascade="all, delete-orphan")

    @property
    def display_name(self) -> str:
        return self.name_en or self.name_ja or self.id


class Contact(Base):
    """Minimal verification contact, stored only with consent and deleted on removal."""

    __tablename__ = "contacts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    name: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[str | None] = mapped_column(String(80))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(200))
    consent: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Dish(Base):
    __tablename__ = "dishes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    name_ja: Mapped[str | None] = mapped_column(String(200))
    name_en: Mapped[str | None] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    restaurant: Mapped[Restaurant] = relationship(back_populates="dishes")
    declarations: Mapped[list[DishDeclaration]] = relationship(
        cascade="all, delete-orphan", order_by="DishDeclaration.created_at"
    )

    @property
    def display_name(self) -> str:
        return self.name_en or self.name_ja or self.id

    @property
    def answers(self) -> dict[str, Any]:
        """The latest declaration; earlier ones stay as history."""
        return dict(self.declarations[-1].answers) if self.declarations else {}


class DishDeclaration(Base):
    """One set of answers for a dish. Edits add a row; the newest is current."""

    __tablename__ = "dish_declarations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    dish_id: Mapped[str] = mapped_column(ForeignKey("dishes.id", ondelete="CASCADE"), index=True)
    answers: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    #: restaurant | verifier | importer
    source: Mapped[str] = mapped_column(String(20), default="restaurant")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EvidenceFile(Base):
    __tablename__ = "evidence_files"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    #: menu | label | certificate | photo | reference (a note or link, no file)
    kind: Mapped[str] = mapped_column(String(20))
    filename: Mapped[str] = mapped_column(String(200))
    mime: Mapped[str | None] = mapped_column(String(80))
    size: Mapped[int | None] = mapped_column(Integer)
    sha256: Mapped[str | None] = mapped_column(String(64))
    storage_path: Mapped[str | None] = mapped_column(String(300))
    ocr_text: Mapped[str | None] = mapped_column(Text)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    diet: Mapped[str] = mapped_column(String(20))
    issuer: Mapped[str | None] = mapped_column(String(200))
    #: kitchen | product | dish
    scope: Mapped[str | None] = mapped_column(String(20))
    valid_from: Mapped[date | None] = mapped_column(Date)
    valid_until: Mapped[date | None] = mapped_column(Date)
    evidence_id: Mapped[str | None] = mapped_column(ForeignKey("evidence_files.id", ondelete="SET NULL"))
    #: certificateReviewed: authenticity needs a person.
    reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_by: Mapped[str | None] = mapped_column(String(10))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DietStatus(Base):
    """The current status for one (restaurant, diet). History lives in audit_log."""

    __tablename__ = "diet_status"

    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), primary_key=True)
    diet: Mapped[str] = mapped_column(String(20), primary_key=True)
    status: Mapped[str] = mapped_column(String(24), default="not_verified")
    paused: Mapped[bool] = mapped_column(Boolean, default=False)
    method: Mapped[str | None] = mapped_column(String(40))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verifier_initials: Mapped[str | None] = mapped_column(String(10))
    evidence_ids: Mapped[list[Any]] = mapped_column(JSON, default=list)
    verified_dish_ids: Mapped[list[Any]] = mapped_column(JSON, default=list)
    missing_items: Mapped[list[Any]] = mapped_column(JSON, default=list)
    contradictions: Mapped[list[Any]] = mapped_column(JSON, default=list)
    reasons: Mapped[list[Any]] = mapped_column(JSON, default=list)
    data_origin: Mapped[str] = mapped_column(String(10), default="sample")
    #: Set by a verifier action in demo mode: shown as "Fully verified (DEMO)".
    demo: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_id: Mapped[str | None] = mapped_column(ForeignKey("verification_records.id", ondelete="SET NULL"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    restaurant: Mapped[Restaurant] = relationship(back_populates="statuses")


class VerificationRecord(Base):
    __tablename__ = "verification_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    diet: Mapped[str] = mapped_column(String(20))
    method: Mapped[str] = mapped_column(String(40))
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    verifier_initials: Mapped[str] = mapped_column(String(10))
    notes: Mapped[str | None] = mapped_column(Text)
    evidence_ids: Mapped[list[Any]] = mapped_column(JSON, default=list)
    #: Hash of the diet-relevant answers at verification time; an edit that changes it downgrades.
    answers_hash: Mapped[str] = mapped_column(String(64))
    demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(Text)

    dishes: Mapped[list[VerifiedDish]] = relationship(cascade="all, delete-orphan")


class VerifiedDish(Base):
    __tablename__ = "verified_dishes"

    verification_id: Mapped[str] = mapped_column(ForeignKey("verification_records.id", ondelete="CASCADE"), primary_key=True)
    dish_id: Mapped[str] = mapped_column(ForeignKey("dishes.id", ondelete="CASCADE"), primary_key=True)


class Report(Base):
    """A traveller report or after-visit feedback. No traveller identifiers, ever."""

    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    diet: Mapped[str | None] = mapped_column(String(20))
    #: report | feedback | staff_confirmed (a traveller's own note; never upgrades a status)
    kind: Mapped[str] = mapped_column(String(20))
    accurate: Mapped[bool | None] = mapped_column(Boolean)
    message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution: Mapped[str | None] = mapped_column(Text)


class AuditLog(Base):
    """Append-only. The ORM refuses updates and deletes; the migration adds database triggers too."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    #: system | importer | restaurant | traveller-report | verifier:<initials> | admin
    actor: Mapped[str] = mapped_column(String(40))
    #: No foreign key: the history outlives a removed listing.
    restaurant_id: Mapped[str | None] = mapped_column(String(64), index=True)
    diet: Mapped[str | None] = mapped_column(String(20))
    from_status: Mapped[str | None] = mapped_column(String(24))
    to_status: Mapped[str | None] = mapped_column(String(24))
    reason: Mapped[str] = mapped_column(Text)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class EditToken(Base):
    """Private edit link. Only the SHA-256 of the token is stored."""

    __tablename__ = "edit_tokens"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    restaurant_id: Mapped[str] = mapped_column(ForeignKey("restaurants.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AppendOnlyError(RuntimeError):
    pass


@event.listens_for(AuditLog, "before_update")
def _no_update(*_: Any) -> None:
    raise AppendOnlyError("audit_log is append-only")


@event.listens_for(AuditLog, "before_delete")
def _no_delete(*_: Any) -> None:
    raise AppendOnlyError("audit_log is append-only")
