"""Pydantic models for requests, the model's raw output and the validated itinerary."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .data import PlaceData

Persona = Literal["family", "honeymoon", "student", "foodie", "spiritual"]
Diet = Literal["jain", "vegetarian", "vegan", "halal", "no-beef", "eggless", "none"]
Language = Literal["en", "hi", "gu"]
StopKind = Literal["sight", "food", "temple", "heritage", "anime", "nature", "onsen", "shopping", "culture"]
TransportMode = Literal["walk", "local-train", "shinkansen", "limited-express", "bus", "ferry", "flight", "none"]
StayType = Literal["hotel", "ryokan", "temple-lodging", "hostel", "none"]
#: Team guide planner inputs (MITRA_JAPAN_SYSTEM_GUIDE.md section 2.2).
Pace = Literal["relaxed", "moderate", "fast"]
Slot = Literal["morning", "afternoon", "evening"]
Budget = Literal["budget", "moderate", "premium"]
Interest = Literal["heritage", "nature", "food", "anime", "shopping", "spiritual", "culture"]
StartCity = Literal["tokyo", "kyoto", "osaka"]
#: Stops per day for each pace (team guide: relaxed 2-3, fast 5-6).
PACE_STOPS: dict[str, tuple[int, int]] = {"relaxed": (2, 3), "moderate": (3, 4), "fast": (5, 6)}

MAX_DAYS = 14
MAX_STOPS = 8


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# --- What Claude returns (validated after every call) -------------------------


class RawStop(Strict):
    name: str = Field(min_length=1, max_length=120)
    kind: StopKind
    foodSpotId: str | None = None
    heritageId: str | None = None
    note: str = Field(default="", max_length=400)
    #: Morning, afternoon or evening (team guide's three-phase day).
    slot: Slot = "afternoon"
    #: Rough time to allow, an estimate only.
    durationMinutes: int | None = Field(default=None, ge=10, le=600)


class RawMeals(Strict):
    """Meal suggestions: kinds of meals and where to look, never invented restaurant names."""

    breakfast: str = Field(default="", max_length=200)
    lunch: str = Field(default="", max_length=200)
    dinner: str = Field(default="", max_length=200)
    dietaryNotes: str = Field(default="", max_length=300)


class RawTransport(Strict):
    mode: TransportMode
    fromCityId: str | None = None
    note: str = Field(default="", max_length=300)


class RawStay(Strict):
    area: str = Field(default="", max_length=120)
    type: StayType
    note: str = Field(default="", max_length=300)


class RawDay(Strict):
    day: int = Field(ge=1, le=MAX_DAYS)
    cityId: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=120)
    stops: list[RawStop] = Field(min_length=1, max_length=MAX_STOPS)
    transport: RawTransport
    stay: RawStay
    foodNotes: str = Field(default="", max_length=600)
    foodReasons: list[str] = Field(default_factory=list, max_length=6)
    tips: list[str] = Field(default_factory=list, max_length=6)
    meals: RawMeals = Field(default_factory=RawMeals)
    pace: Pace | None = None


class RawPlan(Strict):
    summary: str = Field(min_length=1, max_length=600)
    days: list[RawDay] = Field(min_length=1, max_length=MAX_DAYS)
    visaChecklist: list[str] = Field(default_factory=list, max_length=10)
    bestSeason: str = Field(default="", max_length=300)
    etiquetteTips: list[str] = Field(default_factory=list, max_length=8)


def _nullable_enum(values: list[str]) -> dict[str, Any]:
    return {"anyOf": [{"type": "string", "enum": values}, {"type": "null"}]}


def _day_schema(data: PlaceData) -> dict[str, Any]:
    """JSON schema for one day. City, food-spot and heritage ids are enums from our data."""
    city_ids = sorted(data.cities)
    text = {"type": "string"}
    return {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "day", "cityId", "title", "stops", "transport", "stay", "foodNotes", "foodReasons", "tips", "meals", "pace",
        ],
        "properties": {
            "day": {"type": "integer"},
            "cityId": {"type": "string", "enum": city_ids},
            "title": text,
            "stops": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["name", "kind", "foodSpotId", "heritageId", "note", "slot", "durationMinutes"],
                    "properties": {
                        "name": text,
                        "kind": {"type": "string", "enum": list(StopKind.__args__)},
                        "foodSpotId": _nullable_enum(sorted(data.food)),
                        "heritageId": _nullable_enum(sorted(data.heritage)),
                        "note": text,
                        "slot": {"type": "string", "enum": list(Slot.__args__)},
                        "durationMinutes": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
                    },
                },
            },
            "transport": {
                "type": "object",
                "additionalProperties": False,
                "required": ["mode", "fromCityId", "note"],
                "properties": {
                    "mode": {"type": "string", "enum": list(TransportMode.__args__)},
                    "fromCityId": _nullable_enum(city_ids),
                    "note": text,
                },
            },
            "stay": {
                "type": "object",
                "additionalProperties": False,
                "required": ["area", "type", "note"],
                "properties": {
                    "area": text,
                    "type": {"type": "string", "enum": list(StayType.__args__)},
                    "note": text,
                },
            },
            "foodNotes": text,
            "foodReasons": {"type": "array", "items": text},
            "tips": {"type": "array", "items": text},
            "meals": {
                "type": "object",
                "additionalProperties": False,
                "required": ["breakfast", "lunch", "dinner", "dietaryNotes"],
                "properties": {"breakfast": text, "lunch": text, "dinner": text, "dietaryNotes": text},
            },
            "pace": {"type": "string", "enum": list(Pace.__args__)},
        },
    }


def plan_json_schema(data: PlaceData) -> dict[str, Any]:
    text = {"type": "string"}
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["summary", "days", "visaChecklist", "bestSeason", "etiquetteTips"],
        "properties": {
            "summary": text,
            "days": {"type": "array", "items": _day_schema(data)},
            "visaChecklist": {"type": "array", "items": text},
            "bestSeason": text,
            "etiquetteTips": {"type": "array", "items": text},
        },
    }


def day_json_schema(data: PlaceData) -> dict[str, Any]:
    return _day_schema(data)


# --- Requests ------------------------------------------------------------------


class PlanRequest(Strict):
    prompt: str = Field(min_length=2, max_length=500)
    persona: Persona | None = None
    diet: Diet = "vegetarian"
    days: int | None = Field(default=None, ge=1, le=MAX_DAYS)
    language: Language = "en"
    #: Structured inputs from the team guide; all optional so older clients keep working.
    startCity: StartCity | None = None
    travellers: int | None = Field(default=None, ge=1, le=12)
    pace: Pace | None = None
    budget: Budget | None = None
    interests: list[Interest] = Field(default_factory=list, max_length=7)
    #: Further diets in the group besides `diet` (e.g. one Jain parent, one vegan child).
    diets: list[Diet] = Field(default_factory=list, max_length=6)
    #: Re-plan: the current itinerary the user wants changed ("make day 3 lighter").
    previous: "Itinerary | None" = None
    #: False returns plain JSON with real HTTP status codes instead of an event stream.
    stream: bool = True

    @field_validator("prompt")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("prompt must not be blank")
        return v


class DayRequest(Strict):
    itinerary: "Itinerary"
    day: int = Field(ge=1, le=MAX_DAYS)
    instruction: str = Field(default="", max_length=300)
    persona: Persona | None = None
    diet: Diet = "vegetarian"
    language: Language = "en"
    pace: Pace | None = None


# --- What the API returns (after grounding and feasibility checks) -------------


class Flag(BaseModel):
    code: Literal["overpacked", "long-transfer", "spread-out", "unknown-place", "dropped-day"]
    message: str


class Stop(BaseModel):
    name: str
    kind: StopKind
    foodSpotId: str | None = None
    heritageId: str | None = None
    note: str = ""
    #: True only when the stop points at a record in our data; free-text stops are suggestions.
    inOurData: bool = False
    slot: Slot = "afternoon"
    #: Rough time to allow (estimate).
    durationMinutes: int | None = None
    #: Real coordinates, only for stops that point at our data (food place, heritage site, layer spot).
    lat: float | None = None
    lng: float | None = None


class Transport(BaseModel):
    mode: TransportMode
    fromCityId: str | None = None
    note: str = ""
    #: Rough distance-based estimate from real coordinates. Always an estimate, never a timetable.
    estimatedHours: float | None = None
    distanceKm: float | None = None


class Stay(BaseModel):
    area: str = ""
    type: StayType
    note: str = ""


class Meals(BaseModel):
    breakfast: str = ""
    lunch: str = ""
    dinner: str = ""
    dietaryNotes: str = ""


class Day(BaseModel):
    day: int
    cityId: str
    title: str
    stops: list[Stop]
    transport: Transport
    stay: Stay
    foodNotes: str = ""
    foodReasons: list[str] = Field(default_factory=list)
    tips: list[str] = Field(default_factory=list)
    flags: list[Flag] = Field(default_factory=list)
    meals: Meals = Field(default_factory=Meals)
    pace: Pace | None = None


class Itinerary(BaseModel):
    summary: str
    days: list[Day]
    visaChecklist: list[str] = Field(default_factory=list)
    bestSeason: str = ""
    etiquetteTips: list[str] = Field(default_factory=list)
    #: "live" = generated by the AI just now; "sample" = seeded sample data.
    source: Literal["live", "sample"]
    model: str | None = None
    notices: list[str] = Field(default_factory=list)


PlanRequest.model_rebuild()
DayRequest.model_rebuild()
