"""Query rewriting: turn a follow-up ("is it open on Monday?") into a standalone query using the
conversation and the trip context. Rule-based and deterministic; personal details (names,
phone numbers, budgets) are never added to the retrieval query."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache

from app.data import load as load_places

from . import CORPUS_DIR
from .context import TripContext
from .text import normalise, tokenize

PRONOUNS = {"it", "its", "there", "they", "them", "that", "this", "place", "one", "wahan", "wahaan", "vahan", "vaha", "uska", "uski", "iska", "iski", "woh", "vo", "ye", "yeh"}


def is_follow_up(message: str) -> bool:
    """A short question leaning on a pronoun ("is it open on Monday?"). Longer questions that
    name their own subject ("what is eVISA and can I use it?") are standalone."""
    if not FOLLOW_UP.search(message):
        return False
    content = [t for t in tokenize(message) if t not in PRONOUNS]
    return len(content) <= 4

FOLLOW_UP = re.compile(
    r"\b(it|its|it's|there|that place|that temple|this place|the place|they|them|that one|this one|"
    r"wahan|wahaan|vahan|vaha|uska|uski|iska|iski|woh|vo|ye|yeh)\b|(वहाँ|वहां|उसका|उसकी|इसका|वो|それ|そこ|あそこ)",
    re.I,
)
ATTRACTION_DOC_TITLES = ("Kiyomizu-dera", "Todai-ji", "Fushimi Inari")


@lru_cache(maxsize=1)
def gazetteer() -> dict[str, str]:
    """Lower-cased name → display name for every place we know (cities, food places,
    heritage sites, anime/regional spots and attraction documents)."""
    data = load_places()
    names: dict[str, str] = {}
    for c in data.cities.values():
        names[c.name.lower()] = c.name
        names[c.name_ja] = c.name
    for f in data.food.values():
        names[f.title.lower()] = f.title
    for h in data.heritage.values():
        names[h.japanese.lower()] = h.japanese
        place = h.place.split(",")[0].strip()
        names[place.lower()] = place
    for s in data.layers.values():
        names[s.name.lower()] = s.name
    for t in ATTRACTION_DOC_TITLES:
        names[t.lower()] = t
        names[t.lower().replace("-", " ")] = t
    return names


def find_entities(text: str) -> list[str]:
    t = normalise(text)
    hits = []
    for key, display in gazetteer().items():
        if len(key) >= 3 and key in t and display not in hits:
            hits.append(display)
    # Prefer the most specific names (longest first).
    return sorted(hits, key=len, reverse=True)


@dataclass
class Rewritten:
    text: str
    resolved_entity: str | None = None
    entities: list[str] = field(default_factory=list)
    needs_clarification: str | None = None


def rewrite(message: str, history: list[dict], ctx: TripContext | None) -> Rewritten:
    entities = find_entities(message)
    if entities or not is_follow_up(message):
        return Rewritten(message, entities=entities)

    # Follow-up without a named place: look back through the conversation, newest first.
    for turn in reversed(history[-8:]):
        prior = find_entities(turn.get("text", ""))
        if prior:
            return Rewritten(f"{message} ({prior[0]})", prior[0], [prior[0]])

    # Then today's itinerary stops.
    if ctx and ctx.itinerary:
        day = next((d for d in ctx.itinerary.days if d.day == (ctx.current_day or 1)), None)
        if day:
            named = [s.name for s in day.stops if find_entities(s.name)]
            if len(named) == 1:
                return Rewritten(f"{message} ({named[0]})", named[0], named)
            if len(named) > 1:
                return Rewritten(
                    message,
                    needs_clarification=f"Which place do you mean: {', '.join(named[:4])}?",
                )
    return Rewritten(message, needs_clarification="Which place do you mean? Tell me its name and I'll check.")
