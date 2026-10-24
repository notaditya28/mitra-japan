"""Grounding and feasibility checks applied to every itinerary before it is shown.

Grounding: every destination must exist in our data. Days in an unknown city
are dropped (with a notice); unknown food-spot or heritage references are
cleared and flagged. Free-text stops are kept but marked as suggestions.

Feasibility: rough, honest checks from real coordinates — too many stops,
long transfers, and stops spread far apart are flagged, never hidden.
"""

from __future__ import annotations

from .data import PlaceData, distance_km
from .schema import PACE_STOPS, Day, Flag, Itinerary, Meals, RawDay, RawPlan, Stay, Stop, Transport

MAX_COMFORTABLE_STOPS = 5
#: Rough door-to-door speeds in km/h, used only for labelled estimates.
SPEED_KMH = {
    "shinkansen": 200.0,
    "limited-express": 80.0,
    "local-train": 45.0,
    "bus": 45.0,
    "ferry": 25.0,
    "walk": 4.5,
    "none": 60.0,
}
FLIGHT_SPEED_KMH = 650.0
FLIGHT_OVERHEAD_H = 2.5
LONG_TRANSFER_KM = 900.0
SPREAD_KM = 60.0


def estimate_hours(mode: str, km: float) -> float:
    if km < 1:
        return 0.0
    if mode == "flight":
        return round(km / FLIGHT_SPEED_KMH + FLIGHT_OVERHEAD_H, 1)
    return round(km / SPEED_KMH.get(mode, 60.0), 1)


def _ground_stop(raw, data: PlaceData, day_city: str, flags: list[Flag]) -> Stop:
    food_id = raw.foodSpotId
    heritage_id = raw.heritageId
    if food_id is not None and food_id not in data.food:
        flags.append(Flag(code="unknown-place", message=f"Removed an unknown food place reference ({food_id})."))
        food_id = None
    if heritage_id is not None and heritage_id not in data.heritage:
        flags.append(Flag(code="unknown-place", message=f"Removed an unknown heritage reference ({heritage_id})."))
        heritage_id = None
    if food_id is not None and data.food[food_id].city_id != day_city:
        flags.append(
            Flag(code="unknown-place", message=f"{data.food[food_id].title} is not in this day's city; reference removed.")
        )
        food_id = None
    lat = lng = None
    if food_id is not None:
        lat, lng = data.food[food_id].lat, data.food[food_id].lng
    elif heritage_id is not None:
        lat, lng = data.heritage[heritage_id].lat, data.heritage[heritage_id].lng
    else:
        # A named layer spot in this city (anime / regional) has real coordinates too.
        spot = next((s for s in data.layers_for(day_city) if s.name == raw.name), None)
        if spot is not None:
            lat, lng = spot.lat, spot.lng
    return Stop(
        name=raw.name,
        kind=raw.kind,
        foodSpotId=food_id,
        heritageId=heritage_id,
        note=raw.note,
        inOurData=food_id is not None or heritage_id is not None,
        slot=raw.slot,
        durationMinutes=raw.durationMinutes,
        lat=lat,
        lng=lng,
    )


def ground_day(raw: RawDay, data: PlaceData, previous_city: str | None) -> Day | None:
    """Ground one day, or return None if its city is not in our data."""
    if raw.cityId not in data.cities:
        return None
    flags: list[Flag] = []
    stops = [_ground_stop(s, data, raw.cityId, flags) for s in raw.stops]
    city = data.cities[raw.cityId]

    from_city = raw.transport.fromCityId if raw.transport.fromCityId in data.cities else previous_city
    km = hours = None
    if from_city and from_city != raw.cityId:
        a = data.cities[from_city]
        km = round(distance_km(a.lat, a.lng, city.lat, city.lng))
        hours = estimate_hours(raw.transport.mode, km)
        if km > LONG_TRANSFER_KM and raw.transport.mode != "flight":
            flags.append(Flag(code="long-transfer", message=f"About {km} km from the previous city; consider flying."))

    # The pace sets how many stops are comfortable (team guide: relaxed 2-3, fast 5-6).
    comfortable = PACE_STOPS[raw.pace][1] if raw.pace else MAX_COMFORTABLE_STOPS
    if len(stops) > comfortable:
        pace = f" at a {raw.pace} pace" if raw.pace else ""
        flags.append(Flag(code="overpacked", message=f"{len(stops)} stops is a lot for one day{pace}."))
    elif hours is not None and hours > 3.5 and len(stops) > 3:
        flags.append(
            Flag(code="overpacked", message=f"About {hours} h of travel plus {len(stops)} stops; consider fewer stops.")
        )

    located = [
        (data.food[s.foodSpotId].lat, data.food[s.foodSpotId].lng)
        if s.foodSpotId
        else (data.heritage[s.heritageId].lat, data.heritage[s.heritageId].lng)
        for s in stops
        if s.foodSpotId or s.heritageId
    ]
    for (lat1, lng1), (lat2, lng2) in zip(located, located[1:]):
        if distance_km(lat1, lng1, lat2, lng2) > SPREAD_KM:
            flags.append(Flag(code="spread-out", message="Two stops on this day are far apart; allow extra travel time."))
            break

    return Day(
        day=raw.day,
        cityId=raw.cityId,
        title=raw.title,
        stops=stops,
        transport=Transport(
            mode=raw.transport.mode,
            fromCityId=from_city if from_city != raw.cityId else None,
            note=raw.transport.note,
            estimatedHours=hours,
            distanceKm=km,
        ),
        stay=Stay(area=raw.stay.area, type=raw.stay.type, note=raw.stay.note),
        foodNotes=raw.foodNotes,
        foodReasons=raw.foodReasons,
        tips=raw.tips,
        flags=flags,
        meals=Meals(**raw.meals.model_dump()),
        pace=raw.pace,
    )


def ground_plan(raw: RawPlan, data: PlaceData, *, source: str, model: str | None) -> Itinerary:
    days: list[Day] = []
    notices: list[str] = []
    previous: str | None = None
    for raw_day in sorted(raw.days, key=lambda d: d.day):
        day = ground_day(raw_day, data, previous)
        if day is None:
            notices.append(f"Removed day {raw_day.day}: '{raw_day.cityId}' is not a place we have data for.")
            continue
        days.append(day)
        previous = day.cityId
    # Renumber so the days stay 1..n after any removal.
    for i, d in enumerate(days, start=1):
        d.day = i
    if not days:
        raise ValueError("No days left after grounding")
    return Itinerary(
        summary=raw.summary,
        days=days,
        visaChecklist=raw.visaChecklist,
        bestSeason=raw.bestSeason,
        etiquetteTips=raw.etiquetteTips,
        source=source,  # type: ignore[arg-type]
        model=model,
        notices=notices,
    )
