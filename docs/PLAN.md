# Plan — SendWiseCampus

## Goal

Reduce cyberbullying at colleges via a **privacy-preserving, on-device nudge** system deployed only on college-owned devices and campus networks. Wellbeing-first, not disciplinary. No compulsion on personal devices.

## Device / network matrix

| Layer | Tool | Enforcement | Notes |
|---|---|---|---|
| College-owned laptop / Chromebook | Browser extension | Force-install via Chrome Enterprise / MDM | Chromebooks are 100% browser — this covers everything. |
| College-owned Android tablet (labs, library) | SendWise IME + browser extension | MDM force-installs IME as system keyboard; Chrome Enterprise force-installs extension | IME covers WhatsApp / Snapchat / Instagram native app typing; extension covers Chrome. |
| College lab desktop (Windows / Linux) | Browser extension in Chrome / Edge | Group Policy force-install | |
| Campus WiFi | DNS + category filter | Pi-hole / NextDNS / Cloudflare for Teams | Blocks known bullying/harassment domain categories at network layer. |
| Student-owned device | Voluntary extension only | User install; nothing forced | Same privacy-preserving mode as upstream SendWise — no content leaves the device. |

## Reuse table

| From | Reuse as-is | Modify | Discard |
|---|---|---|---|
| SendWise `SafeKeyboardApp/` | Random Forest classifier, hardcoded slur triggers, lexicon fallback, on-device warning overlay | Rename to `SendWiseCampus-Keyboard`; replace pairing OTP with a college enrollment code delivered via MDM; drop the parental-dashboard-specific UX | Parent-visible metadata screens |
| SendWise `parental-dashboard/` | Next.js + Supabase + Redis stack; Zod schemas; middleware | Parent → wellbeing team; child → student; add aggregate-only mode (count-based, no per-student drill-down) | Pair page, insights page tuned for parents |
| SendWise `shared/detection-library/` and `model_training/` | Verbatim | Add a new training set with college-context bullying data | — |
| SendWiseForensic RLS + audit chain | Copy the migrations verbatim as a starting point | Simplify — no warrants, no evidence table | Warrant/scope/proportionality columns |
| SendWiseForensic dual-control admin flow | Full pattern | Wellbeing lead + student ombudsman must both approve any de-anonymisation of aggregate data | Officer/judicial-warrant roles |

## New work (the browser extension)

The browser extension is the only fully-new component. See `EXTENSION_SPEC.md` for architecture.

Rough effort estimate: 1–2 weeks of one developer's time.

## MVP scope

1. **Browser extension (Manifest V3)** — Chrome + Edge (Chromium API is identical).
2. **Aggregate wellbeing-team dashboard** — fork of parental-dashboard with wellbeing-team language and role separation.
3. **MDM deployment guide** — Chrome Enterprise, Google Admin Console for Chromebooks, Intune for Windows, Jamf for iPad, Android Enterprise for tablets.
4. **Campus WiFi policy templates** — Pi-hole blocklists + captive-portal terms.
5. **Governance doc** — see `GOVERNANCE.md`.

## Deferred

- SendWiseCampus-Keyboard (Android tablet IME) — do after the extension. Same fork pattern SendWiseForensic already used.
- Any personal-device flow — remain voluntary, no server-side changes needed.
- iOS coverage — Safari Web Extensions cost real money to distribute and iPad usage on Indian college campuses is minimal.

## Timeline (indicative, one developer)

| Week | Deliverable |
|---|---|
| 1 | Extension skeleton + classifier port to JS |
| 2 | Warning overlay + metadata upload + settings page |
| 3 | Dashboard fork + wellbeing-team aggregate view |
| 4 | MDM policy templates + deployment guide |
| 5 | Governance + terms of use + student ombudsman workflow |
| 6 | Pilot with one department, iterate |

## Success metrics

- Reduction in student-reported cyberbullying incidents (survey).
- Ratio of "Edit" vs. "Send anyway" clicks on the warning overlay.
- Time from wellbeing-team alert to student support contact.
- No expansion into disciplinary use (measured by policy audits).

## Anti-goals

- No individual-student surveillance UI.
- No integration with academic misconduct systems.
- No content upload from student-owned devices.
- No perpetual retention — end-of-semester automatic purge unless a documented incident is flagged.
