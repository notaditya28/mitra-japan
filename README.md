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

API (from milestone 5):

```bash
cd apps/api
python -m venv .venv && . .venv/Scripts/activate   # Windows; use bin/activate elsewhere
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Checks

```bash
pnpm lint
pnpm test
pnpm build
```

## Deploy

- **Frontend → Vercel**: root directory `apps/web`, build `pnpm build`, output `dist`. Set `VITE_API_URL` to the API URL.
- **API → Render or Railway**: root `apps/api`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `ANTHROPIC_API_KEY` and allow the Vercel origin in CORS.

## Data honesty

Statistics are placeholders until verified with real sources (`apps/web/src/data/stats.json`). Food-spot data is illustrative demo data and is never presented as certified. See `CLAUDE.md`.
