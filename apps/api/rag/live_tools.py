"""Live-information tools. Interfaces first; each says plainly when it isn't connected, and
nothing here ever invents delays, closures, hours, prices or warnings.

- get_weather: Open-Meteo forecast when WEATHER_PROVIDER=open-meteo (free, no key), otherwise
  "not connected" with a link to the Japan Meteorological Agency.
- get_transit_status: not connected in this build; points to the operator's official site.
- get_attraction_hours: only from verified data (none is verified yet), otherwise "unverified".
"""

from __future__ import annotations

import datetime as dt
import os
from typing import Any, Protocol

import httpx

from app.data import load as load_places

JMA_URL = "https://www.jma.go.jp/bosai/#lang=en"
JR_EAST_URL = "https://www.jreast.co.jp/en/multi/"

# WMO weather codes (Open-Meteo) → plain words.
WMO = {
    0: "clear",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "fog",
    48: "fog",
    51: "light drizzle",
    53: "drizzle",
    55: "heavy drizzle",
    61: "light rain",
    63: "rain",
    65: "heavy rain",
    71: "light snow",
    73: "snow",
    75: "heavy snow",
    80: "rain showers",
    81: "rain showers",
    82: "violent rain showers",
    95: "thunderstorm",
    96: "thunderstorm with hail",
    99: "thunderstorm with hail",
}


class WeatherProvider(Protocol):
    name: str

    def forecast(self, lat: float, lng: float, date: dt.date) -> dict[str, Any]: ...


class OpenMeteo:
    name = "Open-Meteo"
    url = "https://api.open-meteo.com/v1/forecast"

    def forecast(self, lat: float, lng: float, date: dt.date) -> dict[str, Any]:
        params = {
            "latitude": lat,
            "longitude": lng,
            "daily": "weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "timezone": "Asia/Tokyo",
            "start_date": date.isoformat(),
            "end_date": date.isoformat(),
        }
        r = httpx.get(self.url, params=params, timeout=8.0)
        r.raise_for_status()
        d = r.json()["daily"]
        return {
            "conditions": WMO.get(int(d["weathercode"][0]), f"code {d['weathercode'][0]}"),
            "max_c": d["temperature_2m_max"][0],
            "min_c": d["temperature_2m_min"][0],
            "rain_chance_pct": d["precipitation_probability_max"][0],
        }


def weather_provider() -> WeatherProvider | None:
    return OpenMeteo() if os.getenv("WEATHER_PROVIDER", "").lower() == "open-meteo" else None


def get_weather(city_id: str, date: dt.date | None = None) -> dict[str, Any]:
    data = load_places()
    city = data.cities.get(city_id)
    if city is None:
        return {"status": "unknown_city", "message": f"I don't have '{city_id}' in our data."}
    provider = weather_provider()
    if provider is None:
        return {
            "status": "not_connected",
            "message": "Live weather isn't connected in this build. Check the Japan Meteorological Agency.",
            "link": JMA_URL,
        }
    date = date or dt.date.today()
    try:
        f = provider.forecast(city.lat, city.lng, date)
    except (httpx.HTTPError, KeyError, ValueError, IndexError):
        return {"status": "unavailable", "message": "The weather service didn't respond. Check the Japan Meteorological Agency.", "link": JMA_URL}
    return {"status": "live", "source": provider.name, "city": city.name, "date": date.isoformat(), **f, "link": JMA_URL}


def get_transit_status(line_or_route: str) -> dict[str, Any]:
    return {
        "status": "not_connected",
        "message": f"Live transit status for '{line_or_route}' isn't connected; check the operator's official site or ask station staff.",
        "link": JR_EAST_URL,
    }


def get_attraction_hours(place: str) -> dict[str, Any]:
    # No attraction hours are verified in our data yet, so we never state any.
    return {
        "status": "unverified",
        "message": f"I don't have verified opening hours for {place}. Check its official website before you go.",
    }
