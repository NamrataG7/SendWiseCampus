# SendWiseCampus

**On-campus, on-college-owned-devices cyberbullying prevention — privacy-preserving, wellbeing-first.**

> **Status: planning repo.** No code yet. This repo captures the design so implementation can resume later without context loss. See `docs/PLAN.md` for the full plan and `docs/RESUME_HERE.md` for the pickup checklist.

## Concept in one line

Reuse the [SendWise](https://github.com/NamrataG7/SendWise) privacy-preserving on-device supervision model, apply it **only to college-owned devices and campus WiFi**, and use a browser extension where SendWise's IME does not reach.

## What this is NOT

- Not a mandate on student-owned devices. Students *may* voluntarily install the browser extension on their personal devices if they want the nudges, and only for their own benefit — no data leaves their device.
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

## Reuse map — what we already have vs. what is new

| Component | Source | Modification for SendWiseCampus |
|---|---|---|
| Android IME + on-device Random Forest classifier | [SendWise](https://github.com/NamrataG7/SendWise) `SafeKeyboardApp/` | Fork, rename to `SendWiseCampus-Keyboard`; drop parental pairing UX; add MDM-friendly enrollment via a college enrollment code |
| Parental dashboard (Next.js + Supabase) | [SendWise](https://github.com/NamrataG7/SendWise) `parental-dashboard/` | Fork, rename to `SendWiseCampus-Console`; replace parent/child language with wellbeing-team/student; add aggregate-only view (no per-student drill-down unless a documented incident) |
| Anonymised metadata upload schema | SendWise | Reuse verbatim |
| RLS + hash-chained audit log | [SendWiseForensic](https://github.com/NamrataG7/SendWiseForensic) | Optional — adds wellbeing-team accountability. Overkill for MVP, good for academic paper. |
| Dual-control admin flow | SendWiseForensic PR #32 | Optional — for "wellbeing lead + student ombudsman must both approve any de-anonymisation" |
| Browser extension (Manifest V3) | **NEW** — no prior art in either repo | See `docs/EXTENSION_SPEC.md` (planning) |

## Docs

- `docs/PLAN.md` — the full plan, device matrix, timeline, effort estimates.
- `docs/EXTENSION_SPEC.md` — Manifest V3 extension architecture and reuse notes.
- `docs/GOVERNANCE.md` — wellbeing team vs. disciplinary separation, retention, oversight.
- `docs/RESUME_HERE.md` — one-page checklist to pick this project back up cold.

## Contact

Namrata Gaikwad — namratamgaikwad@gmail.com

## Related repos

- Upstream: https://github.com/NamrataG7/SendWise
- Sister project (law enforcement fork): https://github.com/NamrataG7/SendWiseForensic

## Licence

TBD — will inherit MIT from SendWise on first code commit.
