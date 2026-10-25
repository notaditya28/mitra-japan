# Mitra Japan — project rules

A demo-ready web experience that makes Indian travellers want to choose Japan at full price.
Pitch: "Indians don't need Japan to be cheaper, they need it to feel safe, familiar and made for them."

- **Stage 1:** cinematic scroll: title + take-off button → plane flies Delhi → Tokyo → low-poly 3D scenes per city (a short paragraph about each place) → Shinkansen between cities → Indian roots → Japan in pictures (photo/clip gallery) → numbers → CTA, with a city map window (food for your diet, sample stays).
- **Stage 2:** 3D Japan map planner with a Claude trip guide, Food Confidence Score, Veg-Safe scanner.

## Non-negotiable data rules

- **Never invent statistics.** All figures live in `apps/web/src/data/stats.json` with `value`, `label`, `source`, `sourceUrl`, `checkedOn`, `verified`. A value is filled only from a primary source we actually read (owner request, 2026-10-25: JNTO, Ministry of Tourism compendium, Pew); it shows with its source and "pending verification" until a human flips `verified: true`. A figure without a source stays `null` (the team survey figure).
- **Never present a restaurant as real or certified unless the data says so.** `restaurants.json` holds illustrative `sample` entries and researched `needs-review` places; nothing is `verified` until the owner checks it, and the UI shows each entry's status. The Claude system prompt must forbid claiming certification not present in the data.
- Hindi/Gujarati strings are drafts until a native speaker reviews them (tracked in `TODO.md`).
- Visa content is general guidance; always point to the Embassy of Japan in India for current rules.

## Honesty, demo mode and quality rules (owner addendum, 2026-10-24)

The original brief wins on concept, palette, Stage 1 scroll, the stylized 3D map and milestone order; these rules apply on top of it, in every milestone.

- **Never fabricate** statistics, reviews, certifications, verified restaurants, transport schedules, ticket prices, opening hours or availability. Travel times are always labelled estimates.
- **Every seeded record carries `status`**: `verified` | `sample` | `needs-review`, plus `source` and `lastChecked` where relevant, and the UI shows that status as a visible badge or footnote. Seeded restaurants are `sample`; heritage and visa content are `needs-review` until the owner checks them.
- **Demo mode**: with no API key (or when a live call fails) the app keeps working on seeded sample data, shows a persistent "Demo data" indicator, and says plainly what is sample and what is live ("AI planner unavailable, showing the sample itinerary"). Never silently swap a failed live call for made-up results; never claim a scan or integration happened when it didn't.
- **Scanner results** have exactly three states, always with the cause: _No listed conflicts detected_ (never "safe"/"guaranteed"), _Potential dietary conflict detected_ (name the ingredient and why), _Unable to verify_ (unreadable text, unknown ingredient, ambiguous broth/sauce). Unknown or ambiguous never maps to state 1. Every result carries the calm OCR/recipe caveat and points to the staff card. Diet categories stay distinct (vegetarian ≠ Jain; Halal = pork + alcohol incl. mirin/sake; no-beef and vegan separate; custom restrictions supported). Sample scans are labelled "Sample scan". OCR sits behind a provider interface (Tesseract.js default, cloud OCR via env).
- **Restaurants**: superseded by addendum 5 v3 (see "Restaurant partners and per-diet verification"): the API database is the source of truth, each diet has its own status, and never write "certified" without recorded certificate evidence (issuer, validity, scope).
- **AI planner**: server-side only; strict Pydantic schema; validate every response, retry once, then fall back with a visible message; verify every destination against `cities.json` and our place data (drop or flag unknowns); feasibility checks (stops per day, distance between consecutive stops) flag overpacked days; day cards are editable/regenerable and stay in sync with the map; each day shows dietary notes and the Food Confidence Score with reasons. API: request limits, structured errors (400 bad input, 429 rate limit, 502 upstream AI failure), CORS from env.
- **Heritage**: historical associations and syncretic origins, never "the same as"; use "developed from", "is associated with". Only real, locatable sites; every entry `needs-review` with a visible badge until the owner verifies; reference links; practical visiting info only when verified.
- **Visa**: small interactive checklist (purpose + traveller type only), each item "confirm with official source", links to official Japanese government resources, `lastReviewed`, one data file marked `needs-review`. Never approve/reject/predict outcomes, never produce official-looking documents; say it is preparation help, not immigration advice.
- **Trips/export/share**: save, edit, duplicate, delete (with confirmation) in localStorage; professional printable PDF with sources and verification dates; WhatsApp = a URL-encoded `wa.me` share link only, no bot.
- **No** databases, auth, PostGIS, WhatsApp bot or extra pages beyond the brief without asking. Approved exceptions (addendum 5 v3 only): the partner site as a second frontend, server-side persistence (SQLite locally, Postgres-compatible schema, free-tier hosted Postgres for the demo) and hosting for two frontends plus the API. Still out: payments, restaurant or traveller accounts and passwords, scraping or unlicensed data, a WhatsApp bot, extra traveller pages, paid services without asking.
- **Quality**: keyboard access, visible focus, semantic HTML, labelled fields with clear validation, reduced-motion path, loading/error/empty states everywhere; the planner stays usable if 3D fails (flat fallback) and the canvas never blocks scrolling or buttons. Tests: Vitest (web) + pytest (API) for the areas listed in `FEATURES.md`. Run typecheck, lint, tests and build before finishing a milestone and fix failures; don't call a feature done unless you ran it and looked at it.
- **Docs**: keep `README.md` (install, run, env vars, where keys come from, adding restaurants/heritage, limitations), `.env.example` (placeholders only) and `FEATURES.md` (working / demo-only / needs external service or owner verification) current at the end of every milestone.

