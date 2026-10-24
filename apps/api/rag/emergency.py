"""Emergency path: deterministic, offline, highest priority. Built only from emergency.json
(official sources, needs-review), so it works even if retrieval or the AI is down."""

from __future__ import annotations

import json
from functools import lru_cache

from app.config import settings

from .models import EmergencyContact, EmergencyPayload

KINDS = (
    "lost_passport",
    "medical",
    "police",
    "lost_belongings",
    "earthquake",
    "typhoon_tsunami",
    "stranded",
    "missing_person",
)


@lru_cache(maxsize=1)
def load_emergency() -> dict:
    with open(settings.data_dir / "emergency.json", encoding="utf8") as f:
        return json.load(f)


def missions_for(city_ids: list[str]) -> list[dict]:
    """The Indian mission(s) covering the traveller's cities; both if we don't know."""
    data = load_emergency()
    matched = [m for m in data["missions"] if set(m["region"]) & set(city_ids)]
    return matched or data["missions"]


def build(kind: str, city_ids: list[str] | None = None, language: str = "en") -> EmergencyPayload:
    data = load_emergency()
    if kind not in data["situations"]:
        kind = "police"
    s = data["situations"][kind]
    hi = language in ("hi", "hinglish")
    numbers = {n["id"]: n for n in data["numbers"]}
    contacts: list[EmergencyContact] = []
    for ref in s["contacts"]:
        if ref == "mission":
            for m in missions_for(city_ids or []):
                contacts.append(
                    EmergencyContact(
                        label=f"{m['name']} (emergency)",
                        value=m["emergency"],
                        kind="phone",
                        note=m["emergency_note"],
                        source_url=m["source_url"],
                    )
                )
                contacts.append(
                    EmergencyContact(label=f"{m['name']} (consular)", value=m["consular"], kind="phone", note=m["consular_note"], source_url=m["source_url"])
                )
        elif ref in numbers:
            n = numbers[ref]
            contacts.append(EmergencyContact(label=n["label"], value=n["value"], kind="phone", note=n["note"], source_url=n["source_url"]))
    return EmergencyPayload(
        kind=kind,
        title=s["title"],
        urgent_action=s["urgent_action_hi"] if hi else s["urgent_action"],
        steps=s["steps_hi"] if hi else s["steps"],
        contacts=contacts,
        replan_prompt=data["replan_prompt_hi"] if hi else data["replan_prompt"],
        disclaimer=data["disclaimer_hi"] if hi else data["disclaimer"],
        status=data["status"],
        last_verified=data["last_verified"],
        sources=s["sources"],
    )


def render_text(p: EmergencyPayload) -> str:
    lines = [p.urgent_action, ""]
    lines += [f"{i}. {step}" for i, step in enumerate(p.steps, start=1)]
    lines += ["", "Contacts:"]
    lines += [f"- {c.label}: {c.value}" for c in p.contacts]
    lines += ["", p.replan_prompt]
    return "\n".join(lines)
