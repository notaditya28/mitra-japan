"""Deterministic sample itineraries for Demo mode (no API key) and AI fallbacks.

Built only from our seeded data, always returned with source="sample" so the
UI labels it as such. Never presented as an AI result. Honours the team guide's
structured inputs: starting city, pace (stops per day), interests and diets.
"""

from __future__ import annotations

import re

from .data import PlaceData, distance_km
from .schema import PACE_STOPS, Itinerary, RawDay, RawMeals, RawPlan, RawStay, RawStop, RawTransport
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
#: Default pace per persona when the traveller doesn't choose one.
PERSONA_PACE = {"family": "relaxed", "honeymoon": "relaxed", "spiritual": "moderate", "student": "moderate", "foodie": "moderate"}
#: Rough time to allow per kind of stop, in minutes (estimates).
DURATION = {"culture": 120, "heritage": 90, "food": 60, "sight": 90, "anime": 90, "temple": 90, "nature": 120}
SLOTS = ("morning", "afternoon", "evening")

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


def _nearest_first(start: str, cities: list[str], data: PlaceData) -> list[str]:
    """Greedy nearest-neighbour order from the start, so the route doesn't zig-zag."""
    order, left = [start], [c for c in cities if c != start]
    while left:
        here = data.cities[order[-1]]
        nxt = min(left, key=lambda c: distance_km(here.lat, here.lng, data.cities[c].lat, data.cities[c].lng))
        order.append(nxt)
        left.remove(nxt)
    return order


def _route(persona: str | None, n: int, start: str | None = None, data: PlaceData | None = None) -> list[str]:
    base = list(ROUTES.get(persona or "", DEFAULT_ROUTE))
    if start and data is not None and start != base[0]:
        # Start where the traveller lands, then visit the persona's first cities nearest-first.
        picks = [start, *[c for c in base if c != start]][: max(n, 2)]
        base = _nearest_first(start, picks, data) + [c for c in base if c not in picks]
    route: list[str] = []
    for i in range(n):
        # Stay two nights in a city before moving on once the list runs out.
        route.append(base[i] if i < len(base) else base[(i - len(base)) % len(base)])
    return route


def _slot(i: int, n: int) -> str:
    return SLOTS[min(2, (i * 3) // max(1, n))]


def _diet_word(diet: str) -> str:
    return {"none": "any", "no-beef": "no-beef"}.get(diet, diet)


def sample_plan(
    data: PlaceData,
    *,
    persona: str | None,
    diet: str,
    days: int,
    start_city: str | None = None,
    pace: str | None = None,
    interests: list[str] | None = None,
    diets: list[str] | None = None,
) -> Itinerary:
    interests = interests or []
    all_diets = [diet, *[d for d in (diets or []) if d != diet]]
    pace = pace or PERSONA_PACE.get(persona or "", "moderate")
    lo, hi = PACE_STOPS[pace]
    route = _route(persona, days, start_city if start_city in data.cities else None, data)
    raw_days: list[RawDay] = []
    previous: str | None = None
    for i, city_id in enumerate(route, start=1):
        city = data.cities[city_id]
        candidates: list[RawStop] = [RawStop(name=f"Explore {city.name}", kind="culture", note=city.culture)]
        for h in data.heritage_near(city_id)[: 2 if "heritage" in interests or "spiritual" in interests else 1]:
            candidates.append(RawStop(name=h.place, kind="heritage", heritageId=h.id, note=h.story))
        for s in data.layers_for(city_id):
            wants_anime = "anime" in interests or persona in {"student", "foodie"}
            if (s.layer == "anime" and wants_anime) or s.layer == "regional":
                candidates.append(RawStop(name=s.name, kind="anime" if s.layer == "anime" else "sight", note=s.note))
        suited = [f for f in data.food_for(city_id) if all(d == "none" or d in f.diets for d in all_diets)]
        food_stops = [RawStop(name=f.title, kind="food", foodSpotId=f.id, note=f.note) for f in suited[:2]]
        # Sights fill the day up to the pace, and the meal stop ends it.
        sights = candidates[: max(lo - len(food_stops[:1]), hi - len(food_stops[:1]))]
        stops = (sights + food_stops[:1])[:hi]
        stops = [
            s.model_copy(update={"slot": _slot(j, len(stops)), "durationMinutes": DURATION.get(s.kind, 90)})
            for j, s in enumerate(stops)
        ]

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
        words = " and ".join(_diet_word(d) for d in all_diets)
        dinner = (
            f"{suited[0].title} ({'illustrative kind of place' if suited[0].status == 'sample' else 'confirm before you go'})"
            if suited
            else f"See the veg-friendly places list for {city.name}, or a convenience store as a back-up."
        )
        lunch = f"Near your morning stop: look for a {words}-friendly place and show the waiter card."
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
                meals=RawMeals(
                    breakfast=f"At your stay: ask the day before for a {words} breakfast.",
                    lunch=lunch,
                    dinner=dinner,
                    dietaryNotes=city.veg,
                ),
                pace=pace,  # type: ignore[arg-type]
            )
        )
        previous = city_id

    raw = RawPlan(
        summary=f"A {days}-day sample route built from our city data at a {pace} pace. It is not an AI plan.",
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
