"""
Make web copies of the journey photos.

Originals live in apps/web/src/scenes/places/places/<city>/<Any name>.jpg (one folder per
city). This writes two WebP sizes per photo to apps/web/src/assets/tour/<city>/ and a
manifest (src/data/tourPhotos.json) that the app reads. Run it after adding or replacing a
photo, then describe the spot in src/data/tour.json.

    apps/api/.venv/Scripts/python apps/web/scripts/tour_photos.py

Needs Pillow (already installed in the API venv).
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageOps

WEB = Path(__file__).resolve().parents[1]
SRC = WEB / "src" / "scenes" / "places" / "places"
OUT = WEB / "src" / "assets" / "tour"
MANIFEST = WEB / "src" / "data" / "tourPhotos.json"
SIZES = {"lg": 2048, "sm": 1280}
EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main() -> None:
    photos = []
    for city_dir in sorted(p for p in SRC.iterdir() if p.is_dir()):
        city = slugify(city_dir.name)
        for f in sorted(city_dir.iterdir()):
            if f.suffix.lower() not in EXTS:
                continue
            slug = slugify(f.stem)
            im = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
            dest = OUT / city
            dest.mkdir(parents=True, exist_ok=True)
            for key, edge in SIZES.items():
                copy = im.copy()
                copy.thumbnail((edge, edge), Image.Resampling.LANCZOS)
                copy.save(dest / f"{slug}-{key}.webp", "WEBP", quality=76, method=6)
            photos.append(
                {
                    "id": f"{city}/{slug}",
                    "city": city,
                    "slug": slug,
                    "original": f"{city_dir.name}/{f.name}",
                    "width": im.width,
                    "height": im.height,
                }
            )
            print(f"{city}/{slug}  {im.width}x{im.height}")
    MANIFEST.write_text(json.dumps({"photos": photos}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(photos)} photos -> {OUT}")


if __name__ == "__main__":
    sys.exit(main())
