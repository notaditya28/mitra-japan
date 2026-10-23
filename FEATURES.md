# Features — Mitra Japan

Updated at the end of every milestone. Three lists: what works, what is demo-only, and what needs an external service or the owner's verification.

_Last updated: 2026-10-24, end of milestone 6._

## Fully working

- Stage 1 scroll journey: 3D Fuji hero, persona choice (tints the journey), five places (Fuji, Tokyo, Shinkansen, Kyoto, Matsuri) with Petal Portal transitions, flipping fear cards, chapter rail.
- Reduced-motion / low-end path: static sections instead of scroll-driven 3D.
- Language switch EN / हिं / ગુ (Stage 1, sign-in and planner UI; data notes are English only).
- Indian-roots mosaic → map reveal and story cards.
- Count-up counters (only animate real values; all are currently empty).
- Page transitions (torii portal), hash routes, demo sign-in (name + Indian mobile, browser only).
- 3D Japan planner map: extruded prefectures, hover/click, orbit limits, camera fly-to, four animated layers, city cards, flat SVG fallback without WebGL, mobile bottom sheet.
- Veg-Safe scanner (planner → Travel tools → Menu scanner):
  - Photo → on-device OCR (Tesseract.js behind an `OcrProvider` interface) → editable text.
  - Three results with their cause: no listed conflicts / potential conflict / unable to verify.
  - Unknown words, ambiguous broths and sauces, unreadable text, and low-confidence photos never count as clear.
  - Distinct diets, plus your own restrictions (saved on this device).
  - The calm caveat on every result, and a full-screen staff card in Japanese.
- Restaurant directory (Travel tools → Veg-friendly places):
  - Search plus city, diet, real/sample and "evidence only" filters.
  - Per-diet basis (restaurant says so / listed by a guide / checked by us / not confirmed), with evidence, sources and dates.
  - "Show on map".
- Visa checklist (Travel tools → Visa checklist):
  - Asks only purpose and traveller type.
  - Every item says "confirm with the official source" and links to official Japanese government sites.
  - Ticks are saved on this device.
- Planner API (FastAPI):
  - `/health`, `/api/plan` (streamed), `/api/plan/day` and `/api/scan-explain`.
  - Strict schemas, one retry, visible fallback.
  - Grounding against `cities.json`, feasibility flags.
  - 400/413/429/502/503 errors, CORS from env, rate limit.
  - 33 pytest tests.
- Trip guide UI: prompt composer with suggestions, days stream in live, day cards with stops, transport estimate, stay, tips, flags and per-day regenerate; Itinerary/City tabs; cards and map markers select each other; animated route line with day badges.
- Food Confidence ring per day with a "Why this score" breakdown; capped at 85 because no spot is verified.
- Status badges (Verified / Sample / Needs review / Estimate) on seeded records.
- Demo mode: no key → labelled sample itinerary; API down → "Offline · sample data" with a visible notice.

## Demo-only (works, but on sample or seeded data)

- **Sample restaurants**: 21 illustrative kinds of places in `restaurants.json` (`status: sample`, no address, diet basis "not confirmed").
- **Sample scans**: 24 menu lines and shop labels (`sampleScans.json`), labelled "Sample scan". The Tokyo fear card uses five of them.
- **Sample route** on the planner map (Golden Route), behind an explicit toggle.
- **Stats**: all four counters are empty placeholders until real, sourced figures are added.

## Needs an external service or the owner's verification

- **AI planner and scan explanations (live)**: built, but untested against the real API until the owner adds `ANTHROPIC_API_KEY` to `.env`. Without it the planner runs in labelled Demo mode, and day regeneration and AI scan explanations are unavailable (with a message saying so).
- **OCR engine download**: the first photo scan fetches Tesseract.js and Japanese language data from the jsDelivr CDN. Needs internet once.
- **Heritage entries** (`heritage.json`): `needs-review` until the owner checks wording, sites and links.
- **Visa checklist** (`visa.json`): `needs-review`, `lastReviewed: null` until the owner checks each item against official sources. Item text is English only.
- **City facts** (`cities.json`): travel times are estimates; veg notes need review.
- **Anime / regional spots** (`layers.json`): need review.
- **Hindi / Gujarati** strings: drafts pending native-speaker review.
- **Real restaurants**: 9 places researched from public guides on 2026-10-24 (Tokyo, Kyoto, Osaka, Koyasan, Hiroshima). All are `needs-review`: addresses, map pins (approximate) and diet claims need the owner's check; places may have moved or closed.
- **Ingredient dictionary** (`ingredients.json`): 53 entries plus menu words; per-diet rules need the owner's review.

## Planned (by milestone)

- **M7**: saved trips, PDF export, WhatsApp share link, i18n polish, performance, deploy.
