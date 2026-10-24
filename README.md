# Mitra Japan

Japan, made for you. A scroll-driven 3D story that answers Indian travellers' real worries about Japan (veg food, language, visa, "will it feel foreign?"), followed by a 3D map planner with an AI trip guide.

## Structure

```
apps/web   Vite + React + TypeScript frontend
apps/api   FastAPI service (Claude planner; key stays server-side)
```

## Run locally

Requirements: Node 20+, pnpm (via `corepack enable`), Python 3.11+.

```bash
cp .env.example .env          # add ANTHROPIC_API_KEY for the API
pnpm install
pnpm dev                      # http://localhost:5173
```

API (trip guide):

```bash
cd apps/api
python -m venv .venv && . .venv/Scripts/activate   # Windows; use bin/activate elsewhere
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Environment

| Variable               | Where | Purpose                                                                                        |
| ---------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`    | API   | Claude key from console.anthropic.com. Empty → Demo mode (sample itinerary, clearly labelled). |
| `PLANNER_MODEL`        | API   | Defaults to `claude-sonnet-5-5`.                                                               |
| `MITRA_DEMO_MODE`      | API   | `1` forces Demo mode even with a key.                                                          |
| `CORS_ORIGINS`         | API   | Comma-separated allowed browser origins.                                                       |
| `PLAN_RATE_PER_MINUTE` | API   | Per-IP plan limit before a 429.                                                                |
| `VITE_API_URL`         | Web   | API base URL (default `http://localhost:8000`).                                                |
| `VITE_OCR_PROVIDER`    | Web   | OCR engine for the scanner. Only `tesseract` (default, on-device) exists today.                |

The key is read only by the API and never reaches the browser bundle.

### The journey (front page)

The front page has four parts:

