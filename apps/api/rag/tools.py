"""Tools for conversational itinerary changes. Used by the live model (as tool calls) and by
the rule-based demo planner. Everything comes from our own place data."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any

from app.data import PlaceData, distance_km, load as load_places
from app.schema import Itinerary
from app.validate import estimate_hours

from .live_tools import get_attraction_hours, get_transit_status, get_weather
from .patching import pin_key

OUTDOOR_KINDS = {"nature", "heritage", "temple", "sight"}
INDOOR_KINDS = {"food", "anime", "shopping", "culture", "onsen"}
OUTDOOR_WORDS = re.compile(r"\b(park|garden|hike|hiking|trail|beach|mountain|viewpoint|walk|island|falls|lake|gorge|forest|shrine|temple|crossing)\b", re.I)


@dataclass
class Place:
    name: str
    kind: str
    cityId: str
    foodSpotId: str | None = None
    heritageId: str | None = None
    note: str = ""
    status: str = "sample"
    suits_diet: bool | None = None
    likely_indoor: bool = False


def search_places(
    city_id: str,
    kinds: list[str] | None = None,
    diet: str | None = None,
    exclude: set[str] | None = None,
    indoor_only: bool = False,
    data: PlaceData | None = None,
) -> list[Place]:
    data = data or load_places()
    exclude = exclude or set()
    out: list[Place] = []
    for f in data.food.values():
        if f.city_id != city_id:
            continue
        suits = None if not diet or diet == "none" else diet in f.diets
        out.append(Place(f.title, "food", city_id, foodSpotId=f.id, note=f.note, status=f.status, suits_diet=suits, likely_indoor=True))
    city = data.cities.get(city_id)
    if city:
        for h in data.heritage.values():
            if distance_km(city.lat, city.lng, h.lat, h.lng) <= 60:
                out.append(Place(h.place, "heritage", city_id, heritageId=h.id, note=f"Associated with {h.indian}.", status="needs-review"))
    for s in data.layers.values():
        if s.city_id == city_id:
            kind = "anime" if s.layer == "anime" else "sight"
            out.append(Place(s.name, kind, city_id, note=s.note, status="needs-review", likely_indoor=s.layer == "anime" and not OUTDOOR_WORDS.search(s.name)))
    out = [p for p in out if p.name not in exclude]
    if kinds:
        out = [p for p in out if p.kind in kinds]
    if indoor_only:
        out = [p for p in out if p.likely_indoor]
    # Diet-suitable food first, then real (needs-review) before illustrative samples.
    out.sort(key=lambda p: (p.suits_diet is False, p.status == "sample"))
    return out


def is_outdoor(kind: str, name: str, note: str = "") -> bool:
    if kind in INDOOR_KINDS:
        return False
    return kind in OUTDOOR_KINDS or bool(OUTDOOR_WORDS.search(f"{name} {note}"))


def find_affected_items(
    itinerary: Itinerary,
    day: int | None = None,
    kinds: list[str] | None = None,
    outdoor: bool | None = None,
    pinned: set[str] | None = None,
) -> list[dict[str, Any]]:
    pinned = pinned or set()
    out = []
    for d in itinerary.days:
        if day is not None and d.day != day:
            continue
        for i, s in enumerate(d.stops):
            if kinds and s.kind not in kinds:
                continue
            if outdoor is not None and is_outdoor(s.kind, s.name, s.note) != outdoor:
                continue
            out.append({"day": d.day, "index": i, "cityId": d.cityId, "name": s.name, "kind": s.kind, "pinned": pin_key(d.cityId, s.name) in pinned})
    return out


def estimate_travel_time(from_city: str, to_city: str, mode: str = "shinkansen", data: PlaceData | None = None) -> dict[str, Any]:
    data = data or load_places()
    a, b = data.cities.get(from_city), data.cities.get(to_city)
    if not a or not b:
        return {"status": "unknown_city"}
    km = round(distance_km(a.lat, a.lng, b.lat, b.lng))
    return {"status": "estimate", "km": km, "hours": estimate_hours(mode, km), "note": "Straight-line estimate from coordinates, not a timetable."}


def get_itinerary(itinerary: Itinerary | None) -> dict[str, Any]:
    if itinerary is None:
        return {"status": "none"}
    return {
        "days": [
            {"day": d.day, "cityId": d.cityId, "title": d.title, "stops": [{"index": i, "name": s.name, "kind": s.kind} for i, s in enumerate(d.stops)]}
            for d in itinerary.days
        ]
    }


# --- tool definitions for the live model ---------------------------------------------------

TOOL_DEFS: list[dict[str, Any]] = [
    {
        "name": "get_itinerary",
        "description": "Return the traveller's current itinerary: days, cities and stops with their indexes.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "find_affected_items",
        "description": "List stops matching a day, stop kinds or outdoor/indoor. Includes whether each stop is pinned.",
        "input_schema": {
            "type": "object",
            "properties": {
                "day": {"type": ["integer", "null"]},
                "kinds": {"type": ["array", "null"], "items": {"type": "string"}},
                "outdoor": {"type": ["boolean", "null"]},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "search_places",
        "description": "Search our place data in one city (food places with diet suitability, heritage sites, anime and regional spots). Only these can be referenced by id.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city_id": {"type": "string"},
                "kinds": {"type": ["array", "null"], "items": {"type": "string"}},
                "indoor_only": {"type": "boolean"},
            },
            "required": ["city_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "estimate_travel_time",
        "description": "Rough travel distance and hours between two cities from coordinates (an estimate, not a timetable).",
        "input_schema": {
            "type": "object",
            "properties": {"from_city": {"type": "string"}, "to_city": {"type": "string"}, "mode": {"type": "string"}},
            "required": ["from_city", "to_city"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_weather",
        "description": "Weather for a city and date if a live provider is configured; otherwise says it is not connected.",
        "input_schema": {
            "type": "object",
            "properties": {"city_id": {"type": "string"}, "date": {"type": ["string", "null"]}},
            "required": ["city_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_transit_status",
        "description": "Live train/transit status. Not connected in this build; returns an honest message and link.",
        "input_schema": {"type": "object", "properties": {"line_or_route": {"type": "string"}}, "required": ["line_or_route"], "additionalProperties": False},
    },
    {
        "name": "get_attraction_hours",
        "description": "Opening hours, only from verified data. Returns 'unverified' if we don't have them.",
        "input_schema": {"type": "object", "properties": {"place": {"type": "string"}}, "required": ["place"], "additionalProperties": False},
    },
    {
        "name": "propose_patch",
        "description": (
            "Finish by proposing a PATCH to the itinerary (never a full rewrite). ops: add_stop {day,index?,stop}, "
            "remove_stop {day,index}, replace_stop {day,index,stop}, move_stop {day,index,to_day,to_index?}, "
            "add_day {after_day,cityId,title,stops}, remove_day {day}, resize_day {day,keep:[indexes]}. "
            "stop = {name, kind, foodSpotId|null, heritageId|null, note}. Day numbers refer to the CURRENT itinerary. "
            "Never touch pinned stops. List anything the traveller must change with a provider in booking_notes."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "ops": {"type": "array", "items": {"type": "object"}},
                "booking_notes": {"type": "array", "items": {"type": "string"}},
            },
            "required": ["summary", "ops"],
            "additionalProperties": False,
        },
    },
]


def run_tool(name: str, args: dict[str, Any], itinerary: Itinerary | None, pinned: set[str], diet: str | None) -> Any:
    import datetime as dt

    if name == "get_itinerary":
        return get_itinerary(itinerary)
    if name == "find_affected_items":
        if itinerary is None:
            return []
        return find_affected_items(itinerary, args.get("day"), args.get("kinds"), args.get("outdoor"), pinned)
    if name == "search_places":
        return [asdict(p) for p in search_places(args["city_id"], args.get("kinds"), diet, indoor_only=bool(args.get("indoor_only")))][:12]
    if name == "estimate_travel_time":
        return estimate_travel_time(args["from_city"], args["to_city"], args.get("mode") or "shinkansen")
    if name == "get_weather":
        date = None
        if args.get("date"):
            try:
                date = dt.date.fromisoformat(args["date"])
            except ValueError:
                date = None
        return get_weather(args["city_id"], date)
    if name == "get_transit_status":
        return get_transit_status(args["line_or_route"])
    if name == "get_attraction_hours":
        return get_attraction_hours(args["place"])
    return {"error": f"unknown tool {name}"}
