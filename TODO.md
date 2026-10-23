# TODO — Mitra Japan

## Milestones

- [x] **M1 Foundation**: monorepo, tooling, tokens, fonts, motifs (seigaiha, Fuji, sun, torii, lantern, 2D/3D petals), store, smooth scroll, styled landing shell
- [x] **M2** Stage 1 hero (3D) + persona + torii tunnel with flipping fear cards, HI/GU Stage 1 copy, language switch, ingredient matcher
- [x] **M2b** Multi-place journey (Fuji → Tokyo → Shinkansen → Kyoto → Matsuri), Petal Portal transitions, stretched place titles, chapter rail
- [x] **M3** Indian-roots mosaic→map reveal, count-up counters (real values only), CTA torii-portal transition, demo sign-in, planner home (2D map; 3D arrives in M4)
- [x] **M4** 3D Japan map (extruded prefectures, seigaiha sea, mini Fuji), 4 animated layers, city cards, sample route with Shinkansen marker, desktop 3-panel + mobile bottom sheet, 2D fallback
- [x] **M5** FastAPI + Claude planner (streamed, schema-constrained, validated, retry + visible fallback), grounding/feasibility flags, day cards ↔ map sync, per-day regenerate, animated route, Food Confidence rings with reasons, Demo/Offline modes
- [x] **M6** Veg-Safe scanner (on-device OCR behind a provider interface, 24 sample scans, three-state results incl. unknown words, custom restrictions, staff card, AI explanation endpoint), restaurant directory (9 researched + 21 sample, filters, evidence), interactive visa checklist
- [ ] **M7** i18n (HI/GU), export (WhatsApp/PDF), polish, performance, deploy

## Needs owner input

- [ ] **API key**: add `ANTHROPIC_API_KEY=` to `.env` (repo root) yourself, then restart the API. Live Claude mode has not been tested yet.

- [ ] **City facts**: review `apps/web/src/data/cities.json` (travel times, veg notes) and `layers.json` (anime/regional spots).
- [ ] **Restaurants** (`restaurants.json`): check the 9 researched places (address, still open, map pin, diet claims) and set `verified` only after checking. Nataraj Ginza was left out because it is reported closed. Add your own places with the README guide.
- [ ] **Visa checklist** (`visa.json`): review each item against the Embassy of Japan in India and MOFA, then set `lastReviewed`. Item text needs HI/GU translation.
- [ ] **Scanner dictionary** (`ingredients.json`, 53 entries + menu words): review per-diet rules (e.g. mushrooms = avoid for Jain, soy sauce and miso = ask for halal, shortening = ask).

- [ ] **Stage 1 revisit**: owner is not fully happy with the multi-place journey (2026-10-23) and will come back with changed requirements. Keep scene code modular (one file per place) so it is easy to rework.

- [ ] **Stats**: fill `apps/web/src/data/stats.json` (Indian arrivals vs total from JNTO, India outbound growth, vegetarian share, own survey result) with sources, then set `verified: true`.
- [x] **Scroll idea / login + booking** (decided 2026-10-23): 3D scroll → "Plan your trip" → **demo login** (name + phone, stored on device, no auth service) → AI planning → review → **mock booking checkout** (clearly labelled demo, no real payments). Slots into M4/M5 after the CTA.
- [ ] **HI/GU review**: native-speaker check of `apps/web/src/locales/hi.json`, `gu.json` and the `hi`/`gu` fields in `apps/web/src/data/phrases.json` (food-safety phrases matter most).
- [ ] **Heritage**: sanity-check one-liners and places in `apps/web/src/data/heritage.json`.
- [ ] **Visa steps**: confirm the 5 steps (`visa.steps` in the locale files) against the Embassy of Japan in India site.
- [ ] Real restaurant data, if any, with certification sources.

## Mocked vs real

| Area                     | Status                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Fear card "food" scan    | Real matcher on 5 of the sample scans (`sampleScans.json`)                            |
| Menu scanner             | Real: on-device OCR (Tesseract.js, CDN download once) + rule-based matcher            |
| AI scan explanation      | Real code; off in Demo mode (503 with a message); live mode untested                  |
| Restaurant directory     | 9 real places (needs review) + 21 illustrative samples; nothing verified or certified |
| Visa checklist           | Real, general items with official links; needs owner review                           |
| Phrase card              | Real data (`phrases.json`), follows diet + language                                   |
| Language switch EN/HI/GU | Real; HI/GU cover Stage 1, other strings fall back to EN                              |
| Stats counters           | Placeholders (`value: null`), pending real sources                                    |
| CTA "Build my trip"      | Real: portal to sign-in → planner                                                     |
| Persona choice           | Real, persisted in localStorage via Zustand                                           |
| AI planner               | Real code; Demo mode (sample itinerary) until a key is set; live mode untested        |
| Offline fallback         | `sampleItinerary.json` exported from the API sample planner                           |
| Food Confidence          | Real formula on unverified demo data, capped at 85                                    |
| Travel times             | Estimates from straight-line distance and mode speed                                  |

## Known notes

- City notes, food-spot text and layer notes are English only (UI chrome is translated).
- Vite `optimizeDeps.include` pre-bundles heavy deps; without it, adding a new import mid-session can load two Reacts ("Invalid hook call") until the dev server restarts.

- Counters animate only when a stat has a `value`; all four are still `null`, so they show “—” until real figures are added.
- Deity stories in `heritage.json` are English only; translate in M7.
- The browser pane sometimes stops painting after big programmatic scrolls (DOM is fine); open a fresh tab to keep testing.

- Shinkansen livery is stylised (white + rose stripe) to stay in palette; real N700 is white + blue.
- Optional polish: Mathias-style sakura preloader counter while the 3D chunk loads.
- Place taglines in HI/GU (`places.*`) need native review along with the rest.

- Scanner ingredient names (`ingredient.en`), restaurant notes and visa items are English only; translate in M7.
- The browser pane's screenshots crop the right edge when the emulated viewport is wider than the pane at 125% scaling; measure layout with JS instead.
- Stage 1 Roots/Numbers/CTA are still the static M1 layout; M3 turns them into the 3D roots reveal and counters.

- `THREE.Clock` deprecation warning in the console comes from R3F 8 on three r186. Harmless; revisit if we upgrade to R3F 9 / React 19.
- `corepack enable` cannot write to Program Files without admin; pnpm shims live in `~/.local/bin`.
- Tesseract logs "Warning: Parameter not found: …" to the console when the Japanese model loads. These come from the model file and are harmless.
