"""Runtime settings, read once from the environment (and the repo-root .env)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(REPO_ROOT / ".env")


def _origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [o.strip() for o in raw.split(",") if o.strip()]


@dataclass(frozen=True)
class Settings:
    #: The brief names Claude Sonnet 5.5 for the planner.
    model: str = os.getenv("PLANNER_MODEL", "claude-sonnet-5-5")
    #: Present means "live" mode; absent means labelled Demo mode on sample data.
    has_api_key: bool = bool(os.getenv("ANTHROPIC_API_KEY", "").strip())
    #: Force Demo mode even with a key (useful for offline demos and tests).
    force_demo: bool = os.getenv("MITRA_DEMO_MODE", "").lower() in {"1", "true", "yes"}
    cors_origins: list[str] = field(default_factory=_origins)
    #: Shared web data (cities, food spots, heritage) is the single source of truth.
    data_dir: Path = Path(os.getenv("MITRA_DATA_DIR", str(REPO_ROOT / "apps" / "web" / "src" / "data")))
    plan_rate_per_minute: int = int(os.getenv("PLAN_RATE_PER_MINUTE", "8"))
    max_body_bytes: int = int(os.getenv("MAX_BODY_BYTES", "65536"))
    upstream_timeout_s: float = float(os.getenv("UPSTREAM_TIMEOUT_S", "120"))

    @property
    def live(self) -> bool:
        return self.has_api_key and not self.force_demo


settings = Settings()
