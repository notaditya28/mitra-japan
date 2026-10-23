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

- One fixed, lazy-loaded R3F canvas (`src/scenes/JourneyCanvas.tsx`) sits behind the Hero, Persona and Tunnel HTML sections (`#journey`). It renders only while `#journey` is on screen and the tab is visible.
- `src/scenes/journeyState.ts` holds a mutable `journey` object (intro, hero, persona, tunnel progress, pointer). ScrollTriggers write it (`useJourneyTriggers`, `TunnelSection`); `CameraRig` reads it every frame. Never put scroll progress in React state.
- Fear gate z positions are derived from the tunnel scroll segments (`FEAR_GATE_Z`), so each card flips exactly as the camera passes its gate. Change `FEAR_IDS` or `TUNNEL_*_Z` there, not in the scene.
- Tunnel uses CSS `position: sticky` plus a scrubbed GSAP timeline (no GSAP pin), which plays well with Lenis.
- `immersive = webgl && tier !== 'low' && !reducedMotion`. Otherwise the static M1 sections render (SVG hero, `FearsSection` grid).
- Dev builds expose R3F state as `window.__journey` for console debugging.
- Hindi/Gujarati: never letter-space Devanagari/Gujarati (`.eyebrow` resets tracking under `:lang(hi|gu)`).

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
