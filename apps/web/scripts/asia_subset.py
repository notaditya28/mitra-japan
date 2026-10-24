"""Cut Natural Earth 10m admin-0 (India point of view) down to the Delhi-Tokyo flight window."""
import json, sys

SRC, OUT = sys.argv[1], sys.argv[2]
LON = (55.0, 155.0)
LAT = (-12.0, 58.0)
TOL = 0.07  # degrees

def dp(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        n2 = dx * dx + dy * dy
        best, idx = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if n2 == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / n2
                t = max(0, min(1, t))
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > best:
                best, idx = d, i
        if best > tol * tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]

def inside(ring):
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return not (max(xs) < LON[0] or min(xs) > LON[1] or max(ys) < LAT[0] or min(ys) > LAT[1])

def area(ring):
    return abs(sum(ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1] for i in range(len(ring) - 1))) / 2

src = json.load(open(SRC, encoding="utf-8"))
out = []
for f in src["features"]:
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    kept = []
    for poly in polys:
        outer = poly[0]
        if not inside(outer) or area(outer) < 0.02:
            continue
        rings = []
        for ring in poly:
            r = dp(ring, TOL)
            if len(r) >= 4:
                rings.append([[round(x, 2), round(y, 2)] for x, y in r])
        if rings:
            kept.append(rings)
    if kept:
        p = f["properties"]
        out.append({"type": "Feature", "properties": {"id": p["ADM0_A3"], "name": p["NAME"]},
                    "geometry": {"type": "MultiPolygon", "coordinates": kept}})
fc = {"type": "FeatureCollection", "features": out}
json.dump(fc, open(OUT, "w", encoding="utf-8"), separators=(",", ":"))
print(len(out), "countries", sorted(f["properties"]["id"] for f in out))
