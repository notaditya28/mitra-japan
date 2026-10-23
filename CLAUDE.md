# Mitra Japan — project rules

A demo-ready web experience that makes Indian travellers want to choose Japan at full price.
Pitch: "Indians don't need Japan to be cheaper, they need it to feel safe, familiar and made for them."

- **Stage 1:** cinematic scroll ("Why Japan, why you?"): hero → persona → torii tunnel of fears → Indian roots → numbers → CTA.
- **Stage 2:** 3D Japan map planner with a Claude trip guide, Food Confidence Score, Veg-Safe scanner.

## Non-negotiable data rules

- **Never invent statistics.** All figures live in `apps/web/src/data/stats.json` with `value`, `label`, `source`, `sourceUrl`, `verified`. Unverified values stay `null` and show a source footnote plus "pending verification". Only a human flips `verified: true`.
- **Never present a restaurant as real or certified unless the data says so.** `foodSpots.json` is demo data, every entry `verified: false`, and the UI shows a visible "demo data" note. The Claude system prompt must forbid claiming certification not present in the data.
- Hindi/Gujarati strings are drafts until a native speaker reviews them (tracked in `TODO.md`).
- Visa content is general guidance; always point to the Embassy of Japan in India for current rules.

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
Style: flat low-poly 3D, matte materials, soft light, rounded 16–24px cards, plum-tinted shadows. No photoreal models, no stock photos. Use `flat` on R3F canvases so palette colours are not tone-mapped.

## Stage 1 journey architecture

- **Places, in order:** 0 Fuji dawn (hero + persona) → 1 Tokyo neon street (food fear) → 2 Shinkansen at golden hour (language) → 3 Kyoto Fushimi Inari + pagoda (visa) → 4 Matsuri night (foreign → leads into Indian roots). Defined in `PLACES` in `src/scenes/journeyState.ts`; each scene lives in `src/scenes/places/*Scene.tsx` and exports its component plus a `CameraPath` (local t 0..1 → camera pos/look).
- One fixed, lazy-loaded R3F canvas (`src/scenes/JourneyCanvas.tsx`) sits behind `#journey` (Hero, Persona, `PlacesSection`). All five scenes are built up front, but only the active one is visible (`useSceneGroup`), so only one renders per frame. Paused offscreen/hidden. Wrapped in `SceneErrorBoundary` with a static sky fallback.
- Scroll → `journey` (mutable: intro, hero, persona, places, pointer). `CameraRig` (mounted first) calls `computeStage()` every frame, producing `stage` (scene, t, and the transition values). Never put scroll progress in React state.
- **Petal Portal transition** (our own, merged from the owner's Awwwards references: austensor particle morph, kelvin stretched type, shape-mask iris): around each boundary, petals swarm into the next place's kanji and the FOV widens; a blush veil closes; the scene switches under it; the veil opens through a torii-shaped window (shader in `journey/PetalPortal.tsx`) while the petals burst away; the Latin place name arrives stretched (`PlacesSection`). Timings live in `computeStage`.
- Each place has an entry and exit `GlowGate portal` so the fly-through motif is literal. Fear-card flips are timed at local t ≈ 0.42–0.55; camera paths turn toward each scene's key moment (ramen stall, train crossing, fear gate, fireworks) in that window.
- Per-scene sky, fog and lights: `MOODS` in `journey/Sky.tsx`. Shop signs/noren/lantern textures: `journey/signs.ts` (canvas, cached, redrawn after fonts load).
- `ChapterRail` (right edge, desktop) shows 00 富士 … 04 祭り and jumps between chapters.
- `immersive = webgl && tier !== 'low' && !reducedMotion`. Otherwise the static sections render (SVG hero, `FearsSection` grid).
- Keep three.js out of first paint: anything imported by the 2D/first-paint path must not import `three` (e.g. `petalShape.ts` vs `petalGeometry.ts`). Check `dist/index.html` and the entry chunk size after builds.
- Dev builds expose `window.__journey` (R3F state) and `window.__stage` for debugging. In the hidden browser pane rAF is throttled and an emulated viewport can stop painting; reset to the desktop preset if screenshots go blank.
- Hindi/Gujarati: never letter-space Devanagari/Gujarati (`.eyebrow` resets tracking under `:lang(hi|gu)`); split titles with `Intl.Segmenter` graphemes, never by code point.

## Map, pages and transitions (M3)

- `src/data/japan.geojson`: Natural Earth 1:10m admin-1 (public domain), filtered to Japan's 47 prefectures and simplified (script kept outside the repo; rerun with a new tolerance if needed). Import with `?raw`.
- `src/lib/japanMap.ts` is the one place that projects Japan: rewinds rings for d3 (otherwise polygons invert), puts Okinawa in an upper-left inset by shifting whole polygons, and exposes `project(lng, lat)` for pins. Use it for every 2D map and keep the same inset rule for city pins.
- Pages: hash router in `src/lib/router.ts` (`journey` / `#/login` / `#/plan`). `#/plan` without a demo user redirects to login. The 3D journey canvas unmounts off the journey page.
- Page transitions go through `playPortal()` (`src/lib/portal.ts`), rendered by `<PortalTransition/>`: veil with 旅, then a torii-shaped SVG mask opens. Use it for any page change.
- Demo sign-in (owner decision): name + Indian mobile, validated in `features/auth/demoAuth.ts`, stored only in localStorage. Never add a network call or real auth without asking.
- Counters (`components/Counter.tsx`) count up only for non-null values from `stats.json`; never fill a value without a source.
- Keep first paint lean: map data, sign-in, planner and the roots reveal are lazy chunks.

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
