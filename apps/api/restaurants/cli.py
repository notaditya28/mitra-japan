"""Restaurant database commands.

    python -m restaurants.cli migrate            # create or upgrade the database
    python -m restaurants.cli reset-demo         # demo mode: back to the seed state
    python -m restaurants.cli import FILE.json   # import records (refuses unproven verifications)
    python -m restaurants.cli status [ID]        # print statuses per diet
    python -m restaurants.cli expire             # downgrade verifications past their expiry
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import select

from app.config import settings

from . import db, demo, importer, status
from .models import Restaurant


def _print_report(rep: importer.ImportReport) -> None:
    print(f"imported {len(rep.imported)}, verified {len(rep.verified)}, refused {len(rep.refused)}")
    for rid, diet, problems in rep.refused:
        print(f"  refused {rid}{' / ' + diet if diet else ''}: {'; '.join(problems)}")


def main(argv: list[str] | None = None) -> int:
    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    ap = argparse.ArgumentParser(prog="restaurants.cli")
    ap.add_argument("--database-url", default=settings.database_url)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate")
    sub.add_parser("reset-demo")
    imp = sub.add_parser("import")
    imp.add_argument("file", type=Path)
    st = sub.add_parser("status")
    st.add_argument("id", nargs="?")
    sub.add_parser("expire")
    args = ap.parse_args(argv)

    db.migrate(args.database_url)
    if args.cmd == "migrate":
        print("database is up to date")
        return 0
    with db.session_scope(args.database_url) as s:
        if args.cmd == "reset-demo":
            _print_report(demo.reset_demo(s))
        elif args.cmd == "import":
            records = json.loads(args.file.read_text(encoding="utf-8"))
            _print_report(importer.import_records(s, records.get("restaurants", records)))
        elif args.cmd == "expire":
            print(f"downgraded {status.refresh_expired(s)} listing(s)")
        elif args.cmd == "status":
            q = select(Restaurant).where(Restaurant.removed_at.is_(None))
            if args.id:
                q = q.where(Restaurant.id == args.id)
            for r in s.scalars(q.order_by(Restaurant.city_id, Restaurant.id)):
                cells = ", ".join(f"{ds.diet}={status.traveller_label(ds).label}" for ds in sorted(r.statuses, key=lambda d: d.diet))
                print(f"[{r.data_origin}] {r.city_id:9} {r.display_name}: {cells or 'no diets assessed'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
