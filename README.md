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

## Checks

```bash
pnpm lint
pnpm test
pnpm build
cd apps/api && .venv/Scripts/python -m pytest      # API tests always run in Demo mode
```

## Deploy

- **Frontend → Vercel**: root directory `apps/web`, build `pnpm build`, output `dist`. Set `VITE_API_URL` to the API URL.
- **API → Render or Railway**: root `apps/api`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `ANTHROPIC_API_KEY` and allow the Vercel origin in CORS.

## Data honesty

Statistics are placeholders until verified with real sources (`apps/web/src/data/stats.json`). The restaurant directory mixes illustrative samples with real places found in public guides; the real ones stay "Needs review" until checked, and nothing is presented as certified. See `CLAUDE.md`.

## Limitations

- Live Claude mode (planner and scan explanations) has not been tested against the real API until a key is added.
- OCR works best on printed, horizontal, well-lit text. Handwritten or vertical menus often come back as "Unable to verify".
- The scanner only knows the words in `ingredients.json`. Anything else is reported as unrecognised, never as clear.
- Restaurant details (hours, menus, whether a place is still open) are not tracked. Always check before visiting.
- Hindi and Gujarati text are drafts pending native review. Data notes (cities, restaurants, visa items) are English only.
