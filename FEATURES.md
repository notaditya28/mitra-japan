# Features — Mitra Japan

Updated at the end of every milestone. Three lists: what works, what is demo-only, and what needs an external service or the owner's verification.

_Last updated: 2026-10-24, start of milestone 5._

## Fully working

- Stage 1 scroll journey: 3D Fuji hero, persona choice (tints the journey), five places (Fuji, Tokyo, Shinkansen, Kyoto, Matsuri) with Petal Portal transitions, flipping fear cards, chapter rail.
- Reduced-motion / low-end path: static sections instead of scroll-driven 3D.
- Language switch EN / हिं / ગુ (Stage 1, sign-in and planner UI; data notes are English only).
- Indian-roots mosaic → map reveal and story cards.
- Count-up counters (only animate real values; all are currently empty).
- Page transitions (torii portal), hash routes, demo sign-in (name + Indian mobile, browser only).
- 3D Japan planner map: extruded prefectures, hover/click, orbit limits, camera fly-to, four animated layers, city cards, flat SVG fallback without WebGL, mobile bottom sheet.
- Ingredient matcher (longest-match dictionary, per-diet rules).

## Demo-only (works, but on sample or seeded data)

- **Food spots** (`foodSpots.json`): generic kinds of places, `status: sample`, never certified or verified.
- **Scanner preview** in the Tokyo fear card: curated sample menu text, no OCR yet (milestone 6).
- **Sample route** on the planner map (Golden Route), behind an explicit toggle.
- **Stats**: all four counters are empty placeholders until real, sourced figures are added.

## Needs an external service or the owner's verification

- **AI planner** (milestone 5): needs `ANTHROPIC_API_KEY` in `.env`; without it the planner runs in labelled Demo mode.
- **Heritage entries** (`heritage.json`): `needs-review` until the owner checks wording, sites and links.
- **Visa checklist**: `needs-review` until checked against official sources.
- **City facts** (`cities.json`): travel times are estimates; veg notes need review.
- **Anime / regional spots** (`layers.json`): need review.
- **Hindi / Gujarati** strings: drafts pending native-speaker review.
- **Real restaurant data**: none yet; directory with per-diet evidence arrives in milestone 6.

## Planned (by milestone)

- **M5**: FastAPI + Claude planner, validated itinerary, grounding and feasibility checks, editable/regenerable day cards in sync with the map, Food Confidence rings, Demo mode.
- **M6**: OCR scanner behind a provider interface + 20–30 sample scans, three-state results, restaurant directory with filters, interactive visa checklist.
- **M7**: saved trips, PDF export, WhatsApp share link, i18n polish, performance, deploy.
