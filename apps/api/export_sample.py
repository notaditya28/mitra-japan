"""Write the web app's offline sample plan (family, vegetarian, 5 days) from the demo planner.

    apps/api/.venv/Scripts/python apps/api/export_sample.py
"""

import json
from pathlib import Path

from app.data import load
from app.sample import sample_plan

OUT = Path(__file__).resolve().parents[1] / "web" / "src" / "data" / "sampleItinerary.json"

if __name__ == "__main__":
    plan = sample_plan(load(), persona="family", diet="vegetarian", days=5)
    OUT.write_text(json.dumps(plan.model_dump(mode="json"), ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(f"wrote {OUT}")
