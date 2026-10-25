"""Alembic environment: one metadata (restaurants.models), URL from config or DATABASE_URL."""

from __future__ import annotations

from alembic import context

from app.config import settings
from restaurants.db import make_engine
from restaurants.models import Base

config = context.config
target_metadata = Base.metadata


def url() -> str:
    return config.get_main_option("sqlalchemy.url") or settings.database_url


def run_offline() -> None:
    context.configure(url=url(), target_metadata=target_metadata, literal_binds=True, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_online() -> None:
    engine = make_engine(url())
    with engine.connect() as conn:
        # Batch mode lets later migrations alter SQLite tables.
        context.configure(connection=conn, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_offline()
else:
    run_online()
