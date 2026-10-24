"""Itinerary patches: small, explicit edits instead of regenerating the trip.

A patch is a list of operations (add / remove / replace / move a stop, add / remove a day,
resize a day). Applying one works on a copy, then runs the same schema validation, destination
check and feasibility check as the planner. Pinned stops are never touched unless the traveller
explicitly allows it. Every applied patch returns an undo token.
"""

from __future__ import annotations

import copy
import secrets
import threading
from collections import OrderedDict
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, ValidationError

from app.data import PlaceData, load as load_places
from app.schema import MAX_DAYS, MAX_STOPS, Itinerary, RawPlan, StopKind
from app.validate import ground_plan


class StopIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    kind: StopKind
    foodSpotId: str | None = None
    heritageId: str | None = None
    note: str = Field(default="", max_length=400)


class _Op(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(default="", max_length=300)


class AddStop(_Op):
    op: Literal["add_stop"]
    day: int = Field(ge=1, le=MAX_DAYS)
    index: int | None = Field(default=None, ge=0, le=MAX_STOPS)
    stop: StopIn


class RemoveStop(_Op):
    op: Literal["remove_stop"]
    day: int = Field(ge=1, le=MAX_DAYS)
    index: int = Field(ge=0, le=MAX_STOPS)


class ReplaceStop(_Op):
    op: Literal["replace_stop"]
    day: int = Field(ge=1, le=MAX_DAYS)
    index: int = Field(ge=0, le=MAX_STOPS)
    stop: StopIn


class MoveStop(_Op):
    op: Literal["move_stop"]
    day: int = Field(ge=1, le=MAX_DAYS)
    index: int = Field(ge=0, le=MAX_STOPS)
    to_day: int = Field(ge=1, le=MAX_DAYS)
    to_index: int | None = Field(default=None, ge=0, le=MAX_STOPS)


class AddDay(_Op):
    op: Literal["add_day"]
    after_day: int = Field(ge=0, le=MAX_DAYS)
    cityId: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=120)
    stops: list[StopIn] = Field(min_length=1, max_length=MAX_STOPS)


class RemoveDay(_Op):
    op: Literal["remove_day"]
    day: int = Field(ge=1, le=MAX_DAYS)


class ResizeDay(_Op):
    """Keep only the listed stop indexes of a day (in that order)."""

    op: Literal["resize_day"]
    day: int = Field(ge=1, le=MAX_DAYS)
    keep: list[int] = Field(min_length=1, max_length=MAX_STOPS)


PatchOp = Annotated[Union[AddStop, RemoveStop, ReplaceStop, MoveStop, AddDay, RemoveDay, ResizeDay], Field(discriminator="op")]


class Patch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: str = Field(min_length=1, max_length=300)
    ops: list[PatchOp] = Field(min_length=1, max_length=20)
    #: Things the traveller must do themselves (e.g. change a real booking with the provider).
    booking_notes: list[str] = Field(default_factory=list, max_length=6)


PATCH_ADAPTER = TypeAdapter(Patch)


class StopDiff(BaseModel):
    name: str
    kind: str
    status: Literal["kept", "added", "removed", "moved-in", "moved-out", "replaced"]
    pinned: bool = False


class DayDiff(BaseModel):
    day: int
    cityId: str
    title: str
    status: Literal["unchanged", "changed", "added", "removed"]
    stops: list[StopDiff]


class Diff(BaseModel):
    days: list[DayDiff]
    changed: int
    unchanged_stops: int
    added_stops: int
    removed_stops: int


class PatchResult(BaseModel):
    ok: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    itinerary: Itinerary | None = None
    diff: Diff | None = None


def pin_key(city_id: str, name: str) -> str:
    return f"{city_id}|{name}"


def _stop_dict(stop: StopIn) -> dict:
    return stop.model_dump()


def _raw_day(d: dict) -> dict:
    return {
        "day": d["day"],
        "cityId": d["cityId"],
        "title": d["title"],
        "stops": [{k: s.get(k) for k in ("name", "kind", "foodSpotId", "heritageId", "note")} for s in d["stops"]],
        "transport": {k: d["transport"].get(k) for k in ("mode", "fromCityId", "note")},
        "stay": dict(d["stay"]),
        "foodNotes": d.get("foodNotes", ""),
        "foodReasons": d.get("foodReasons", [])[:6],
        "tips": d.get("tips", [])[:6],
    }