## Stack

- `apps/web`: Vite 6 + React 18 + TypeScript 5 (strict, `noUncheckedIndexedAccess`, no `any`), Tailwind 3, R3F 8 + drei 9 + three, GSAP + ScrollTrigger, Lenis (driven by the GSAP ticker, see `src/lib/smoothScroll.ts`), Framer Motion, Zustand (`src/store/useAppStore.ts`), d3-geo, tesseract.js, i18next.
- `apps/api`: FastAPI + Pydantic + Anthropic SDK. Model `claude-sonnet-5-5`. API key is server-only. Endpoints: `POST /api/plan`, `POST /api/scan-explain`, `GET /health`.
- pnpm workspace (pnpm via corepack shims in `~/.local/bin` on this machine). TypeScript is pinned to 5.x because typescript-eslint does not yet support TS 7.
- Vite `envDir` is the repo root, so `.env` sits next to `.env.example`.

## Design tokens

Defined once as RGB triplets in `apps/web/src/styles/tokens.css`, mapped in `tailwind.config.ts`, mirrored as hex in `src/styles/tokens.ts` for three.js.

| Token  | Hex     | Use                                                        |
| ------ | ------- | ---------------------------------------------------------- |
| plum   | #4A2238 | deep panels, hero bg, text on light                        |
| sakura | #D9577F | accent, rings, decorative active states                    |
| rose   | #C2456E | **small text and button fills** (sakura fails AA on paper) |
| blush  | #FBE3EA | soft surfaces, chips                                       |
| petal  | #F7C6D0 | petals, highlights                                         |
| paper  | #FFF8FA | page background                                            |
| ink    | #3A2430 | body text                                                  |
| mist   | #8A6B77 | secondary text (4.5:1 on paper, do not lighten)            |
| gold   | #F0C27B | route line, sun, Indian-heritage layer                     |
| matcha | #8FD19E | Veg-Safe layer and "safe" states **only**                  |
| torii  | #C0394B | gates and "avoid" flags, sparingly                         |

`--tint` is set from the chosen persona (`src/features/persona/personas.ts`): family gold, honeymoon sakura, student orchid, foodie torii, spiritual saffron.

Type: Plus Jakarta Sans (UI/body), Shippori Mincho (`.display`, large headings), Noto Sans Devanagari/Gujarati as fallbacks for HI/GU.

## Motifs and components

`src/components/motifs/`: `Seigaiha` (generated SVG, `lib/seigaiha.ts`), `Fuji` (mountain keeps aspect, hills stretch), `SunDisc`, `ToriiGate`, `Lantern`, `Petals2D` (canvas fallback), `Petals3D` (instanced, one draw call).
Utility classes in `styles/index.css`: `.card`, `.card-dark`, `.chip`, `.btn-primary`, `.btn-ghost`, `.eyebrow`, `.display`.
Style: flat low-poly 3D, matte materials, soft light, rounded 16–24px cards, plum-tinted shadows. No photoreal models. Stage 1 spots are low-poly 3D scenes, not photos (owner decision, 2026-10-25, replacing the photo spots of 2026-10-24); each shows a "stylised 3D scene" note. The one place for real photos and clips is the Japan in pictures gallery (owner request, 2026-10-25), every item credited. Use `flat` on R3F canvases so palette colours are not tone-mapped.

## Stage 1 journey architecture (owner redesign, 2026-10-24)