1. **Welcome.** The title and a take-off button sit over a 3D map of Asia with the plane parked at Delhi. Who is travelling is asked once, in the planner.
2. **Flight.** Scrolling flies the plane to Tokyo, and the view fades softly into Tokyo.
3. **City spots.** Each spot is a stylised low-poly 3D scene (Tokyo's neon streets, a Mt Fuji day trip, Fushimi Inari, a Gion festival), not a photo. Every change of scene is a slow dip to deep plum and back, and each spot shows a short paragraph about the place.
4. **Next city.** A Shinkansen ride carries you to the next city, and the pattern repeats.

Two controls stay on screen while you scroll:

- **Journey rail** (right edge, desktop): jumps to any place.
- **City map** (top right): opens a street map of the city you're in. It shows food that matches your diet and sample places to stay. The diet you pick there is your profile's, so it carries over to every city.

With reduced motion, a low-end device or no WebGL, the same content shows as a flat map and a card per spot.

#### Adding a spot or a city

Spots are listed in `src/data/tour.json`. Add a new city to `cities` (its id must be in `cities.json`) in the order you want to travel, and give each spot:

- `name`, `nameJa`, and a short `kanji` (2–4 characters) for the portal petals
- `area` and approximate `lat`/`lng` (only used for the "you are here" pin)
- an optional `fear` card
- `scene`: which 3D scene it shows (`tokyo`, `fuji`, `kyoto` or `matsuri`, from `src/scenes/places/`)

Then run `pnpm --filter web test`. A new city gets a Shinkansen ride from the previous one automatically. A brand-new scene is code: add the component to `src/scenes/places/`, then register it in `PLACE_SCENES` (`features/tour/tour.ts`), `CAMERAS` (`journey/CameraRig.tsx`), `MOODS` (`journey/Sky.tsx`) and `JourneyCanvas.tsx`.

Places to stay are in `src/data/stays.json`. They are placeholders for now: all `sample`, with names that start with "Sample", and no prices.

The flight map is `src/data/asia.geojson`. It comes from Natural Earth (public domain), using the **India point-of-view** edition so India's boundary matches the official map, and is cut down by `scripts/asia_subset.py`. Use the same `_ind` source if you regenerate it.

### Team system guide features (visa checker, OCR, AI planner)

`MITRA_JAPAN_SYSTEM_GUIDE.md` (the team's spec) was merged in on 2026-10-24. Where it conflicted with the app, the guide's feature won, with four owner decisions:

1. **Unsourced figures** from the guide are shown as written with a **"From our team guide · needs review"** badge and the official link. This covers visa processing times and stays, the ₹ balance and ITR thresholds, VFS centres and rejection pitfalls.
2. **Schedule of Stay** is a plain draft, never a copy of the official form.
3. **City card:** a small closable card on the map.
4. **Stack:** we kept FastAPI, Pydantic, Claude Sonnet 5.5 and on-device OCR, and added the guide's routes as aliases.

What's included:

- **Visa readiness checker** (Travel tools):
  - A checklist in the guide's categories (identity, money and tax, schedule), still built from purpose and traveller type only.
  - An eVISA vs sticker visa table.
  - "Where to apply" by Indian state.
  - Money tips and common problems.
  - A **Schedule of Stay draft**: pick your arrival date, fill in each night's hotel, address and phone, then print or save it as a PDF. Data: `visa.json` (`source: team-guide | official-summary`).
- **Scanner:**
  - Japanese + English OCR on the device, with a crop frame you move over the ingredient list.
  - A 5-script dictionary (kanji, kana, romaji, English, aliases; 600+ terms, including the guide's hazards such as beef tallow, animal fat, emulsifier and "seasoning (amino acids)").
  - Each match shows the script it matched in and a severity.
  - Uncertainty notes and practical advice.
  - Four packaging presets.
  - A printable waiter card with romaji and the guide's sentences.
  - A Shojin Ryori guide in the restaurant directory.
- **Planner:**
  - Trip options: persona (or custom), 2–12 days, starting city, travellers, pace, budget, extra diets in the group, interests.
  - Day tabs, with morning, afternoon and evening sections and a meal plan for each day.
  - Click a stop to fly the 3D map to it.
  - A "Redesign this day" dialog.
  - A reset-camera button.
  - A **Street map** view with Esri streets, Esri topographic, OpenStreetMap and CARTO basemaps, and filters for food, heritage and itinerary.
  - A city card on the map.
  - WhatsApp text that includes diet tags and transit lines.
  - The pace sets how many stops count as comfortable (relaxed 2–3, moderate 3–4, fast 5–6), and the overpacked flag follows it.
- **API aliases** (see `app/guide_api.py` and `main.py`):
  - `POST /api/planner/generate`: the guide's `{preferences, customPrompt}` body.
  - `POST /api/planner/regenerate-day`: `{trip, dayNumber, instructions}`.
  - `POST /api/ocr/analyze`: send `{rawText, dietaryRestrictions}`. An image upload gets **415**, because OCR runs on the device.
  - `GET /api/ocr/demo-presets`
  - `GET /api/restaurants?city=&dietary=&search=`
  - `GET /api/visa/checklist`

Maintenance:

- **Changing the dictionary.** After editing `ingredients.json`, regenerate the fixture both matchers are tested against, because the API's matcher (`app/ingredients.py`) must agree with the browser's:
  ```bash
  cd apps/web && UPDATE_PARITY=1 pnpm exec vitest run src/features/scanner/scanParity.test.ts
  ```
- **Offline sample plan.** Regenerate it with:
  ```bash
  apps/api/.venv/Scripts/python apps/api/export_sample.py
  ```
- **UI strings** live in `apps/web/scripts/strings/*.json` and are merged into the locales with `scripts/merge_locales.py`.

### How the planner behaves

- `POST /api/plan` streams Server-Sent Events (`status`, `day`, `notice`, `final`); `stream:false` returns JSON. `POST /api/plan/day` regenerates one day. `GET /health` reports `live` or `demo`.
- Claude's output is constrained to a JSON schema whose city, food-spot and heritage ids come from our data files. The server validates it, retries once, then falls back to the sample itinerary with a visible notice (never silently).
- Unknown cities are dropped; unknown places are flagged; days get feasibility flags (overpacked, long transfer, spread out). Travel times are estimates from distance.
- If the API is unreachable, the web app shows "Offline · sample data" and the bundled sample itinerary.
- Food Confidence is computed in the browser from our (unverified) data, capped at 85, and always shows its reasons.

### Veg-Safe scanner

- Photo → OCR → editable text → rule-based result. The result is always one of three states: **No listed conflicts detected**, **Potential dietary conflict detected** (names the ingredient), or **Unable to verify** (unreadable text, words not in our dictionary, ambiguous broths and sauces, or a low-confidence photo the traveller hasn't checked yet). Unknown never counts as clear.
- OCR sits behind `features/scanner/ocr/` (`OcrProvider`). The default is Tesseract.js, which runs in the browser; the first scan downloads the engine and Japanese language data (a few MB) from the jsDelivr CDN, then the browser caches them. To add a cloud provider, implement `OcrProvider`, register it in `ocr/index.ts` and select it with `VITE_OCR_PROVIDER`.
- 24 sample scans (`sampleScans.json`) work without a camera and are labelled "Sample scan".
- The ingredient dictionary (`ingredients.json`) has per-diet rules: `avoid` = conflict, `ask` = unable to verify. Diets are separate (Jain, vegetarian, vegan, halal, no-beef, eggless). Travellers can add their own restrictions (an exact Japanese word), which always count as conflicts.
- `POST /api/scan-explain` (live mode only) asks Claude to explain a result and draft a question for staff. It never changes the verdict; answers that call a dish "safe", "guaranteed" or "certified" are rejected. In Demo mode it returns 503 and the UI says so.

### Trips, export and the demo reservation

- **Save trip** stores the itinerary in this browser. **My trips** opens, edits (name and notes), duplicates or deletes a trip; delete asks for confirmation. A planner change to an opened trip shows **Save changes**.
- **Download PDF** builds an A4 print view. It includes days, Food Confidence with its reasons, practical notes, the visa checklist, a sources table with each source's status and last-checked date, and disclaimers.
- **Share on WhatsApp** is a plain `https://wa.me/?text=…` link with the trip summary. There is no phone number and no bot; you pick the contact in WhatsApp.
- **Reserve (demo)** collects a start date, the travellers and requests, then shows a reference like `MJ-DEMO-7KQ2RX`. Every screen says it is a demo.

### Editing data

All seed data lives in `apps/web/src/data/`. Each record has `status` (`verified` / `sample` / `needs-review`), `source` and `lastChecked`. Only a human sets `verified`. `data.test.ts`, `visa.test.ts` and `sampleScans.test.ts` enforce the rules. The API reads the same files.

#### Adding or correcting a restaurant (`restaurants.json`)

1. Copy an existing `needs-review` entry. Give it a unique `id` and a `cityId` from `cities.json`.
2. Fill `name`, `nameJa` (or `null`), `cuisine`, `kind` (one of the keys under `planner.kinds` in the locale files), `address`, `area`, `lat`/`lng` and `coordinatePrecision` (`exact` only if you took the pin from the venue's own map).
3. For each diet, add a `dietOptions` entry with a `basis`:
   - `self-reported`: the restaurant itself says so (its site, menu or sign).
   - `third-party`: a guide or listing says so.
   - `independently-verified`: you checked it yourself, for example by visiting or speaking to staff.
   - `unconfirmed`: no evidence. `evidence` must then be `null`.

   Every other basis needs an `evidence` sentence saying who said what.

4. List what to double-check in `risks` (keys under `planner.risks`). Add `link`, `source` and `lastChecked` (YYYY-MM-DD).
5. Leave `status: "needs-review"` until you have confirmed the details, then set `verified`. Leave `certification: null` unless you hold real certification evidence, and never write "certified" anywhere else.
6. Run `pnpm test`.

`sample` entries are illustrative kinds of places (no address). They can stay alongside real ones and are labelled "Sample".

#### Heritage (`heritage.json`) and visa (`visa.json`)

- Heritage entries describe historical associations ("developed from", "associated with"), never identity. Each needs real `references`. Keep `needs-review` until checked.
- The visa checklist is preparation help only. Every item links to an official Japanese government source. After reviewing it, set `lastReviewed` to the date.

### Knowledge assistant (RAG)

The assistant answers only from a small, curated corpus in `apps/api/rag/corpus/<topic>/`. Each document is Markdown with front matter, and `SOURCES.md` lists every document and its status.

```bash
cd apps/api
.venv/Scripts/python -m rag.ingest            # build/update the local index (only changed docs are re-embedded)
.venv/Scripts/python -m rag.ingest --check    # stale, invalid and needs-review documents
.venv/Scripts/python -m rag.ingest --sources  # regenerate rag/corpus/SOURCES.md
```

- **Embeddings:** `intfloat/multilingual-e5-small`, run locally with fastembed (ONNX, no PyTorch). It handles English, Hindi/Hinglish and Japanese with no API key. The first run downloads about **465 MB** into `apps/api/.cache/models` (git-ignored). Set `RAG_EMBEDDINGS=hash` for a tiny deterministic test embedder. A hosted provider can be added behind `EmbeddingProvider` (`rag/embeddings.py`).
- **Vector store: FAISS**, written to `apps/api/rag/index/` (git-ignored) as a flat inner-product index plus `chunks.jsonl`, `vectors.npy` and `manifest.json`.
  - Why FAISS: it is one pip wheel with no server or database files to manage.
  - Exact search over ~100 chunks takes microseconds, and it installs cleanly on Python 3.14 (Chroma pulls in a much larger dependency tree).
  - The index is rebuilt from the corpus at any time, so nothing in it is precious.
- **Adding a document:**
  1. Create `rag/corpus/<topic>/<name>.md` with the full front matter: `id`, `title`, `topic` (must match the folder), `source_url`, `source_name`, `source_type`, `language`, `fetched_on`, `last_verified`, `volatility`, `status`, `licence_note`.
  2. Write a short summary in your own words with a "Where to check" link.
  3. Run `rag.ingest` and `pytest`.
- **Rules:**
  - Only facts from pages you actually fetched.
  - Team-written text is `source_type: team-written` and stays `needs-review`.
  - Pages you couldn't fetch become stubs, listed in `rag/corpus/_fetch_notes.yaml`.
  - Only the owner sets `status: verified`.
- **Staleness:** `last_verified` older than 730 days (static), 365 days (slow-changing) or 90 days (volatile) counts as stale. Override with `RAG_STALE_DAYS` and `RAG_STALE_DAYS_VOLATILE`.

#### Using the assistant

The chat sits in the planner's guide panel (`features/assistant/AssistantChat.tsx`). Ask a question, use a quick action (visa, veg food, "we're tired", rain, "something went wrong", read a menu) or ask for a change to the plan.

- **Answers** come from hybrid retrieval: BM25 plus dense search merged with RRF, then a reranker. If confidence is below `RAG_ABSTAIN_THRESHOLD`, or the question asks for a price, opening hours or a timetable that our sources don't state, the assistant says it doesn't know and links the official page. Every answer shows numbered citations, a confidence badge, a freshness note and a Sources drawer.
  - **Demo mode** (no key): quotes are extractive, labelled "Demo".
  - **Live mode:** Claude writes the answer only from the retrieved chunks. The reply is validated (citations exist, every number appears in a cited source, no claim that a booking was changed). If validation fails, it retries once, then falls back to source quotes with a visible notice.
- **Plan changes** ("make day 2 lighter", "it's raining on day 3", "add a day in Nara") come back as a proposed patch with a diff card. Nothing changes until you press Apply; Undo restores the previous plan. Pin a stop on a day card to protect it. Hotel, train and ticket changes are never made for you; the card tells you what to change with the provider yourself.
- **Emergencies** (lost passport, medical, police, earthquake, typhoon, stranded, missing person, lost belongings) skip retrieval. They return a card built from `apps/web/src/data/emergency.json`: numbers, the Indian mission for today's city, and steps with sources. The browser keeps an offline copy, so the Emergency button works with the API down. The numbers are `needs-review` until the owner checks them.
- **Privacy:** passport, card, Aadhaar and PAN numbers are removed before anything is stored or sent. Location is opt-in, kept in memory for the session only and never logged. "Trip data" shows and deletes what the server holds for your session (memory only, no database).
- **Live tools:** weather only when `WEATHER_PROVIDER=open-meteo` (free, no key). Transit status says "not connected", and attraction hours are always "unverified". Nothing is invented.

Endpoints: `POST /api/assistant/chat`, `POST /api/assistant/apply-patch`, `POST /api/assistant/undo`, `GET /api/knowledge/sources`, `GET`/`DELETE /api/trip-data`. `POST /api/knowledge/search` and `POST /api/ingest` are debug endpoints, switched off when `MITRA_ENV=production`.

#### Evaluation

```bash
cd apps/api
.venv/Scripts/python -m rag.eval               # 77 cases, Demo mode, no API calls; writes rag/eval/report.md
.venv/Scripts/python -m rag.eval --split dev   # tune on dev only; held-out cases are every 4th
```

The cases and metrics:

- **Cases:** retrieval, abstention, emergency routing, plan patches (including pinned stops), prompt-injection and Hindi/Hinglish/Japanese questions.
- **Metrics:** hit@3, MRR, abstain precision/recall, emergency routing, patch validity, preserved pins and safety.
- **Current results:** dev 58/58, held-out 18/19. The miss is c072, cash withdrawal with an Indian card: the assistant abstains when it shouldn't. It is left untuned on purpose.

## Checks

```bash
pnpm lint
pnpm test
pnpm build
cd apps/api && .venv/Scripts/python -m pytest      # API tests always run in Demo mode
```

## Deploy

The web app and the API deploy separately. Config is in the repo; you connect the accounts.

### 1. API on Render (`render.yaml`)

1. In Render choose **New → Blueprint** and pick this GitHub repo. Render reads `render.yaml` and creates `mitra-japan-api`.
2. When it asks for secrets, set:
   - `ANTHROPIC_API_KEY`: your key from console.anthropic.com. Leave it empty to run in Demo mode.
   - `CORS_ORIGINS`: your Vercel URL, e.g. `https://mitra-japan.vercel.app`. Fill this in after step 2 if you don't know it yet.
3. Deploy, then open `https://<your-api>.onrender.com/health`. It should say `"mode":"live"` (or `"demo"` without a key).

The service builds from the repo root because it reads the shared data in `apps/web/src/data`. On the free plan it sleeps when idle: the first request after a while takes about a minute, and the web app shows "Offline · sample data" until it wakes.

### 2. Web on Vercel (`apps/web/vercel.json`)

1. In Vercel choose **Add New → Project**, import the repo, and set **Root Directory** to `apps/web`. The framework (Vite), build command and output are in `vercel.json`.
2. Add environment variables:
   - `VITE_API_URL`: the Render URL from step 1, e.g. `https://mitra-japan-api.onrender.com`.
   - `ENABLE_EXPERIMENTAL_COREPACK=1`, so Vercel uses the pnpm version pinned in `package.json`.
3. Deploy. If you set `CORS_ORIGINS` before you knew the Vercel URL, update it in Render and redeploy the API.

### After deploying

- Sign in with the demo login, plan a trip, open the scanner and run a sample scan, then download the PDF.
- Changing `VITE_*` variables needs a new Vercel build, because they are baked into the bundle.

## Data honesty

Statistics are placeholders until verified with real sources (`apps/web/src/data/stats.json`). The restaurant directory mixes illustrative samples with real places found in public guides; the real ones stay "Needs review" until checked, and nothing is presented as certified. See `CLAUDE.md`.

## Limitations

- Live Claude mode (planner, scan explanations, assistant answers and the plan-change tool loop) has not been tested against the real API. Every test and the eval run on fakes or Demo mode.
- OCR works best on printed, horizontal, well-lit text. Handwritten or vertical menus often come back as "Unable to verify".
- The scanner only knows the words in `ingredients.json`. Anything else is reported as unrecognised, never as clear.
- Restaurant details (hours, menus, whether a place is still open) are not tracked. Always check before visiting.
- Hindi and Gujarati text are drafts pending native review. Data notes (cities, restaurants, visa items) are English only.
- Saved trips, the demo reservation, custom restrictions and visa ticks live in this browser's localStorage only. Clearing site data removes them, and they don't sync between devices.
- "Download PDF" opens the browser's print dialog. Choose **Save as PDF**. This keeps Hindi, Gujarati and Japanese text in the system's own fonts.
- The demo reservation books nothing and takes no payment. No prices are shown, because we have no real fares.
- The assistant knows only its corpus (37 documents, all `needs-review`). Questions outside it get an honest "I don't know" with an official link. Emergency numbers and the Hindi emergency text need the owner's check before a real trip.
- Assistant sessions, undo history and trip data live in the API's memory and vanish on restart. The first chat after a start takes a few seconds while the embedding model loads. The model needs roughly 300 MB+ of RAM, which is tight on a free Render instance.
- The journey's city spots are stylised 3D scenes, not real views of those places, and each one says so on screen.
- The journey's city map uses Esri's free light grey canvas tiles without labels (so no Japanese text shows). They are fine for a demo, but check Esri's terms or switch to a keyed tile provider before a public launch. Without internet the map shows a note and the lists still work.
- The places to stay are dummies, not real listings.
- Figures from the team guide (visa times and stays, ₹ thresholds, VFS centres, the Nozomi rail time) are unverified until the owner checks them; they carry a visible badge.
- Esri and CARTO basemaps are free for light or non-commercial use with attribution (shown on the map); check their terms, or use a paid key, before a public launch.
- The first photo scan downloads Japanese and English OCR data (a few MB) from the jsDelivr CDN.