def apply_patch(
    itinerary: Itinerary,
    patch: Patch,
    pinned: set[str] | None = None,
    *,
    allow_pinned: bool = False,
    data: PlaceData | None = None,
) -> PatchResult:
    data = data or load_places()
    pinned = pinned or set()
    days = copy.deepcopy([d.model_dump(mode="json") for d in itinerary.days])
    errors: list[str] = []

    def find(day: int) -> dict | None:
        return next((d for d in days if d["day"] == day), None)

    def check_pin(d: dict, idx: int, action: str) -> bool:
        s = d["stops"][idx]
        if not allow_pinned and pin_key(d["cityId"], s["name"]) in pinned:
            errors.append(f"'{s['name']}' on day {d['day']} is pinned; I won't {action} it without your OK.")
            return False
        return True

    for op in patch.ops:
        if isinstance(op, AddDay):
            if op.cityId not in data.cities:
                errors.append(f"'{op.cityId}' is not a city we have data for.")
                continue
            new = {
                "day": op.after_day + 0.5,
                "cityId": op.cityId,
                "title": op.title,
                "stops": [_stop_dict(s) for s in op.stops],
                "transport": {"mode": "none", "fromCityId": None, "note": ""},
                "stay": {"area": "", "type": "hotel", "note": ""},
                "foodNotes": "",
                "foodReasons": [],
                "tips": [],
                "_added": True,
            }
            days.append(new)
            continue
        d = find(op.day)
        if d is None:
            errors.append(f"Day {op.day} is not in this itinerary.")
            continue
        if isinstance(op, RemoveDay):
            if any(not check_pin(d, i, "remove") for i in range(len(d["stops"]))):
                continue
            days.remove(d)
        elif isinstance(op, AddStop):
            idx = len(d["stops"]) if op.index is None else min(op.index, len(d["stops"]))
            d["stops"].insert(idx, {**_stop_dict(op.stop), "_added": True})
        elif isinstance(op, (RemoveStop, ReplaceStop, MoveStop)):
            if op.index >= len(d["stops"]):
                errors.append(f"Day {op.day} has no stop number {op.index + 1}.")
                continue
            if not check_pin(d, op.index, "change"):
                continue
            if isinstance(op, RemoveStop):
                d["stops"].pop(op.index)
            elif isinstance(op, ReplaceStop):
                d["stops"][op.index] = {**_stop_dict(op.stop), "_added": True, "_replaced": d["stops"][op.index]["name"]}
            else:
                target = find(op.to_day)
                if target is None:
                    errors.append(f"Day {op.to_day} is not in this itinerary.")
                    continue
                s = d["stops"].pop(op.index)
                s["_moved"] = True
                pos = len(target["stops"]) if op.to_index is None else min(op.to_index, len(target["stops"]))
                target["stops"].insert(pos, s)
        elif isinstance(op, ResizeDay):
            if any(i >= len(d["stops"]) for i in op.keep):
                errors.append(f"Day {op.day} doesn't have all of those stops.")
                continue
            dropped = [i for i in range(len(d["stops"])) if i not in op.keep]
            if any(not check_pin(d, i, "remove") for i in dropped):
                continue
            d["stops"] = [d["stops"][i] for i in op.keep]

    if errors:
        return PatchResult(ok=False, errors=errors)

    days.sort(key=lambda x: x["day"])
    for i, d in enumerate(days, start=1):
        d["day"] = i
    empty = [d for d in days if not d["stops"]]
    if empty:
        return PatchResult(ok=False, errors=[f"Day {d['day']} would have no stops left." for d in empty])

    raw = {
        "summary": itinerary.summary,
        "days": [_raw_day(d) for d in days],
        "visaChecklist": itinerary.visaChecklist,
        "bestSeason": itinerary.bestSeason,
        "etiquetteTips": itinerary.etiquetteTips,
    }
    try:
        new = ground_plan(RawPlan.model_validate(raw), data, source=itinerary.source, model=itinerary.model)
    except ValidationError as e:
        return PatchResult(ok=False, errors=[_friendly(err) for err in e.errors()][:5])
    except ValueError as e:
        return PatchResult(ok=False, errors=[str(e)])

    dropped_days = [n for n in new.notices if n.startswith("Removed day")]
    if dropped_days:
        return PatchResult(ok=False, errors=dropped_days)
    new.notices = itinerary.notices

    warnings = []
    before_flags = {(d.cityId, f.code) for d in itinerary.days for f in d.flags}
    for d in new.days:
        for f in d.flags:
            if (d.cityId, f.code) not in before_flags:
                warnings.append(f"Day {d.day}: {f.message}")
    return PatchResult(ok=True, warnings=warnings, itinerary=new, diff=diff(itinerary, new, days, pinned))


