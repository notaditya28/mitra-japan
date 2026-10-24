"""
Fetch the "Japan in pictures" gallery from Wikimedia Commons.

    python -I apps/web/scripts/gallery_media.py            # pick, download, convert
    python -I apps/web/scripts/gallery_media.py --dry-run  # only print the picks

Needs Pillow, and imageio-ffmpeg for the clips (trim, mute, H.264). Every file keeps its
author, licence and Commons page in src/data/gallery.json, and stays `needs-review` until
the owner checks it. Only free licences are accepted (CC BY, CC BY-SA, CC0, public domain).
Pin a specific Commons file with `file` once you've reviewed the automatic pick.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from io import BytesIO
from pathlib import Path

from PIL import Image

WEB = Path(__file__).resolve().parents[1]
OUT = WEB / "public" / "gallery"
DATA = WEB / "src" / "data" / "gallery.json"
API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "MitraJapanDemo/0.1 (gallery curation script; non-commercial demo)"}
WIDTH = 1100
LICENCES = re.compile(r"^(CC BY(-SA)? \d\.\d|CC BY(-SA)? \d\.\d [A-Za-z ]+|CC0|Public domain)$", re.I)
SKIP = re.compile(r"\b(map|logo|diagram|plan|sign|ticket|poster|stamp|coin|interior of a train)\b", re.I)
# Places, not portraits: skip files whose title says the subject is a person.
PEOPLE = re.compile(r"\b(lady|ladies|woman|women|girls?|boys?|man|men|portrait|couple|bride|groom|selfie|maiko|geisha)\b", re.I)

# id, name, place, category, search query, optional pinned Commons file
SITES: list[dict] = [
    {"id": "fushimi-inari", "name": "Fushimi Inari Taisha", "place": "Kyoto", "category": "shrine", "q": "Fushimi Inari Taisha torii"},
    {"id": "kinkakuji", "name": "Kinkaku-ji", "place": "Kyoto", "category": "temple", "q": "Kinkaku-ji"},
    {"id": "kiyomizu-dera", "name": "Kiyomizu-dera", "place": "Kyoto", "category": "temple", "q": "Kiyomizu-dera"},
    {"id": "arashiyama", "name": "Arashiyama bamboo grove", "place": "Kyoto", "category": "nature", "q": "Arashiyama bamboo grove"},
    {"id": "yasaka", "name": "Yasaka Shrine, Gion", "place": "Kyoto", "category": "shrine", "q": "Yasaka Shrine Nishiromon gate",
     "file": "File:Nishiromon Gate, Yasaka Shrine, Kyoto, West view 20190416 1.jpg"},
    {"id": "kyoto-museum", "name": "Kyoto National Museum", "place": "Kyoto", "category": "museum", "q": "Kyoto National Museum"},
    {"id": "sensoji", "name": "Senso-ji", "place": "Tokyo", "category": "temple", "q": "Senso-ji Kaminarimon"},
    {"id": "meiji-jingu", "name": "Meiji Jingu", "place": "Tokyo", "category": "shrine", "q": "Meiji Jingu shrine torii"},
    {"id": "shibuya", "name": "Shibuya Crossing", "place": "Tokyo", "category": "city", "q": "Shibuya crossing"},
    {"id": "skytree", "name": "Tokyo Skytree", "place": "Tokyo", "category": "city", "q": "Tokyo Skytree"},
    {"id": "tokyo-museum", "name": "Tokyo National Museum", "place": "Tokyo", "category": "museum", "q": "Tokyo National Museum Honkan"},
    {"id": "fuji-chureito", "name": "Mount Fuji and Chureito Pagoda", "place": "Yamanashi", "category": "nature", "q": "Chureito Pagoda Mount Fuji"},
    {"id": "hakone-torii", "name": "Hakone Shrine torii on Lake Ashi", "place": "Hakone", "category": "shrine", "q": "Hakone Shrine torii Lake Ashi"},
    {"id": "kamakura-buddha", "name": "Great Buddha of Kamakura", "place": "Kamakura", "category": "temple", "q": "Kotoku-in Great Buddha Kamakura",
     "file": "File:Le Grand Bouddha du Kotoku-in (Kamakura, Japon) (42096289494).jpg"},
    {"id": "nikko-toshogu", "name": "Nikko Toshogu", "place": "Nikko", "category": "shrine", "q": "Nikko Toshogu Yomeimon"},
    {"id": "todaiji", "name": "Todai-ji", "place": "Nara", "category": "temple", "q": "Todai-ji Great Buddha Hall exterior"},
    {"id": "nara-deer", "name": "Deer in Nara Park", "place": "Nara", "category": "nature", "q": "Nara Park deer"},
    {"id": "osaka-castle", "name": "Osaka Castle", "place": "Osaka", "category": "castle", "q": "Osaka Castle main tower"},
    {"id": "dotonbori", "name": "Dotonbori", "place": "Osaka", "category": "city", "q": "Dotonbori Osaka night"},
    {"id": "himeji", "name": "Himeji Castle", "place": "Hyogo", "category": "castle", "q": "Himeji Castle"},
    {"id": "itsukushima", "name": "Itsukushima Shrine", "place": "Miyajima, Hiroshima", "category": "shrine", "q": "Itsukushima Shrine torii"},
    {"id": "genbaku-dome", "name": "Hiroshima Peace Memorial (Genbaku Dome)", "place": "Hiroshima", "category": "history", "q": "Hiroshima Peace Memorial Genbaku Dome"},
    {"id": "hiroshima-museum", "name": "Hiroshima Peace Memorial Museum", "place": "Hiroshima", "category": "museum", "q": "Hiroshima Peace Memorial Museum building"},
    {"id": "shirakawago", "name": "Shirakawa-go", "place": "Gifu", "category": "village", "q": "Shirakawa-go village"},
    {"id": "kenrokuen", "name": "Kenroku-en", "place": "Kanazawa", "category": "garden", "q": "Kenroku-en Kotojitoro"},
    {"id": "matsumoto-castle", "name": "Matsumoto Castle", "place": "Nagano", "category": "castle", "q": "Matsumoto Castle"},
    {"id": "snow-monkeys", "name": "Jigokudani snow monkeys", "place": "Nagano", "category": "nature", "q": "Jigokudani monkey onsen", "file": "File:Onsen Macaque.JPG"},
    {"id": "kusatsu", "name": "Kusatsu Onsen Yubatake", "place": "Gunma", "category": "culture", "q": "Kusatsu Yubatake"},
    {"id": "nachi", "name": "Nachi Falls and pagoda", "place": "Wakayama", "category": "shrine", "q": "Seiganto-ji Nachi Falls pagoda"},
    {"id": "furano", "name": "Lavender fields in Furano", "place": "Hokkaido", "category": "nature", "q": "Furano lavender field"},
    {"id": "otaru", "name": "Otaru Canal", "place": "Hokkaido", "category": "city", "q": "Otaru canal"},
    {"id": "churaumi", "name": "Okinawa Churaumi Aquarium", "place": "Okinawa", "category": "museum", "q": "Okinawa Churaumi Aquarium Kuroshio"},
    {"id": "nebuta", "name": "Aomori Nebuta Matsuri", "place": "Aomori", "category": "festival", "q": "Aomori Nebuta Matsuri float"},
    {"id": "tea-ceremony", "name": "Tea ceremony", "place": "Japan", "category": "culture", "q": "Japanese tea ceremony", "file": "File:Japanese tea ceremony setup in Sapporo, Japan (34).jpg"},
    {"id": "sushi", "name": "Sushi", "place": "Japan", "category": "food", "q": "nigiri sushi plate"},
]

# Short muted clips: id, name, place, category, query, seconds to start at
CLIPS: list[dict] = [
    {"id": "shibuya-clip", "name": "Shibuya Crossing", "place": "Tokyo", "category": "city", "q": "Shibuya crossing time-lapse", "start": 4},
    {"id": "fushimi-clip", "name": "Fushimi Inari Taisha", "place": "Kyoto", "category": "shrine", "q": "Fushimi Inari", "start": 2},
    {"id": "shinkansen-clip", "name": "Shinkansen at Tokyo Station", "place": "Tokyo", "category": "transport", "q": "Shinkansen", "start": 2,
     "file": "File:Shinkansen N700 Series Bullet Train Tokyo Station by Don Ramey Logan.webm"},
    {"id": "festival-clip", "name": "Awa Odori dance festival", "place": "Koenji, Tokyo", "category": "festival", "q": "Awa Odori", "start": 8,
     "file": "File:Awa dance-koenji-aug2017.webm"},
]
CLIP_SECONDS = 10


def get(url: str, timeout: int) -> bytes:
    """GET with a polite pause, backing off on 429/503 as the server asks."""
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                data = r.read()
            time.sleep(1.0)
            return data
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or attempt == 5:
                raise
            wait = int(e.headers.get("Retry-After") or 0) or 10 * (attempt + 1)
            print(f"  (rate limited, waiting {wait} s)", file=sys.stderr, flush=True)
            time.sleep(wait)
    raise RuntimeError("unreachable")


def api(**params) -> dict:
    params.update(format="json", formatversion=2)
    return json.loads(get(API + "?" + urllib.parse.urlencode(params), 60))


def fetch(url: str) -> bytes:
    return get(url, 120)


def plain(value: str | None) -> str:
    text = re.sub(r"<[^>]+>", "", value or "")
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def credit(title: str, meta: dict, changes: str) -> dict:
    def v(k: str) -> str:
        return plain((meta.get(k) or {}).get("value"))

    return {
        "title": title.removeprefix("File:"),
        "author": v("Artist") or v("Credit") or "Unknown author (see source)",
        "licence": v("LicenseShortName"),
        "licenceUrl": (meta.get("LicenseUrl") or {}).get("value") or None,
        "sourceUrl": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"), safe=":/(),"),
        "changes": changes,
    }


def free(meta: dict) -> bool:
    return bool(LICENCES.match(plain((meta.get("LicenseShortName") or {}).get("value"))))


def pick_photo(site: dict) -> dict | None:
    props = dict(prop="imageinfo", iiprop="url|size|extmetadata", iiurlwidth=1600,
                 iiextmetadatafilter="LicenseShortName|LicenseUrl|Artist|Credit")
    if site.get("file"):
        pages = api(action="query", titles=site["file"], **props)["query"]["pages"]
    else:
        pages = []
        for extra in (" incategory:Quality_images", ""):
            q = f'{site["q"]} filetype:bitmap{extra}'
            res = api(action="query", generator="search", gsrsearch=q, gsrnamespace=6, gsrlimit=15, **props)
            pages = sorted(res.get("query", {}).get("pages", []), key=lambda p: p.get("index", 99))
            pages = [p for p in pages if ok_photo(p)]
            if pages:
                break
    for p in pages:
        if ok_photo(p) or site.get("file"):
            return p
    return None


def ok_photo(p: dict) -> bool:
    ii = (p.get("imageinfo") or [{}])[0]
    w, h = ii.get("width", 0), ii.get("height", 0)
    return (
        free(ii.get("extmetadata", {}))
        and w >= 1600
        and 1.25 <= w / max(h, 1) <= 2.1
        and not SKIP.search(p["title"])
        and not PEOPLE.search(p["title"])
    )


# Smallest transcode that is still sharp enough at card size, best first.
TRANSCODES = ("480p.vp9.webm", "720p.vp9.webm", "360p.vp9.webm")


def pick_clip(clip: dict) -> dict | None:
    props = dict(prop="videoinfo", viprop="url|size|derivatives|extmetadata|metadata",
                 viextmetadatafilter="LicenseShortName|LicenseUrl|Artist|Credit")
    if clip.get("file"):
        pages = api(action="query", titles=clip["file"], **props)["query"]["pages"]
    else:
        res = api(action="query", generator="search", gsrsearch=f'{clip["q"]} filetype:video', gsrnamespace=6, gsrlimit=15, **props)
        pages = sorted(res.get("query", {}).get("pages", []), key=lambda p: p.get("index", 99))
    for p in pages:
        vi = (p.get("videoinfo") or [{}])[0]
        md = {m["name"]: m["value"] for m in vi.get("metadata") or [] if isinstance(m, dict) and "name" in m}
        secs = float(md.get("playtime_seconds") or md.get("length") or 0)
        derivs = {d.get("transcodekey"): d["src"] for d in vi.get("derivatives", [])}
        src = next((derivs[k] for k in TRANSCODES if k in derivs), None)
        named_ok = clip.get("file") or (not SKIP.search(p["title"]) and not PEOPLE.search(p["title"]))
        if free(vi.get("extmetadata", {})) and src and secs >= clip["start"] + CLIP_SECONDS and named_ok:
            return {"page": p, "src": src, "secs": secs}
    return None


def ffmpeg() -> str:
    import imageio_ffmpeg  # noqa: PLC0415 - only needed for clips

    return imageio_ffmpeg.get_ffmpeg_exe()


def save_photo(site: dict, page: dict) -> dict:
    ii = page["imageinfo"][0]
    img = Image.open(BytesIO(fetch(ii.get("thumburl") or ii["url"]))).convert("RGB")
    img.thumbnail((WIDTH, WIDTH))
    img.save(OUT / f'{site["id"]}.webp', "WEBP", quality=72, method=6)
    return {
        **{k: site[k] for k in ("id", "name", "place", "category")},
        "kind": "photo",
        "src": f'/gallery/{site["id"]}.webp',
        "width": img.width,
        "height": img.height,
        "credit": credit(page["title"], ii["extmetadata"], "Resized and converted to WebP"),
    }


def save_clip(clip: dict, found: dict) -> dict:
    page = found["page"]
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "raw.webm"
        raw.write_bytes(fetch(found["src"]))
        mp4 = OUT / f'{clip["id"]}.mp4'
        poster_png = Path(tmp) / "poster.png"
        exe = ffmpeg()
        subprocess.run([exe, "-y", "-loglevel", "error", "-ss", str(clip["start"]), "-i", str(raw), "-t", str(CLIP_SECONDS),
                        "-an", "-vf", "scale=-2:480", "-c:v", "libx264", "-crf", "28", "-preset", "slow",
                        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)], check=True)
        subprocess.run([exe, "-y", "-loglevel", "error", "-i", str(mp4), "-frames:v", "1", str(poster_png)], check=True)
        poster = Image.open(poster_png).convert("RGB")
        poster.save(OUT / f'{clip["id"]}.webp', "WEBP", quality=70, method=6)
    vi = page["videoinfo"][0]
    return {
        **{k: clip[k] for k in ("id", "name", "place", "category")},
        "kind": "video",
        "src": f'/gallery/{clip["id"]}.mp4',
        "poster": f'/gallery/{clip["id"]}.webp',
        "width": poster.width,
        "height": poster.height,
        "credit": credit(page["title"], vi["extmetadata"], f"Trimmed to {CLIP_SECONDS} s, muted and re-encoded"),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", help="comma-separated ids to (re)fetch; the rest of gallery.json is kept")
    args = ap.parse_args()
    only = set(args.only.split(",")) if args.only else None
    # -I ignores PYTHONIOENCODING; Commons titles are often Japanese.
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    sys.stderr.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    OUT.mkdir(parents=True, exist_ok=True)
    items, missing = [], []
    for site in SITES:
        if only and site["id"] not in only:
            continue
        page = pick_photo(site)
        if page is None:
            missing.append(site["id"])
            continue
        print(f'{site["id"]:18} {page["title"]}', flush=True)
        if not args.dry_run:
            items.append(save_photo(site, page))
    for clip in CLIPS:
        if only and clip["id"] not in only:
            continue
        found = pick_clip(clip)
        if found is None:
            missing.append(clip["id"])
            continue
        print(f'{clip["id"]:18} {found["page"]["title"]} ({found["secs"]:.0f} s)', flush=True)
        if not args.dry_run:
            items.append(save_clip(clip, found))
    if missing:
        print("No free-licence match for:", ", ".join(missing), file=sys.stderr)
    if args.dry_run:
        return
    if only:
        # Keep everything else, in SITES/CLIPS order; drop entries no longer listed.
        fresh = {it["id"]: it for it in items}
        old = {it["id"]: it for it in json.loads(DATA.read_text(encoding="utf-8"))["items"]}
        items = [fresh.get(x["id"]) or old.get(x["id"]) for x in SITES + CLIPS]
        items = [it for it in items if it]
    listed = {x["id"] for x in SITES + CLIPS}
    for f in OUT.iterdir():
        if f.stem not in listed:
            f.unlink()
            print("removed", f.name)
    DATA.write_text(json.dumps({
        "_note": "Japan in pictures (journey, before the numbers). Media from Wikimedia Commons under the licence shown on each item; made by scripts/gallery_media.py. Every item stays needs-review until the owner checks the picture, the caption and the credit.",
        "source": "Wikimedia Commons",
        "lastChecked": date.today().isoformat(),
        "items": [{**it, "status": "needs-review"} for it in items],
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(items)} items -> {DATA.relative_to(WEB)}")


if __name__ == "__main__":
    main()
