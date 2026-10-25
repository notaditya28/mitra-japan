# Evaluation walkthrough (addendum 5 v3)

How to show the restaurant partner site, per-diet verification and live sync to an evaluator. This file is filled in milestone by milestone; steps marked _(milestone N)_ are not built yet.

## What the evaluator sees

1. The traveller app (`apps/web`) runs on demo data with a **DEMO DATA** banner. A seeded trip has a gap: a Jain traveller's Day 2 lunch in Kyoto shows **"No verified meal near this stop"**. _(milestone 4)_
2. The evaluator opens the partner site (`apps/partners`), presses **Fill with sample data** (or types their own restaurant near that stop) and submits. _(milestone 2)_
3. Within about 10 seconds the traveller app shows the new listing as **Partially verified (restaurant-reported)** in the "Ask first" group, with what is missing. _(milestone 3)_
4. In the partner site's `/admin`, the evaluator performs a demo verification for Jain: method, dishes confirmed, initials. _(milestone 2)_
5. The listing moves to **Verified for your diet** with a matcha pin and the **DEMO** badge. The planner offers "A verified option is now available for Day 2 lunch"; applying the patch fills the gap and Food Confidence goes from "2 of 3" to "3 of 3 meals verified". _(milestones 3-4)_

Nothing in demo mode is a real verification: every demo verification is labelled "Fully verified (DEMO)".

## Reset

- Admin action **Reset demo data** _(milestone 2)_, or the CLI:

```bash
apps/api/.venv/Scripts/python -m restaurants.cli reset-demo
```

## URLs, passcode and warm-up _(milestone 5)_

- Demo URLs for the traveller app, the partner site and the API.
- The demo admin passcode (demo only, never reused in production).
- Warm-up checklist: free tiers sleep, so open `/health` on the API and both sites a few minutes before the evaluation.