- **Flow:** `Welcome` (title + one button over the 3D map of Asia, plane parked at Delhi; no traveller picker, which is asked once in the planner, owner request 2026-10-25) → `TourSection`: the plane flies Delhi → first city → that city's spots, one 3D scene each → Shinkansen to the next city → its spots → … Roots, the gallery, numbers and the CTA follow.
- **Data:** `features/tour/tour.ts` (three-free) builds `TOUR_CITIES` and `SEGMENTS` from `data/tour.json` (city order, spot names, Japanese names, short `kanji`, `fear`, `scene`, status). `scene` is one of `PLACE_SCENES` (`tokyo`, `fuji`, `kyoto`, `matsuri`); a spot with an unknown scene is skipped. Today (owner order, 2026-10-25: flight → Fuji → Tokyo → Shinkansen → Kyoto → Matsuri; `tour.test.ts` checks it): Tokyo = Fuji day trip + neon street (food card); Kyoto = Fushimi Inari (visa card) + Gion matsuri (foreign card). Each new city gets a Shinkansen segment.
- **Segments:** `flight` (weight 2.2), `spot` (1.4), `train` (1.6); `VH_PER_UNIT` = 120vh. `journey.tour` (0..1) → `computeStage()` → `stage` (`scene` = segment index, `kind`, `view`, `t`, transition values; `view` = `flight` | `train` | the spot's scene, from `viewOf`). Never put scroll progress in React state; the rail and city window read `useTourStore.segment`, which `TourSection` sets from the ScrollTrigger (not the render loop, so they work if 3D is paused or fails).
- **Transitions** (owner request, 2026-10-25: no petal kanji, no torii iris): every boundary is the same slow dip to deep plum (`journey/SceneFade.tsx`; never a light colour, owner found bright veils jarring). The scene, sky and camera switch while the screen is fully dark, then the next scene rises out of it. Timings (`cover`, `warp`) live in `computeStage`.
- **Scenes**, one lazy canvas (`JourneyCanvas.tsx`), only the active view visible (`useSceneGroup(view)`); all scenes share the origin, which is fine because only one renders:
  - `FlightScene`: the map is a canvas texture drawn from `data/asia.geojson`, a Natural Earth 10m admin-0 **India point of view** cut by `scripts/asia_subset.py`. Keep India's official boundary and use the `_ind` source if regenerating. `features/tour/flightMap.ts` holds the shared projection; the great-circle route is a tube revealed by `setDrawRange`, and the camera goes wide over India → chase → dive at Tokyo.
  - `src/scenes/places/`: `TokyoScene` (neon street, ramen stall), `FujiScene` (dawn, sakura avenue, torii row), `KyotoScene` (Fushimi Inari torii tunnel, pagoda), `MatsuriScene` (Gion lanterns, stalls). Shop signs and lanterns are canvas textures from `journey/signs.ts` (redrawn once the Japanese font loads).
  - `journey/ShinkansenScene`: the bullet train between cities.
- Camera paths: `CAMERAS` keyed by view in `journey/CameraRig.tsx`; sky, fog and lights: `MOODS` keyed by view in `journey/Sky.tsx`. A new scene needs an entry in `PLACE_SCENES`, both maps and `JourneyCanvas`.
- About paragraphs (owner request, 2026-10-25, replacing the fear cards in the 3D tour): each spot and each train shows a short paragraph about where you are, on a transparent background (text shadow only), from `tour.spots.<slug>.about` and `tour.train.about` in the locales (`scripts/strings/tour-scenes.json`; HI/GU drafts). Spot, area and city names come from the same strings through `features/tour/labels.ts`. The fear cards still appear in the static `FearsSection` path.
- `ChapterRail` shows names only, in the chosen language (no Japanese labels).
- Non-stop flights card (`features/tour/FlightFacts.tsx`, data in `data/flights.json`, owner request 2026-10-25): fades in mid-flight on the left (the chapter rail owns the right), and sits under the flight map in `TourStatic`. Routes, flight numbers and frequencies come from airline pages and announcements; a fare is shown only if we read it on the airline's own site, with the date seen and the travel dates (ANA today). Air India and JAL fares couldn't be read, so they say "Check fare with the airline". Never live prices; `needs-review`. The wrapper positions the card and only the inner element is animated, so GSAP never bakes the desktop centring transform in.
- **City map window** (`features/tour/CityMapWindow.tsx`, top right): a pill that opens a lazy panel (`CityMapPanel`) with `DietChips` (the profile diet, so it carries over between cities), Leaflet on Esri's plain light grey canvas with no label layer (`CityLeaflet`, lazy; attribution shown; offline note). The map shows no Japanese text: our pins carry plum outlines, and the "you are here" pin has a permanent label in the chosen language. Esri's reference labels and OSM tiles are bilingual or Japanese in Japan, and CARTO tiles now need an API key, food from `restaurants.json` matching the diet (`cityMap.foodFor`) and dummy stays from `data/stays.json` (owner decision: all `sample`, names start with "Sample", no prices). On the train it keeps showing the city you left; hidden during the flight.
- `ChapterRail`: flight, then each city (its spots expanded only when you are there) and the Shinkansen. It appears once the tour is in view and jumps with `features/tour/navigate.ts`.
- `immersive = webgl && tier !== 'low' && !reducedMotion`. Otherwise `TourStatic` (flat flight map SVG, a kanji card per spot) and the `FearsSection` grid.
- Keep three.js, Leaflet and restaurant data out of first paint. The tour uses `features/tour/cities.ts`, not `planner/data`. Check the entry chunk after builds (about 560 kB today).
- Dev builds expose `window.__journey` (R3F state) and `window.__stage`. In the hidden browser pane rAF is throttled (ScrollTrigger and the canvas stall until a screenshot forces a frame); reset to the desktop preset if screenshots go blank.
- Hindi/Gujarati: never letter-space Devanagari/Gujarati (`.eyebrow` resets tracking under `:lang(hi|gu)`); split titles with `Intl.Segmenter` graphemes, never by code point. Spot titles wrap by word.

## Japan in pictures gallery (owner request, 2026-10-25)

- `components/sections/GallerySection.tsx` (lazy chunk) sits between Indian roots and the numbers. Scroll-driven when `tier !== 'low' && !reduced` (no WebGL needed): a sticky frame, the section as tall as the sideways travel, two rows tweened right to left with different scrub lag, and each card turned (`rotationY`, `z`) by its distance from the centre for the revolving look. Otherwise it is a plain sideways-scrolling strip (`role="region"`, focusable, snap) with clip controls and no autoplay.
- Media: `public/gallery/` (WebP photos about 1100 px; MP4 clips trimmed to 10 s, muted, H.264 480p, with WebP posters), listed in `src/data/gallery.json` with `credit` (author, licence, licence link, Commons page, our changes) and `status: needs-review`. Every card shows its credit. Made by `scripts/gallery_media.py` from Wikimedia Commons: free licences only (CC BY, CC BY-SA, CC0, public domain), Quality images first, people-focused titles skipped; pin a reviewed file with `file`. It needs Pillow and imageio-ffmpeg (not project deps). `gallery.test.ts` enforces credits, licences, status and files.
- Clips play only while on screen (IntersectionObserver), always muted, `preload="none"`.

## Restaurant partners and per-diet verification (addendum 5 v3, 2026-10-25)

Overrides earlier restaurant rules where they conflict. Family Mode and the Live Recovery engine (addendum 4) are cancelled: never build, scaffold or reference them. The cost view from addendum 4 was never built here.

- **Layout:** `apps/web` (traveller), `apps/partners` (restaurant partner site: own build, deployment and origin; public onboarding at `/`, verifier area at `/admin` behind `ADMIN_PASSCODE`, not linked publicly), `apps/api` (single source of truth, one database), `packages/shared` (diet ids, status labels, `diet_rules.json`, shared types). The traveller app never contains the restaurant form or the verifier view.
- **Principles:** software checks, people verify. Automation (and Claude) may structure data, apply rules and find contradictions, but it can produce at most `partially_verified`. Only a recorded verifier action sets `fully_verified`. Any doubt, missing answer or contradiction means not recommended. Never "100%", "guaranteed" or "safe"; "certified" only with recorded certificate evidence, naming issuer, validity and scope. Model suggestions need confirmation; statuses come only from deterministic rules.
- **Independence:** a restaurant can never verify itself (edit tokens can never reach verifier actions), and nothing (payment, partnership, volume) may influence a status. Keep this in code comments too.
- **Diets** (distinct, never implied by each other): `jain`, `vegetarian`, `vegan`, `halal`, `no_beef`, `eggless` (sixth diet, owner decision 2026-10-25). Vegetarian never implies Jain; no-beef never implies halal. The web app's `no-beef` maps to `no_beef` at the API boundary.
- **Statuses per (restaurant, diet):** `fully_verified` ("Fully verified"), `partially_verified` ("Partially verified (restaurant-reported)", never green), `not_verified`, `not_suitable`. Each record keeps method (`phone`/`visit`/`third_party_certificate`/`corroborated_traveler_reports`), verifiedAt, expiresAt (default 6 months, `VERIFICATION_EXPIRY_MONTHS`), verifier initials, evidence ids, verified dish ids, missingItems, contradictions, reasons, paused, dataOrigin (`real`/`sample`) and demo. Expiry, an unresolved report or an edit that touches a diet's answers downgrades automatically with a reason; a traveller report sets `paused` ("Under review") and removes the listing from recommendations. Every transition goes to the append-only `audit_log` (ORM guard plus database triggers).
- **Rules:** `packages/shared/diet_rules.json` (`needs-review` until a Jain and a Muslim practitioner check it, see `DATA_TODO.md`). The app shows which rules it applied and never claims religious authority. Jain strictness (e.g. ginger) is a visible profile.
- **Demo vs production (`APP_MODE`):** demo tags every submission `dataOrigin: sample`, shows "DEMO DATA" on both sites, and a verifier action gives "Fully verified (DEMO)" (dashed outline + badge). Production never lets sample records pass the planner filter or show as fully verified, and the importer refuses `fully_verified` without method, verifiedAt, initials and at least one evidence reference.
- **Planner (hard rule):** meals only from restaurants `fully_verified`, unexpired and unpaused for every diet in the trip, with at least one confirmed dish per diet; otherwise "No verified meal near this stop" (nearest verified option with an estimated time, "ask first" options never added automatically, hotel help, packaged-food scanner). Patches and the assistant's `search_restaurants` follow the same filter.
- **Code:** `apps/api/restaurants/` (db, models, status engine, importer, seed, CLI), `apps/api/verification/checks.py` (deterministic checks), Alembic migrations in `apps/api/alembic/`. `DATABASE_URL` defaults to SQLite in `apps/api/data/` (git-ignored).
- Milestones: 1 foundation → 2 partner site + minimal verify → 3 traveller display + live sync → 4 planner integration → 5 hardening, E2E, deployment. Stop after each. The walkthrough lives in `EVALUATION.md`, data follow-ups in `DATA_TODO.md`.

## Map, pages and transitions (M3)

- `src/data/japan.geojson`: Natural Earth 1:10m admin-1 (public domain), filtered to Japan's 47 prefectures and simplified (script kept outside the repo; rerun with a new tolerance if needed). Import with `?raw`.
- `src/lib/japanMap.ts` is the one place that projects Japan: rewinds rings for d3 (otherwise polygons invert), puts Okinawa in an upper-left inset by shifting whole polygons, and exposes `project(lng, lat)` for pins. Use it for every 2D map and keep the same inset rule for city pins.
- Pages: hash router in `src/lib/router.ts` (`journey` / `#/login` / `#/plan`). `#/plan` without a demo user redirects to login. The 3D journey canvas unmounts off the journey page.
- Page transitions go through `playPortal()` (`src/lib/portal.ts`), rendered by `<PortalTransition/>`: veil with 旅, then a torii-shaped SVG mask opens. Use it for any page change.
- Demo sign-in (owner decision): name + Indian mobile, validated in `features/auth/demoAuth.ts`, stored only in localStorage. Never add a network call or real auth without asking.
- Counters (`components/Counter.tsx`) count up only for non-null values from `stats.json`; never fill a value without a source.
- Keep first paint lean: map data, sign-in, planner and the roots reveal are lazy chunks.

## Planner map (M4)

- Data: `cities.json` (15 cities), `restaurants.json` (see M6), `layers.json` (real anime/regional spots), `heritage.json`. Typed access in `features/planner/data.ts`; rules enforced by `data.test.ts` (never certified/verified, valid city refs, coordinates in Japan).
- 3D map lives in `features/planner/map/` (lazy `MapCanvas`). World space comes from `mapSpace.ts`: the same projection as the 2D maps, 1 unit = 40 px, north = -z. Always place things with `lngLatToWorld`.
- Prefectures are extruded per prefecture (`JapanLand`), hover lifts/tints. Clicking any prefecture selects it: it turns see-through with a sakura outline (`SELECTED_OPACITY`), and its first city, if any, is focused. City labels are drei `<Html>`, hidden until the pointer is over the city's prefecture or the label itself (`map/mapHover.ts`, a mutable object read in `useFrame`; `NUDGE` in `CityMarkers` offsets crowded labels). There are no city names on the map otherwise (owner's choice, 2026-10-24).
- Layers (`LayerPins`) spring in/out with stagger and scale with zoom; colours in `layerColors.ts` (three-free so the side panel stays light).
- `RouteLine` takes `RouteStop[]` (`features/planner/route.ts`). M4 shows `SAMPLE_ROUTE` only behind an explicit "Show a sample route" toggle; M5 feeds the AI itinerary into the same component.
- Selection state (`selectedCityId`, `showSampleRoute`) is in the store, not persisted. Camera fly-to is in `MapCameraRig`; user drag cancels it.
- Layout (owner's choice, 2026-10-24): ≥1024 px is the map on the left and one trip panel on the right (profile, guide, day cards, chat, tools, layers), with no city list or city panel. Below 1024 px: a full-screen map + `BottomSheet` with the same trip panel. No WebGL → `JapanMapSvg`. The grid row is `minmax(0,1fr)` and the panel is `relative`, so neither its content nor its `sr-only`/absolute children make the page taller than the viewport.
- Layer pins scale with each pin's distance to the camera (`LayerPins`), so they stay a similar size on screen.
- Map toolbar (`planner/MapToolbar`, owner request 2026-10-25): top left on both maps, 3D map | Street map plus one Map layers button whose panel holds `LayerToggles` (shared store layers) and, on the street map, the basemap picker. Mode and basemap live in `map/mapView.ts`. `StreetMap` is `isolate`d so Leaflet's panes never cover the toolbar; its zoom buttons sit bottom right. Basemaps: Esri streets, Esri topo, OSM (CARTO removed). The street map always draws the itinerary when there is one.
- Prefectures with none of our cities: clicking or double-clicking flies the camera there (`MapCameraRig` `area`) and shows `PrefectureCard`: names, region (`prefecture.ts` `regionOf`, by JIS code), places from our layer data inside it, our nearest cities by straight-line distance (labelled estimate, not travel time), and "Ask Mitra about …". Nothing about a prefecture is invented; `prefecture.test.ts` covers all 47.

## AI trip guide (M5)

- API layout (`apps/api/app/`): `config` (env, `live` vs demo), `data` (reads the web's JSON files, so there is one source of truth), `schema` (strict `Raw*` models for Claude output plus the JSON schema with id enums built from data, and response models), `prompts` (rules + cached catalogue), `planner` (streaming, retry once, notices, fallback), `validate` (grounding + feasibility flags), `sample` (deterministic Demo planner), `stream_parse` (completed days out of a partial JSON stream), `ratelimit`, `main` (routes, error shapes).
- Error shape is always `{"error":{"code","message"}}`; a 502 on `/api/plan` also carries `fallback`. Notice codes in `planner.NOTICES` are shown verbatim in the UI; never swap a failed live plan for the sample without one.
- Tests use `FakeClient` (`tests/conftest.py`) and force `MITRA_DEMO_MODE=1`; never hit the real API in tests.
- Web: the response is validated again at the boundary (`itinerary.ts`); state lives in `usePlannerStore` (not persisted); `visibleDays` = final plan or streaming previews. Day ↔ city sync goes through `focusDay` / `focusCity` (`selection.ts`), never by setting `selectedCityId` directly from planner UI.
- Food Confidence (`foodConfidence.ts`) is deterministic and every score shows its reasons. Addendum 5 v3 (milestone 4) replaces the scoring with coverage: verified meals / total meals ("2 of 3 meals verified"); partially verified restaurants don't count.
- `sampleItinerary.json` is exported from `sample.sample_plan` (family, vegetarian, 5 days). Regenerate it from the API when data changes.
- drei `<Html>` buttons on the map must stop pointer propagation, or R3F's `onPointerMissed` clears the selection.

## Scanner, restaurants and visa (M6)

- Planner tools open as native `<dialog>`s (`components/Dialog.tsx`) straight from the top bar's tool chips (`PlannerSectionNav`; the side-panel tools card was removed, owner request 2026-10-25, so the tools are only in the bar); which one is open lives in `features/tools/useTools.ts`. Each panel (`ScannerPanel`, `RestaurantDirectory`, `VisaPanel`) is a lazy chunk.
- Matcher (`features/scanner/matchIngredients.ts`): longest-match over `ingredients.json`, then `unknownWords` makes anything unrecognised `unverified` (reason `unknown`). A dish title before a colon is skipped for the unknown check only; `menuWords` are ignored. Never let unknown or ambiguous map to `clear`. New dictionary terms: check `sampleScans.test.ts` still finds no unknowns.
- OCR goes through `features/scanner/ocr` (`OcrProvider`, `loadOcrProvider`). Tesseract is lazy-loaded on the first photo; low confidence (< `LOW_CONFIDENCE`) forces "Unable to verify" until the traveller edits the text.
- `/api/scan-explain` (`apps/api/app/scan.py`) only explains the browser's verdict; it rejects overclaiming answers. Custom restrictions and visa ticks persist in `useAppStore` (localStorage).
- Restaurants: `restaurants.json` replaced `foodSpots.json`; `FOOD_SPOTS` is a derived view for the planner. Diet `basis`: self-reported / third-party / independently-verified / unconfirmed (evidence required unless unconfirmed). `data.test.ts` forbids `verified`, certification and the word "certified".
- Visa: `visa.json` (`needs-review`, `lastReviewed`), items filtered only by purpose and traveller type, links only to official `.go.jp` sites (`visa.test.ts`).

## Knowledge assistant / RAG (owner addendum 3, 2026-10-24)

Grounded Q&A + persistent trip context + safe conversational itinerary edits, inside the existing planner (no new pages). Product name is Mitra Japan only (never "JapanSaathi").

- Lives in `apps/api/rag/` (`ingest`, `chunking`, `embeddings`, `store`, `retrieve`, `rerank`, `answer`, `router`, `context`, `patching`, `tools`, `eval`). Corpus in `apps/api/rag/corpus/<topic>/` (visa-entry, transport, food-dietary, attractions, etiquette-law, emergency, disaster, phrases, accommodation-luggage, payments-connectivity, heritage) with `SOURCES.md`.
- Store: FAISS index file + JSON chunk metadata in `apps/api/rag/index/` (the one allowed local "database"). Embeddings: local `intfloat/multilingual-e5-small` via fastembed (ONNX, no torch), behind `EmbeddingProvider`; hosted providers (e.g. Voyage) only via env. Anthropic has no embeddings endpoint.
- Front matter on every doc: `id, title, topic, source_url, source_name, source_type (official-government|official-transport|official-tourism|reputable-local|team-written), language, fetched_on, last_verified, volatility (static|slow-changing|volatile), status (verified|needs-review|sample), licence_note`.
- Corpus honesty: only facts from pages actually fetched, as short summaries with a link (no wholesale copies, respect robots/terms). Can't fetch → stub with `status: needs-review` and list the URL for the owner. Team-written content is `team-written` + `needs-review`. Never type emergency numbers, visa rules, prices, hours or schedules from memory.
- `python -m rag.ingest` is idempotent (re-embeds only changed docs, writes a manifest with hashes); `--check` reports stale / missing-field / needs-review docs.
- Retrieval: query rewrite (history + trip context), hybrid BM25 + dense with RRF, optional reranker, metadata filters; personal details only narrow filters and are never logged. Confidence gate → abstain and point to the official source. Volatile/stale evidence → freshness note with `last_verified`.
- Answers: retrieved text is data, never instructions; important claims carry `[n]` citations; statements labelled fact / suggestion / estimate; INR costs only as estimates. Pydantic response: `answer, language, citations[], confidence (high|medium|low|abstained), freshness_note, suggested_next_steps[], proposed_patch?, needs_clarification?`.
- TripContext: provenance per fact (confirmed|user-provided|estimate|assumption); never persist passport/ID/card numbers (say so if typed); "View my trip data" / "Delete my trip data" must work.
- Itinerary edits are PATCHes (add/remove/move/replace/resize) via tools, previewed as a diff, applied only after confirm + existing validator + feasibility; pinned items untouched; Undo. Never claim a booking was changed.
- Emergency router (rules first, LLM second) has top priority; offline `emergency.json` from official sources, `needs-review` until verified; never replaces responders.
- Live tools (`get_weather`, `get_transit_status`, `get_attraction_hours`) are interfaces; when not connected they say so honestly. Location is opt-in, session-only, never logged.
- Eval: `python -m rag.eval` over 50-80 golden cases (7 demo scenarios + Hindi/Hinglish, prompt injection, stale doc, fake-booking request) with a held-out subset; Markdown report.
- Milestones (stop after each): R1 corpus + ingestion → R2 retrieval + grounded answers + eval → R3 trip context + patching → R4 emergency + live tools → R5 frontend + full eval. Priority if short on time: R1, R2, R4, R3, R5. All five done (2026-10-24).

Implementation notes (R2–R5):

- `assistant.handle` order: scrub → diet-change ack → `router.route` → emergency / smalltalk / plan_change / info. Hypothetical phrasing ("what if", "agar", 「〜たら」) routes to info, not emergency. The LLM route check runs in live mode only.
- Retrieval (`retrieve.py`): BM25 + e5 → RRF (k=60) → `HeuristicReranker`. Confidence is a mix of dense, coverage, agreement and same-doc scores; it abstains below `RAG_ABSTAIN_THRESHOLD` (0.42). Retrieval excludes `test-` fixture docs unless `include_fixtures` is set. `text.EXPANSIONS` holds the Hindi/Hinglish/Japanese query words. Follow-up rewriting (`rewrite.py`) applies only to short pronoun questions.
- `answer.py`:
  - `missing_detail` abstains when a price, hours or timetable question has no evidence line about the same entity.
  - `screen` drops chunks with instruction-like text.
  - `validate_live` rejects uncited facts, numbers not found in cited sources, and booking-change claims. Next steps are built after citations are renumbered.
  - Retune thresholds on `--split dev` only, and report held-out results as they are.
- Rain (`planchange._rain`): an explicit day wins; otherwise a named city picks the current day if it is in that city, else that city's first day.
- Patches (`patching.py`): the pin key is `cityId|name`. `apply_patch` runs `ground_plan` + feasibility and returns a `Diff` plus an undo token (`UNDO`, in memory). The Demo planner is `planchange.rule_based`; live mode is a tool loop with `propose_patch`.
- Web (`features/assistant/`): `useAssistantStore` persists the session id, messages, pins and current day under `mitra-assistant`; location and undo stay in memory only. Patches go through `replaceItinerary`. The emergency dialog uses `offline.ts` when the API fails. Emergency contacts come only from `emergency.json` (pick the mission with `missionsFor`).
- Nested `<dialog>`s: `Dialog` reacts only to its own close/cancel events, because React propagates them up the component tree.
- `MITRA_ENV=production` turns off `/api/knowledge/search` and `/api/ingest`. Render's build runs `rag.ingest`, because the index is git-ignored.

## Team system guide merge (owner decision, 2026-10-24)

- **Rule on conflict:** source is `MITRA_JAPAN_SYSTEM_GUIDE.md` (spec only, no code), and on conflict the guide's feature wins, with these limits:
  - The guide's unsourced figures are shown as written, with `<GuideBadge/>` ("From our team guide · needs review") and the official link, never as verified.
  - The Schedule of Stay is a plain draft, never the official form.
  - Our stack stays.
  - The guide's routes are aliases.
- **Visa:**
  - `visa.json` gained `categories`, `types`, `finance`, `jurisdictions` and `pitfalls`, and every item has a `source`.
  - `visa.test.ts` keeps the official-links and no-prediction rules.
  - Schedule of Stay: `features/schedule/` (persisted drafts, `SchedulePrint`; never asks for passport or ID numbers).
- **Scanner:**
  - Every `ingredients.json` entry now has `romaji` and `english` lists, and `latinWords` holds the stop list.
  - Latin text is matched as whole words, and unknown Latin words still make a result "unable to verify".
  - Matches carry `matchedBy` and `severity`.
  - Look-alikes are guarded (ラムネ, カキ氷, 貝割れ).
  - `app/ingredients.py` must agree with the TypeScript matcher on `src/data/__fixtures__/scanVerdicts.json`; regenerate it with `UPDATE_PARITY=1` after dictionary edits.
  - OCR is `jpn+eng`, with a crop guide (`CropGuide`, `cropRect`).
- **Planner:**
  - Optional request fields: `startCity`, `travellers`, `pace`, `budget`, `interests`, `diets`.
  - Stops have `slot`, `durationMinutes` and `lat`/`lng` (only for stops in our data); days have `meals` and `pace`.
  - `PACE_STOPS` drives both the sample planner and the overpacked flag.
  - Old saved plans parse with defaults (`slot: 'afternoon'`).
  - Trip options are in `planner/tripPrefs.ts` (persisted).
  - `focusStop` / `resetCamera` are in the planner store.
  - `StreetMap` is lazy Leaflet; `CityInsightCard` sits on the 3D map.
  - Regenerate `sampleItinerary.json` with `apps/api/export_sample.py`.
- **Strings:** UI strings live in `apps/web/scripts/strings/*.json` and are merged with `scripts/merge_locales.py` (HI/GU are drafts).

## Section bar (owner request, 2026-10-24)

- The top bar (`Nav`) is one row: brand, `SectionNav` links (scroll sideways when they don't fit), language, CTA. On the planner, Ask Mitra is not in the bar: it is a floating AI button at the bottom left (`planner/AskMitraButton`, sparkle icon) that opens the chat as a pop-up (`assistant/useAskMitra` holds open + a prefilled question; Esc or × closes it). On phones it sits above the bottom sheet (owner request, 2026-10-25). On the journey it stays transparent the whole way down (owner request); the brand, links and language switch sit on frosted plum pills (`bg-plum/65` + blur) and the active link is rose, so they read over the 3D scenes and paper alike. App pages keep a solid bar. Links:
  - Journey: only Indian roots and The numbers (owner request, 2026-10-25; the "Build my trip" button covers the CTA).
  - Planner (lazy `PlannerSectionNav`): Trip options, Itinerary (once there is a plan), then chips that open the tools (scanner, food places, visa, Schedule of Stay, My trips). No Map or Map layers links (owner request, 2026-10-25): those live in the map toolbar.
- The bar's height is published as `--nav-h`; pages that sit under it use `pt-[var(--nav-h,61px)]`.
- Jumps go through `lib/sectionScroll.ts`:
  - `jumpTo(id)` leaves room for the bar and moves focus.
  - Inside `[data-scroll-box]` panels it scrolls the panel itself.
  - On phones `useSheetRequest` opens or lowers the bottom sheet first.
  - Tour cities use `goToSegment` in 3D, and `#tour-city-<id>` in the static layout.
- Active-chip highlight uses an IntersectionObserver on the page sections, plus `useTourStore.segment` inside the tour.

## Motion and performance

- Slow eases (power2/power3, `ease-calm`). Nothing jittery.
- `prefers-reduced-motion`: no scroll-driven 3D, no petals; the static section layouts are the reduced-motion path.
- `lib/device.ts` tiers devices (high/mid/low) and sets canvas DPR cap and petal count. Low tier or no WebGL → 2D fallbacks.
- 3D canvases are lazy-loaded, pause when the tab is hidden or offscreen. Instance repeated meshes.
- Targets: 60fps on a mid laptop, Lighthouse desktop performance 80+.

## Working rules

- Work milestone by milestone and stop for review after each (see `TODO.md`).
- Run the dev server (`.claude/launch.json` → `web`) and look at desktop + mobile before calling anything done.
- Ask before big decisions (state changes, stack swaps, paid services). Keep `TODO.md` current: what is mocked, what is real, what needs the owner's input.
