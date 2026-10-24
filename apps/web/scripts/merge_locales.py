"""
Deep-merge UI strings into the locale files (EN, plus HI/GU drafts pending native review).

    apps/api/.venv/Scripts/python apps/web/scripts/merge_locales.py apps/web/scripts/strings/<file>.json

The input file is {"en": {...}, "hi": {...}, "gu": {...}}. Existing keys are overwritten,
others are kept. Missing HI/GU keys fall back to English at runtime.
"""
import json
import sys
from pathlib import Path

LOCALES = Path(__file__).resolve().parents[1] / "src" / "locales"


def merge(dst: dict, src: dict) -> None:
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            merge(dst[k], v)
        else:
            dst[k] = v


def main() -> None:
    for path in sys.argv[1:]:
        blocks = json.loads(Path(path).read_text(encoding="utf-8"))
        for lang, block in blocks.items():
            target = LOCALES / f"{lang}.json"
            data = json.loads(target.read_text(encoding="utf-8"))
            merge(data, block)
            target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"{path} -> {lang}")


if __name__ == "__main__":
    main()
