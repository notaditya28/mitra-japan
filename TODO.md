# TODO — Mitra Japan

## Milestones

- [x] **M1 Foundation**: monorepo, tooling, tokens, fonts, motifs (seigaiha, Fuji, sun, torii, lantern, 2D/3D petals), store, smooth scroll, styled landing shell
- [x] **M2** Stage 1 hero (3D) + persona + torii tunnel with flipping fear cards, HI/GU Stage 1 copy, language switch, ingredient matcher
- [x] **M2b** Multi-place journey (Fuji → Tokyo → Shinkansen → Kyoto → Matsuri), Petal Portal transitions, stretched place titles, chapter rail
- [ ] **M3** Indian-roots reveal (idea: Mathilde-style diamond mosaic of deity tiles re-flowing into map pins), ticking counters (verified figures only), CTA transition into the map
- [ ] **M4** 3D Japan map with layers, pins and city cards
- [ ] **M5** FastAPI + Claude planner, JSON validation, animated route, Food Confidence rings
- [ ] **M6** Food scanner (live OCR + demo fallback) and phrase cards
- [ ] **M7** i18n (HI/GU), export (WhatsApp/PDF), polish, performance, deploy

## Needs owner input

- [ ] **Stats**: fill `apps/web/src/data/stats.json` (Indian arrivals vs total from JNTO, India outbound growth, vegetarian share, own survey result) with sources, then set `verified: true`.
- [x] **Scroll idea / login + booking** (decided 2026-10-23): 3D scroll → "Plan your trip" → **demo login** (name + phone, stored on device, no auth service) → AI planning → review → **mock booking checkout** (clearly labelled demo, no real payments). Slots into M4/M5 after the CTA.
- [ ] **HI/GU review**: native-speaker check of `apps/web/src/locales/hi.json`, `gu.json` and the `hi`/`gu` fields in `apps/web/src/data/phrases.json` (food-safety phrases matter most).
- [ ] **Heritage**: sanity-check one-liners and places in `apps/web/src/data/heritage.json`.
- [ ] **Visa steps**: confirm the 5 steps (`visa.steps` in the locale files) against the Embassy of Japan in India site.
- [ ] **Ingredient rules**: sanity-check per-diet rules in `apps/web/src/data/ingredients.json` (e.g. egg = "ask" for vegetarian, shrimp/beef/chicken = "ask" for halal, mushrooms = avoid for Jain).
- [ ] Real restaurant data, if any, with certification sources.

## Mocked vs real

| Area                     | Status                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------- |
| Fear card "food" scan    | Real matcher on curated demo menu text (`sampleDishes.json`, 5 dishes); no OCR until M6 |
| Phrase card              | Real data (`phrases.json`), follows diet + language                                     |
| Language switch EN/HI/GU | Real; HI/GU cover Stage 1, other strings fall back to EN                                |
| Stats counters           | Placeholders (`value: null`), pending real sources                                      |
| CTA "Build my trip"      | Shows a notice until the planner exists (M4)                                            |
| Persona choice           | Real, persisted in localStorage via Zustand                                             |
| API                      | Skeleton only (`/health`), planner endpoints arrive in M5                               |

## Known notes

- Shinkansen livery is stylised (white + rose stripe) to stay in palette; real N700 is white + blue.
- Optional polish: Mathias-style sakura preloader counter while the 3D chunk loads.
- Place taglines in HI/GU (`places.*`) need native review along with the rest.

- Scanner ingredient names (`ingredient.en`) are English only; translate in M6.
- Stage 1 Roots/Numbers/CTA are still the static M1 layout; M3 turns them into the 3D roots reveal and counters.

- `THREE.Clock` deprecation warning in the console comes from R3F 8 on three r186. Harmless; revisit if we upgrade to R3F 9 / React 19.
- `corepack enable` cannot write to Program Files without admin; pnpm shims live in `~/.local/bin`.
