"""Place data shared with the web app. The planner may only use what is in here."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .config import settings


@dataclass(frozen=True)
class City:
    id: str
    name: str
    name_ja: str
    lat: float
    lng: float
    tags: tuple[str, ...]
    from_tokyo: str
    season: str
    culture: str
    veg: str
    veg_level: str


@dataclass(frozen=True)
class FoodSpot:
    id: str
    city_id: str
    title: str
    kind: str
    area: str
    lat: float
    lng: float
    diets: tuple[str, ...]
    risks: tuple[str, ...]
    note: str


@dataclass(frozen=True)
class Heritage:
    id: str
    japanese: str
    indian: str
    story: str
    place: str
    lat: float
    lng: float


@dataclass(frozen=True)
class LayerSpot:
    id: str
    city_id: str
    name: str
    lat: float
    lng: float
    note: str
    layer: str


@dataclass(frozen=True)
class PlaceData:
    cities: dict[str, City]
    food: dict[str, FoodSpot]
    heritage: dict[str, Heritage]
    layers: dict[str, LayerSpot]

    def food_for(self, city_id: str) -> list[FoodSpot]:
        return [f for f in self.food.values() if f.city_id == city_id]

    def layers_for(self, city_id: str) -> list[LayerSpot]:
        return [s for s in self.layers.values() if s.city_id == city_id]

    def heritage_near(self, city_id: str, km: float = 60) -> list[Heritage]:
        c = self.cities[city_id]
        return [h for h in self.heritage.values() if distance_km(c.lat, c.lng, h.lat, h.lng) <= km]


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = math.radians
    d_lat, d_lng = r(lat2 - lat1), r(lng2 - lng1)
    h = math.sin(d_lat / 2) ** 2 + math.cos(r(lat1)) * math.cos(r(lat2)) * math.sin(d_lng / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def _read(directory: Path, name: str) -> dict:
    with open(directory / name, encoding="utf8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load(directory: Path | None = None) -> PlaceData:
    d = directory or settings.data_dir
    cities = {
        c["id"]: City(
            id=c["id"], name=c["name"], name_ja=c["nameJa"], lat=c["lat"], lng=c["lng"],
            tags=tuple(c["tags"]), from_tokyo=c["fromTokyo"], season=c["season"],
            culture=c["culture"], veg=c["veg"], veg_level=c["vegLevel"],
        )
        for c in _read(d, "cities.json")["cities"]
    }
    food = {
        s["id"]: FoodSpot(
            id=s["id"], city_id=s["cityId"], title=s["title"], kind=s["kind"], area=s["area"],
            lat=s["lat"], lng=s["lng"], diets=tuple(s["diets"]), risks=tuple(s["risks"]), note=s["note"],
        )
        for s in _read(d, "foodSpots.json")["spots"]
    }
    heritage = {
        h["id"]: Heritage(
            id=h["id"], japanese=h["japanese"], indian=h["indian"], story=h["story"],
            place=h["place"], lat=h["lat"], lng=h["lng"],
        )
        for h in _read(d, "heritage.json")["deities"]
    }
    raw_layers = _read(d, "layers.json")
    layers = {
        s["id"]: LayerSpot(
            id=s["id"], city_id=s["cityId"], name=s["name"], lat=s["lat"], lng=s["lng"],
            note=s["note"], layer=layer,
        )
        for layer in ("anime", "regional")
        for s in raw_layers[layer]
    }
    return PlaceData(cities=cities, food=food, heritage=heritage, layers=layers)
