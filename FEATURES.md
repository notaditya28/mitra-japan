# Features — Mitra Japan

Updated at the end of every milestone. Three lists: what works, what is demo-only, and what needs an external service or the owner's verification.

_Last updated: 2026-10-24, end of milestone R5 (knowledge assistant)._

## Fully working

- Stage 1 journey (redesigned 2026-10-24):
  - Title and take-off button over a 3D map of Asia (India point-of-view boundaries), with the plane at Delhi (no traveller picker here; the planner asks).
  - Scroll flies the plane Delhi → Tokyo along a great-circle route; a slow dip to plum opens onto Tokyo.
  - Low-poly 3D scenes instead of photos (2026-10-25): Tokyo neon street and a Mt Fuji day trip, then Fushimi Inari and a Gion festival in Kyoto, with a slow dip to plum between every scene and a Shinkansen ride between cities.
  - A short paragraph about each place (and the Shinkansen) on a transparent background, in EN/HI/GU (HI/GU drafts); the journey rail is in the chosen language.
  - Journey rail grouped by city.
  - A flat version for reduced motion and low-end devices.
- City map window (top right of the journey):
  - Follows the current city.
  - Diet picker that keeps your choice across cities.
  - Plain grey street map (no Japanese labels) with plum-outlined markers for food that lists your diet and for places to stay, a labelled "you are here" pin, plus a list with status badges.
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
  - 110 pytest tests (planner, scanner, RAG ingestion, retrieval, routing, patches, emergency, privacy).
- Trip guide UI: prompt composer with suggestions, days stream in live, day cards with stops, transport estimate, stay, tips, flags and per-day regenerate; Itinerary/City tabs; cards and map markers select each other; animated route line with day badges.
- Food Confidence ring per day with a "Why this score" breakdown; capped at 85 because no spot is verified.
- Status badges (Verified / Sample / Needs review / Estimate) on seeded records.
- Demo mode: no key → labelled sample itinerary; API down → "Offline · sample data" with a visible notice.

- Saved trips in this browser (save, edit, duplicate, delete with confirmation), printable A4 PDF with sources and check dates, WhatsApp share link (wa.me, no bot).
- Demo reservation: clearly labelled, books nothing, no prices.
- HI/GU translations load only when chosen.
- Knowledge assistant (planner guide panel, always visible):
  - Grounded answers: hybrid BM25 + multilingual e5 retrieval, RRF, reranking, a confidence gate and abstention ("I don't know" plus the official link). Prices, hours and timetables are never guessed.
  - Each answer shows numbered citations, a confidence badge, a freshness note and a Sources drawer.
  - Works in English, Hindi and Hinglish; Japanese questions are understood.
  - Follow-up questions are rewritten from the previous turn.
  - Prompt-injection text in documents is dropped.
- Conversational plan changes: lighter day, rain, a closed place, add or remove a day, move a stop. Each comes as a diff card with what changes, what stays and booking notes. Apply is validated against our data and feasibility checks; Undo restores the plan. Pinned stops are never touched.
- Emergency path: lost passport, medical, police, lost belongings, earthquake, typhoon/tsunami, stranded, missing person.
  - Detected in EN/HI/Hinglish/JA, skips retrieval and shows the Indian mission for today's city.
  - The Emergency button works offline from a bundled copy.
- Privacy: passport, card, Aadhaar and PAN numbers are scrubbed. Location is opt-in and session-only. The "Trip data" panel views and deletes what the server holds for the session.
- Offline-first quick action: "veg food nearby" uses opt-in location and our own place data.
- RAG eval: 77 cases, `python -m rag.eval`. Results: dev 58/58, held-out 18/19.

- Team system guide features (merged 2026-10-24):
  - **Visa readiness checker:** a categorised checklist, the eVISA vs sticker table, where to apply by state, money tips and pitfalls, and a Schedule of Stay draft you can print.
  - **Scanner:**
    - Japanese + English OCR on the device, with a crop frame.
    - A 5-script dictionary (600+ terms); results show severity and the script that matched, plus notes and advice.
    - Four packaging presets and a printable waiter card with romaji.
    - A Shojin Ryori guide.
  - **Planner:**
    - Trip options (2–12 days, start city, travellers, pace, budget, group diets, interests) and pace-aware overpacked checks.
    - Day tabs with morning, afternoon and evening sections, a meal plan for each day, and a Redesign day dialog.
    - Fly to a clicked stop, a reset-camera button, and a city card on the map.
    - A 2D street map with basemaps and layer filters, and WhatsApp text with diet tags.
  - **API aliases:** `/api/planner/generate`, `/api/planner/regenerate-day`, `/api/ocr/analyze` (text), `/api/ocr/demo-presets`, `/api/restaurants` and `/api/visa/checklist`. The Python matcher is checked against the browser's on a shared fixture.

