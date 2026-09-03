# Resume Here

Cold-pickup checklist for the next time you (or an AI) come back to this repo.

## Current state

Planning only. No code. Four docs:

1. `README.md` — what this is / not
2. `docs/PLAN.md` — the plan
3. `docs/EXTENSION_SPEC.md` — the browser extension architecture
4. `docs/GOVERNANCE.md` — wellbeing / disciplinary separation rules

## First 30 minutes when you come back

1. **Skim `README.md`.** Confirm the scope (college-owned devices only + campus WiFi; personal devices voluntary).
2. **Read `docs/PLAN.md`.** Note the reuse table — most components come from SendWise / SendWiseForensic.
3. **Decide what to build first.** Recommended: the browser extension.
4. **Clone the two upstream repos side-by-side** so you can copy the classifier and dashboard code without re-deriving:
   ```
   git clone https://github.com/NamrataG7/SendWise.git ../SendWise
   git clone https://github.com/NamrataG7/SendWiseForensic.git ../SendWiseForensic
   ```

## Suggested first coding session

Extension skeleton in this order:

1. `manifest.json` (MV3) with permissions `activeTab`, `scripting`, `storage`, host permissions for the initial list in `docs/EXTENSION_SPEC.md`.
2. `content-script.ts` that hooks `input` events on `<textarea>` and `contenteditable`.
3. Port the Random Forest classifier from `SendWise/model_training/export_to_kotlin_json.py` output — the same JSON works if you write a small JS loader.
4. Warning overlay in Shadow DOM (React optional; plain DOM is enough for MVP).
5. Options page with an "on / off" toggle.

Metadata upload, dashboard fork, MDM policies — later steps.

## Reuse pointers

| Need | Where in upstream |
|---|---|
| Classifier weights | `SendWise/model_training/data/` + `export_to_kotlin_json.py` output |
| Slur list + lexicon | `SendWise/shared/detection-library/` (if present) or embedded in the SafeKeyboardApp source |
| Warning-overlay copy | `SendWise/SafeKeyboardApp/app/src/main/res/values/strings.xml` |
| Metadata schema | `SendWise/parental-dashboard/lib/schema.ts` (ViolationIngestSchema) |
| RLS + audit chain (if reusing) | `SendWiseForensic/supabase/migrations/20260831110905_audit_log.sql` and `20260831110906_rls_and_query_gates.sql` |
| Dual-control admin pattern (if reusing) | `SendWiseForensic/supabase/migrations/20260902000200_scoped_admin_and_coapproval.sql` and `forensic-console/app/admin/**` |

## Key decisions already made (don't relitigate)

- Manifest V3, Chromium-first.
- No personal-device mandate.
- Wellbeing team ≠ disciplinary.
- Aggregate-first dashboard; per-student drill-down requires dual-control.
- Data retention 1 academic year (aggregate) / 6 months (incident).
- Content never leaves the device by default.

## Open questions to answer during first coding session

1. Model runtime: TF.js or ONNX.js or a custom RF loader? Pick the smallest binary.
2. Do we support Edge / Firefox on day one, or only Chromium?
3. What's the backend host? Reuse an existing Supabase project or spin a new one?
4. Which college is the pilot partner? Their acceptable-use policy shapes the terms of use.

## Related work that might overlap

- SendWiseForensic has a working admin console with dual-control that could be lifted almost verbatim if we need the same for wellbeing lead + ombudsman approvals.
- SendWise's parental-dashboard has aggregate/insights views already — the wellbeing dashboard is ~70% the same code with different labels.

## Timebox for MVP

Six weeks per `docs/PLAN.md` timeline. If a stretch is needed, the browser extension alone is usable without the fancy dashboard — just log to a static admin email initially.
