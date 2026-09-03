# SendWiseCampus

**On-campus, on-college-owned-devices cyberbullying prevention — privacy-preserving, wellbeing-first.**

> **Academic project — not for production or commercial use.** This repository is a student research artefact developed for coursework. Do not deploy on real students without institutional ethics review, legal review, and adaptation to local law.

## Concept in one line

Reuse the [SendWise](https://github.com/NamrataG7/SendWise) privacy-preserving on-device supervision model, apply it **only to college-owned devices and campus WiFi**, and use a browser extension where SendWise's IME does not reach.

## What this is NOT

- Not a mandate on student-owned devices. Students *may* voluntarily install the browser extension on their personal devices for their own benefit — no data leaves their device.
- Not a surveillance / disciplinary tool. Data flows to the college **wellbeing team**, never to academic misconduct or discipline. Enforced by role separation.
- Not [SendWiseForensic](https://github.com/NamrataG7/SendWiseForensic). That project inverts SendWise's privacy model under judicial warrant for law-enforcement use; SendWiseCampus preserves it.

## Scope — what devices / networks are covered

| Layer | Tool |
|---|---|
| College-owned laptops / Chromebooks | Browser extension force-installed via Chrome Enterprise / MDM |
| College-owned Android tablets (labs, library) | SendWise IME force-installed as system keyboard via MDM, plus the browser extension inside Chrome |
| College lab desktops (Windows / Linux) | Browser extension in Chrome / Edge, force-installed via Group Policy |
| Campus WiFi | DNS + category filter (Pi-hole / NextDNS / Cloudflare for Teams) |
| Student-owned devices | Voluntary install only. No mandate. No data upload beyond what SendWise already sends (anonymised risk metadata). |

## Architecture overview

```
+-----------------------+          +-------------------------+          +----------------------+
|  Student browser      |          |  Campus dashboard API   |          |  Supabase (Postgres) |
|  (managed Chrome)     |          |  (Next.js server)       |          |  + RLS + audit chain |
|                       |          |                         |          |                      |
|  +----------------+   |          |  +-------------------+  |          |  +----------------+  |
|  | Content script |   |          |  | /api/violations   |  |          |  | violations     |  |
|  | on chat sites  |   |  meta    |  | (Zod validation)  |  |  insert  |  | (aggregate)    |  |
|  +-------+--------+   |  data    |  +---------+---------+  |          |  +----------------+  |
|          |            |  only    |            |            |          |  | audit_log      |  |
|  +-------v--------+   |  ---->   |  +---------v---------+  |  ---->   |  | (hash-chained) |  |
|  | On-device      |   |          |  | dual-control      |  |          |  +----------------+  |
|  | classifier     |   |          |  | co-approval gate  |  |          |  | co_approvals   |  |
|  +-------+--------+   |          |  +---------+---------+  |          |  +----------------+  |
|          |            |          |            |            |          |                      |
|  +-------v--------+   |          |  +---------v---------+  |          +----------------------+
|  | Warning overlay|   |          |  | Aggregate views    | |
|  | (Shadow DOM)   |   |          |  | + drill-down (2p) | |
|  +----------------+   |          |  +-------------------+  |
+-----------------------+          +-------------------------+
       ^  content NEVER leaves device                 ^  wellbeing team + ombudsman only
```

The extension does **on-device detection**; only **metadata** (category, severity, action, host, timestamp, anonymous hash) crosses the wire. See `docs/EXTENSION_SPEC.md` and `docs/PRIVACY_NOTICE.md`.

## Quick start

Prerequisites: Node.js 20+, pnpm or npm, Docker (for local Supabase), Chrome/Edge.

```bash
# 1. Install dependencies in each workspace
npm install --prefix shared
npm install --prefix extension
npm install --prefix campus-dashboard

# 2. Reset the local Supabase database (applies all migrations + seeds)
supabase db reset

# 3. Build the extension and load it unpacked
npm run build --prefix extension
#   → Open chrome://extensions
#   → Enable "Developer mode"
#   → "Load unpacked" → select ./extension/dist

# 4. Run the campus dashboard in dev mode
npm run dev --prefix campus-dashboard
#   → http://localhost:3000
```

## Reuse credits

Built on **[SendWise](https://github.com/NamrataG7/SendWise)** (on-device classifier, metadata schema, warning-overlay UX, parental-dashboard baseline) and reuses **security patterns from [SendWiseForensic](https://github.com/NamrataG7/SendWiseForensic)** (Supabase RLS, hash-chained audit log, dual-control co-approval, auto-expiry migrations). See `docs/PLAN.md` for the full reuse table.

## Docs

- `docs/PLAN.md` — the full plan, device matrix, timeline, effort estimates.
- `docs/EXTENSION_SPEC.md` — Manifest V3 extension architecture and reuse notes.
- `docs/GOVERNANCE.md` — wellbeing team vs. disciplinary separation, retention, oversight.
- `docs/MDM.md` — MDM deployment guide (Chrome Enterprise, Google Admin, Intune, Jamf, Android Enterprise).
- `docs/wifi-policies/` — Pi-hole, NextDNS, Cloudflare Gateway policy templates.
- `docs/TERMS_OF_USE.md` — student-facing terms of use.
- `docs/PRIVACY_NOTICE.md` — student-facing privacy notice.
- `docs/OMBUDSMAN_CHARTER.md` — independent ombudsman charter.
- `docs/RESUME_HERE.md` — one-page checklist to pick this project back up cold.

## Lane commit pointers

Progress is tracked in parallel "lanes"; the tip of each lane is:

| Lane | Scope | Commit |
|---|---|---|
| Lane A | Shared detection library + classifier port | `2a9dfc3` |
| Lane B | Extension MV3 skeleton | `c003a93` |
| Lane C | Campus dashboard fork | `058a24c` |
| Lane D | Docs, MDM, WiFi policies, governance texts | *this commit* |

## Contact

Namrata Gaikwad — namratamgaikwad@gmail.com

## Related repos

- Upstream: https://github.com/NamrataG7/SendWise
- Sister project (law enforcement fork): https://github.com/NamrataG7/SendWiseForensic

## Licence

TBD — will inherit MIT from SendWise on first upstream sync.
