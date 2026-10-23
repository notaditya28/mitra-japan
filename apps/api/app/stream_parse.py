"""Pull completed day objects out of a JSON document while it is still streaming.

The planner's output is one JSON object with a "days" array. As text arrives
we scan for that array and emit each day object as soon as its closing brace
lands, so the map can draw the route day by day. The final document is still
parsed and validated in full afterwards; these early days are previews only.
"""

from __future__ import annotations

import json
from typing import Any


class DayStreamParser:
    def __init__(self) -> None:
        self._buf = ""
        self._pos = 0  # next char to scan
        self._array_start: int | None = None
        self._depth = 0  # depth inside the days array (1 = between day objects)
        self._in_str = False
        self._escape = False
        self._obj_start: int | None = None

    def feed(self, chunk: str) -> list[dict[str, Any]]:
        self._buf += chunk
        out: list[dict[str, Any]] = []
        if self._array_start is None:
            key = self._buf.find('"days"')
            if key == -1:
                return out
            bracket = self._buf.find("[", key)
            if bracket == -1:
                return out
            self._array_start = bracket
            self._pos = bracket + 1
            self._depth = 1

        buf = self._buf
        i = self._pos
        while i < len(buf) and self._depth > 0:
            ch = buf[i]
            if self._in_str:
                if self._escape:
                    self._escape = False
                elif ch == "\\":
                    self._escape = True
                elif ch == '"':
                    self._in_str = False
            elif ch == '"':
                self._in_str = True
            elif ch in "{[":
                if self._depth == 1 and ch == "{":
                    self._obj_start = i
                self._depth += 1
            elif ch in "}]":
                self._depth -= 1
                if self._depth == 1 and ch == "}" and self._obj_start is not None:
                    try:
                        value = json.loads(buf[self._obj_start : i + 1])
                        if isinstance(value, dict):
                            out.append(value)
                    except json.JSONDecodeError:
                        pass  # malformed preview; the full document is validated later
                    self._obj_start = None
            i += 1
        self._pos = i
        return out
