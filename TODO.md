# TODO — Mitra Japan

## Milestones

- [x] **M1 Foundation**: monorepo, tooling, tokens, fonts, motifs (seigaiha, Fuji, sun, torii, lantern, 2D/3D petals), store, smooth scroll, styled landing shell
- [ ] **M2** Stage 1 hero (3D) + persona + torii tunnel with flipping fear cards
- [ ] **M3** Indian-roots reveal, animated counters, CTA transition into the map
- [ ] **M4** 3D Japan map with layers, pins and city cards
- [ ] **M5** FastAPI + Claude planner, JSON validation, animated route, Food Confidence rings
- [ ] **M6** Food scanner (live OCR + demo fallback) and phrase cards
- [ ] **M7** i18n (HI/GU), export (WhatsApp/PDF), polish, performance, deploy

## Needs owner input

- [ ] **Stats**: fill `apps/web/src/data/stats.json` (Indian arrivals vs total from JNTO, India outbound growth, vegetarian share, own survey result) with sources, then set `verified: true`.
- [ ] **Scroll idea / login + booking**: owner wants "Plan your trip" → login → book tickets → plan trip with AI. Scope decision pending (auth provider, real vs mock booking). See M1 report.
- [ ] **HI/GU review**: native-speaker check of the phrase card in `features/fears/PhrasePreview.tsx` and all future Hindi/Gujarati copy.
- [ ] **Heritage**: sanity-check one-liners and places in `apps/web/src/data/heritage.json`.
- [ ] **Visa steps**: confirm the 5-step checklist in `features/fears/VisaChecklist.tsx` against the Embassy of Japan in India site.
- [ ] Real restaurant data, if any, with certification sources.

## Mocked vs real

| Area                          | Status                                                    |
| ----------------------------- | --------------------------------------------------------- |
| Fear card "food" scan preview | Mock, pre-baked (live scanner is M6)                      |
| Stats counters                | Placeholders (`value: null`), pending real sources        |
| CTA "Build my trip"           | Shows a notice until the planner exists (M4)              |
| Persona choice                | Real, persisted in localStorage via Zustand               |
| API                           | Skeleton only (`/health`), planner endpoints arrive in M5 |

## Known notes

- `THREE.Clock` deprecation warning in the console comes from R3F 8 on three r186. Harmless; revisit if we upgrade to R3F 9 / React 19.
- `corepack enable` cannot write to Program Files without admin; pnpm shims live in `~/.local/bin`.