- Section bar under the top bar:
  - Journey: jump to the start, the flight, any city, Indian roots, the numbers or the CTA, with the current chapter highlighted.
  - Planner: jump to the map, trip options, itinerary, Ask Mitra or map layers, or open any tool.
  - It works with the keyboard, scrolls sideways on phones, and opens the bottom sheet there before jumping.

## Demo-only (works, but on sample or seeded data)

- **Sample restaurants**: 21 illustrative kinds of places in `restaurants.json` (`status: sample`, no address, diet basis "not confirmed").
- **Sample scans**: 24 menu lines and shop labels (`sampleScans.json`), labelled "Sample scan". The Tokyo fear card uses five of them.
- **Sample route** on the planner map (Golden Route), behind an explicit toggle.
- **Stats**: all four counters are empty placeholders until real, sourced figures are added.
- **Places to stay** on the city map: 6 dummy stays (`stays.json`, owner decision), all labelled "Sample", with illustrative locations and no prices.
- **Assistant in Demo mode** (no key): answers are quotes from the corpus, labelled "Demo". Plan changes come from a rule-based planner, not Claude.

## Needs an external service or the owner's verification

- **AI planner and scan explanations (live)**: built, but untested against the real API until the owner adds `ANTHROPIC_API_KEY` to `.env`. Without it the planner runs in labelled Demo mode, and day regeneration and AI scan explanations are unavailable (with a message saying so).
- **OCR engine download**: the first photo scan fetches Tesseract.js and Japanese language data from the jsDelivr CDN. Needs internet once.
- **Heritage entries** (`heritage.json`): `needs-review` until the owner checks wording, sites and links.
- **Visa checklist** (`visa.json`): `needs-review`, `lastReviewed: null` until the owner checks each item against official sources. Item text is English only.
- **City facts** (`cities.json`): travel times are estimates; veg notes need review.
- **Anime / regional spots** (`layers.json`): need review.
- **Hindi / Gujarati** strings: drafts pending native-speaker review.
- **Real restaurants**: 9 places researched from public guides on 2026-10-24 (Tokyo, Kyoto, Osaka, Koyasan, Hiroshima). All are `needs-review`: addresses, map pins (approximate) and diet claims need the owner's check; places may have moved or closed.
- **Assistant (live)**: Claude-written answers with citation and number validation, the LLM intent check and the tool-using plan-change loop are built and tested with fakes, but untested against the real API.
- **Knowledge corpus** (`apps/api/rag/corpus`): 37 documents, all `needs-review`. Fushimi Inari is a stub, and pages we could not fetch are listed in `_fetch_notes.yaml` for the owner.
- **Emergency contacts** (`emergency.json`): numbers and mission phone lines taken from official pages, `needs-review`. The Hindi text is a machine draft.
- **Live weather**: off by default; set `WEATHER_PROVIDER=open-meteo`. Transit status is not connected (says so). Attraction hours are always "unverified".
- **Embedding model**: the first ingest downloads ~465 MB (internet once).
- **Journey spots**: 4 stylised 3D scenes, each labelled as such; every spot is `needs-review` (names, approximate pins).
- **City map tiles**: Esri's free light grey canvas (internet needed; fine for a demo, check the terms before launch).
- **Team guide figures**: visa processing times and maximum stays, the ₹2.5–3.5 lakh balance, the ₹5 lakh ITR, VFS centres and pitfalls, plus the guide's waiter-card sentences. All are shown with a "From our team guide · needs review" badge until the owner checks them against official pages.
- **Street map basemaps**: Esri and CARTO tiles (attribution shown; check their terms before launch).
- **Ingredient dictionary** (`ingredients.json`): 53 entries plus menu words; per-diet rules need the owner's review.

## Planned (by milestone)

Knowledge assistant (addendum 3): R1–R5 all done (see above).

- Deploy: configs ready (`render.yaml`, `apps/web/vercel.json`); the owner connects Render and Vercel (README).
