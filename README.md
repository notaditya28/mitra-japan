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

### Knowledge assistant (RAG), milestone R1: corpus and ingestion

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

- Live Claude mode (planner and scan explanations) has not been tested against the real API until a key is added.
- OCR works best on printed, horizontal, well-lit text. Handwritten or vertical menus often come back as "Unable to verify".
- The scanner only knows the words in `ingredients.json`. Anything else is reported as unrecognised, never as clear.
- Restaurant details (hours, menus, whether a place is still open) are not tracked. Always check before visiting.
- Hindi and Gujarati text are drafts pending native review. Data notes (cities, restaurants, visa items) are English only.
- Saved trips, the demo reservation, custom restrictions and visa ticks live in this browser's localStorage only. Clearing site data removes them, and they don't sync between devices.
- "Download PDF" opens the browser's print dialog. Choose **Save as PDF**. This keeps Hindi, Gujarati and Japanese text in the system's own fonts.
- The demo reservation books nothing and takes no payment. No prices are shown, because we have no real fares.
