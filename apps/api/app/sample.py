"""Deterministic sample itineraries for Demo mode (no API key) and AI fallbacks.

Built only from our seeded data, always returned with source="sample" so the
UI labels it as such. Never presented as an AI result.
"""

from __future__ import annotations

import re

from .data import PlaceData, distance_km
from .schema import Itinerary, RawDay, RawPlan, RawStay, RawStop, RawTransport
from .validate import ground_plan

#: City order per persona; the first N become the route.
ROUTES: dict[str, list[str]] = {
    "family": ["tokyo", "hakone", "kyoto", "nara", "osaka", "hiroshima", "miyajima", "kanazawa"],
    "honeymoon": ["tokyo", "hakone", "kyoto", "kanazawa", "takayama", "osaka", "naha"],
    "student": ["tokyo", "nikko", "kyoto", "osaka", "hiroshima", "fukuoka", "takayama"],
    "foodie": ["tokyo", "kyoto", "osaka", "fukuoka", "sapporo", "kanazawa", "hiroshima"],
    "spiritual": ["tokyo", "kamakura", "kyoto", "nara", "koyasan", "miyajima", "nikko"],
}
DEFAULT_ROUTE = ["tokyo", "hakone", "kyoto", "nara", "osaka", "hiroshima", "kanazawa"]
PACE = {"family": 2, "honeymoon": 2, "spiritual": 3, "student": 3, "foodie": 3}

_DAYS_RE = re.compile(r"(\d{1,2})\s*(?:-|\s)?\s*(?:days?|nights?|din|दिन|દિવસ)", re.IGNORECASE)


def days_from_prompt(prompt: str, default: int = 5) -> int:
    m = _DAYS_RE.search(prompt)
    if not m:
        return default
    return max(1, min(14, int(m.group(1))))


def _mode(km: float, a: str, b: str) -> str:
    if "naha" in (a, b) or "sapporo" in (a, b) or km > 900:
        return "flight"
    if km < 25:
        return "local-train"
    if km < 130:
        return "limited-express"
    return "shinkansen"


def _route(persona: str | None, n: int) -> list[str]:
    base = ROUTES.get(persona or "", DEFAULT_ROUTE)
    route: list[str] = []
    for i in range(n):
        # Stay two nights in a city before moving on once the list runs out.
        route.append(base[i] if i < len(base) else base[(i - len(base)) % len(base)])
    return route


def sample_plan(
    data: PlaceData,
    *,
    persona: str | None,
    diet: str,
    days: int,
) -> Itinerary:
    route = _route(persona, days)
    pace = PACE.get(persona or "", 3)
    raw_days: list[RawDay] = []
    previous: str | None = None
    for i, city_id in enumerate(route, start=1):
        city = data.cities[city_id]
        stops: list[RawStop] = [
            RawStop(name=f"Explore {city.name}", kind="culture", note=city.culture),
        ]
        for h in data.heritage_near(city_id)[:1]:
            stops.append(RawStop(name=h.place, kind="heritage", heritageId=h.id, note=h.story))
        for s in data.layers_for(city_id)[:1]:
            if persona in {"student", "foodie"} or s.layer == "regional":
                stops.append(RawStop(name=s.name, kind="anime" if s.layer == "anime" else "sight", note=s.note))
        suited = [f for f in data.food_for(city_id) if diet == "none" or diet in f.diets]
        for f in suited[:1]:
            stops.append(RawStop(name=f.title, kind="food", foodSpotId=f.id, note=f.note))
        stops = stops[: pace + 1]

        if previous and previous != city_id:
            a, b = data.cities[previous], city
            km = distance_km(a.lat, a.lng, b.lat, b.lng)
            mode = _mode(km, previous, city_id)
            transport = RawTransport(mode=mode, fromCityId=previous, note=f"From {a.name}; check current timetables.")
        else:
            transport = RawTransport(mode="local-train", fromCityId=None, note="Get around by local train and walking.")

        risks = sorted({r for f in suited for r in f.risks})
        reasons = [f"{city.name}: {city.veg}"]
        if risks:
            reasons.append("Double-check: " + ", ".join(risks) + ".")
        raw_days.append(
            RawDay(
                day=i,
                cityId=city_id,
                title=f"{city.name}" + (" (another day)" if previous == city_id else ""),
                stops=stops,
                transport=transport,
                stay=RawStay(
                    area=city.name,
                    type="temple-lodging" if city_id == "koyasan" else "ryokan" if city_id == "hakone" else "hotel",
                    note="Sample suggestion; book what suits you.",
                ),
                foodNotes=city.veg,
                foodReasons=reasons,
                tips=[city.season],
            )
        )
        previous = city_id

    raw = RawPlan(
        summary=f"A {days}-day sample route built from our city data. It is not an AI plan.",
        days=raw_days,
        visaChecklist=[
            "Passport valid for your whole trip (confirm with official source).",
            "Visa application form and recent photo (confirm with official source).",
            "Day-by-day itinerary and hotel bookings (confirm with official source).",
            "Recent bank statements and income tax returns (confirm with official source).",
        ],
        bestSeason="Spring (late March to April) and autumn (November) are popular; summer is hot and humid.",
        etiquetteTips=[
            "Carry a small towel and a bag for your rubbish; public bins are rare.",
            "Take your shoes off where you see a step up or slippers at the entrance.",
            "Show the staff card before ordering so the kitchen can check stocks and sauces.",
        ],
    )
    return ground_plan(raw, data, source="sample", model=None)
