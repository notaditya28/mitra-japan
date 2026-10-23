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

The key is read only by the API and never reaches the browser bundle.

### How the planner behaves

- `POST /api/plan` streams Server-Sent Events (`status`, `day`, `notice`, `final`); `stream:false` returns JSON. `POST /api/plan/day` regenerates one day. `GET /health` reports `live` or `demo`.
- Claude's output is constrained to a JSON schema whose city, food-spot and heritage ids come from our data files. The server validates it, retries once, then falls back to the sample itinerary with a visible notice (never silently).
- Unknown cities are dropped; unknown places are flagged; days get feasibility flags (overpacked, long transfer, spread out). Travel times are estimates from distance.
- If the API is unreachable, the web app shows "Offline · sample data" and the bundled sample itinerary.
- Food Confidence is computed in the browser from our (unverified) data, capped at 85, and always shows its reasons.

### Editing data

All seed data lives in `apps/web/src/data/`. Each record has `status` (`verified` / `sample` / `needs-review`), `source` and `lastChecked`. Only a human sets `verified`. Food spots are demo data (`certified:false`); never mark one certified without recorded evidence. `data.test.ts` enforces these rules. The API reads the same files.

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

Statistics are placeholders until verified with real sources (`apps/web/src/data/stats.json`). Food-spot data is illustrative demo data and is never presented as certified. See `CLAUDE.md`.