def _friendly(err: dict) -> str:
    loc = ".".join(str(p) for p in err.get("loc", []))
    msg = err.get("msg", "invalid")
    if "too_long" in err.get("type", "") or "at most" in msg:
        return f"Too many items ({loc}): {msg}"
    return f"{loc}: {msg}"


def diff(before: Itinerary, after: Itinerary, raw_after: list[dict], pinned: set[str]) -> Diff:
    before_names = {(d.cityId, s.name) for d in before.days for s in d.stops}
    after_names = {(d.cityId, s.name) for d in after.days for s in d.stops}
    days: list[DayDiff] = []
    unchanged = added = removed = 0
    for d, raw in zip(after.days, raw_after):
        stops = []
        for s, rs in zip(d.stops, raw["stops"]):
            if rs.get("_replaced"):
                status = "replaced"
                added += 1
            elif rs.get("_moved"):
                status = "moved-in"
            elif rs.get("_added") or (d.cityId, s.name) not in before_names:
                status = "added"
                added += 1
            else:
                status = "kept"
                unchanged += 1
            stops.append(StopDiff(name=s.name, kind=s.kind, status=status, pinned=pin_key(d.cityId, s.name) in pinned))
        old = next((b for b in before.days if b.title == d.title and b.cityId == d.cityId), None)
        if raw.get("_added"):
            status_d = "added"
        elif old is not None and [s.name for s in old.stops] == [s.name for s in d.stops]:
            status_d = "unchanged"
        else:
            status_d = "changed"
        days.append(DayDiff(day=d.day, cityId=d.cityId, title=d.title, status=status_d, stops=stops))
    # Stops that disappeared entirely, shown on the day they were removed from.
    for b in before.days:
        gone = [s for s in b.stops if (b.cityId, s.name) not in after_names]
        if not gone:
            continue
        removed += len(gone)
        target = next((x for x in days if x.title == b.title and x.cityId == b.cityId), None)
        if target is None:
            days.append(
                DayDiff(day=b.day, cityId=b.cityId, title=b.title, status="removed", stops=[StopDiff(name=s.name, kind=s.kind, status="removed") for s in b.stops])
            )
        else:
            target.status = "changed"
            target.stops += [StopDiff(name=s.name, kind=s.kind, status="removed") for s in gone]
    changed = sum(1 for d in days if d.status != "unchanged")
    return Diff(days=sorted(days, key=lambda x: (x.day, x.status == "removed")), changed=changed, unchanged_stops=unchanged, added_stops=added, removed_stops=removed)


# --- undo -----------------------------------------------------------------------------------


class UndoStore:
    """Previous itineraries by token, in memory, bounded. The browser also keeps its own copy."""

    def __init__(self, size: int = 300) -> None:
        self._items: OrderedDict[str, tuple[str, Itinerary]] = OrderedDict()
        self._lock = threading.Lock()
        self.size = size

    def put(self, session_id: str, itinerary: Itinerary) -> str:
        token = secrets.token_urlsafe(12)
        with self._lock:
            self._items[token] = (session_id, itinerary)
            while len(self._items) > self.size:
                self._items.popitem(last=False)
        return token

    def pop(self, session_id: str, token: str) -> Itinerary | None:
        with self._lock:
            item = self._items.get(token)
            if item is None or item[0] != session_id:
                return None
            del self._items[token]
            return item[1]


UNDO = UndoStore()
