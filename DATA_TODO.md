# Data to-do (owner and reviewers)

Everything here is data or wording that a person has to check before Mitra Japan can call it real. Software can't do these steps. Code to-dos live in `TODO.md`.

## Diet rules (`packages/shared/diet_rules.json`, `needs-review`)

- [ ] **Jain practitioner review:** check the vegetarian base rules plus onion, garlic, other alliums, root vegetables and the strictness profiles (ginger, honey, eating after sunset is out of scope). Confirm the wording the app shows travellers.
- [ ] **Muslim practitioner review (halal):** pork and derivatives, alcohol including mirin, sake and cooking wine, slaughter method, shared equipment, and what certificate scope means (kitchen, product or dish).
- [ ] **Vegetarian, vegan, no-beef and eggless:** check the hidden-ingredient lists (dashi, bonito, niboshi, gelatin, lard, tallow, beef extract in curry roux, egg in noodles and batter).
- [ ] Only after these reviews set `status: verified` in the file. Until then the app shows "rules need review".

## Restaurants

- [ ] **The 9 real places** imported from public guides (Time Out, Visit Chiyoda and others) are `dataOrigin: real` and `not_verified`: they have never answered our questions. Invite them through the partner site, or verify by phone or visit and record the method, date, initials and evidence.
- [ ] **Sample restaurants** (`apps/api/restaurants/seed/sample_restaurants.json`) are illustrative, never real. Replace them with real partners before any public launch; production mode never shows them as verified.
- [ ] **Outreach templates:** a short Japanese and English invitation (what the listing is, that it is free, what we ask, how removal works). Needs a Japanese speaker's review.

## Japanese wording (machine drafts, `needs-review`)

- [ ] The partner site's Japanese form and status page.
- [ ] The "Ask first" phrase cards for travellers (never generated live; only from the reviewed library).
- [ ] Gallery captions and the existing Hindi and Gujarati drafts (see `TODO.md`).

## Other data already tracked

- Heritage entries, visa checklist, emergency contacts, knowledge-base corpus and gallery credits: see `TODO.md` → "Needs owner input".
