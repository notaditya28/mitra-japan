# Features — Mitra Japan

Updated at the end of every milestone. Three lists: what works, what is demo-only, and what needs an external service or the owner's verification.

_Last updated: 2026-10-24, end of milestone 5._

## Fully working

- Stage 1 scroll journey: 3D Fuji hero, persona choice (tints the journey), five places (Fuji, Tokyo, Shinkansen, Kyoto, Matsuri) with Petal Portal transitions, flipping fear cards, chapter rail.
- Reduced-motion / low-end path: static sections instead of scroll-driven 3D.
- Language switch EN / हिं / ગુ (Stage 1, sign-in and planner UI; data notes are English only).
- Indian-roots mosaic → map reveal and story cards.
- Count-up counters (only animate real values; all are currently empty).
- Page transitions (torii portal), hash routes, demo sign-in (name + Indian mobile, browser only).
- 3D Japan planner map: extruded prefectures, hover/click, orbit limits, camera fly-to, four animated layers, city cards, flat SVG fallback without WebGL, mobile bottom sheet.
- Ingredient matcher (longest-match dictionary, per-diet rules) with three results: no listed conflicts / potential conflict / unable to verify. Ambiguous broths and unreadable text always give "unable to verify"; custom restrictions supported.
- Planner API (FastAPI): `/health`, `/api/plan` (streamed), `/api/plan/day`; strict schema, one retry, visible fallback, grounding against `cities.json`, feasibility flags, 400/413/429/502 errors, CORS from env, rate limit. 27 pytest tests.
- Trip guide UI: prompt composer with suggestions, days stream in live, day cards with stops, transport estimate, stay, tips, flags and per-day regenerate; Itinerary/City tabs; cards and map markers select each other; animated route line with day badges.
- Food Confidence ring per day with a "Why this score" breakdown; capped at 85 because no spot is verified.
- Status badges (Verified / Sample / Needs review / Estimate) on seeded records.
- Demo mode: no key → labelled sample itinerary; API down → "Offline · sample data" with a visible notice.

## Demo-only (works, but on sample or seeded data)

- **Food spots** (`foodSpots.json`): generic kinds of places, `status: sample`, never certified or verified.
- **Scanner preview** in the Tokyo fear card: curated sample menu text, no OCR yet (milestone 6).
- **Sample route** on the planner map (Golden Route), behind an explicit toggle.
- **Stats**: all four counters are empty placeholders until real, sourced figures are added.

## Needs an external service or the owner's verification

- **AI planner (live)**: built, but untested against the real API until the owner adds `ANTHROPIC_API_KEY` to `.env`. Without it the planner runs in labelled Demo mode, and day regeneration is unavailable.
- **Heritage entries** (`heritage.json`): `needs-review` until the owner checks wording, sites and links.
- **Visa checklist**: `needs-review` until checked against official sources.
- **City facts** (`cities.json`): travel times are estimates; veg notes need review.
- **Anime / regional spots** (`layers.json`): need review.
- **Hindi / Gujarati** strings: drafts pending native-speaker review.
- **Real restaurant data**: none yet; directory with per-diet evidence arrives in milestone 6.

## Planned (by milestone)

- **M6**: OCR scanner behind a provider interface + 20–30 sample scans, three-state results, restaurant directory with filters, interactive visa checklist.
- **M7**: saved trips, PDF export, WhatsApp share link, i18n polish, performance, deploy.
