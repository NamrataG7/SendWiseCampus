# SendWise Campus

**On-campus, on-college-owned-devices cyberbullying prevention — privacy-preserving, wellbeing-first.**

> **This is an academic project. Not for production or commercial use.**

## What this is

Cyberbullying between students is a real wellbeing problem, but the commercial
tools that address it on school-issued devices (Bark, Gaggle, GoGuardian, Securly)
are built discipline-first: they ship content to the cloud, hand it to school
administrators, and blur the line between supporting a student in distress and
sanctioning one. Independent critiques (CDT 2021) document the resulting harms,
which fall disproportionately on LGBTQ+ and minority students.

SendWise Campus explores a different design point: nudge the composing student
on-device *before* a hurtful message is sent, emit only anonymised metadata to a
wellbeing-team dashboard that is aggregate-first by default, and make any
per-student drill-down require a cryptographic co-signature from an independent
student ombudsman. Message content never leaves the browser. Wellbeing team and
disciplinary team are separated by policy **and** enforced technically.

Scope is deliberately narrow: **college-owned devices and campus WiFi**. On a
student's personal device the extension is voluntary; nothing about this project
mandates monitoring off-campus.

## Architecture at a glance

```
+-------------------------------------------+        +---------------------------+
|  Student browser (managed Chrome / Edge)  |        |  Campus dashboard         |
|                                           |        |  (Next.js, aggregate-first)|
|  +------------------+                     |        |                           |
|  | Content script   |                     |        |  +---------------------+  |
|  | (on chat sites)  |                     |        |  | Aggregate tiles     |  |
|  +--------+---------+                     |        |  | (k>=10 floor)       |  |
|           |                               |        |  +----------+----------+  |
|  +--------v---------+                     |        |             |             |
|  | On-device        |                     |        |  +----------v----------+  |
|  | RF classifier    |                     |        |  | Drill-down request  |  |
|  +--------+---------+                     |        |  | (dual Ed25519 sig)  |  |
|           |                               |        |  +----------+----------+  |
|  +--------v---------+   metadata only     |        |             |             |
|  | Shadow-DOM       |   (category,        |        |             v             |
|  | warning overlay  |    severity,        |        |  +---------------------+  |
|  | Edit/Send/Cancel |    action, host,    |        |  | Supabase (Postgres) |  |
|  +--------+---------+    ts, hash, DP)    |        |  | + RLS               |  |
|           |            ------------------>|-------->| + hash-chained audit  |  |
|  +--------v---------+                     |        |  | + daily Merkle root |  |
|  | Background       |                     |        |  +---------------------+  |
|  | egress guard     |                     |        |                           |
|  | (LDP applied)    |                     |        +---------------------------+
|  +------------------+                     |
+-------------------------------------------+
        ^  content NEVER crosses this line  ^
        (server-side ingest rejects any content/message/text field)
```

Optional Android IME (`SendWiseCampusKeyboard/`) provides the same on-device
detection surface on college-issued Android tablets. The APK is built in CI;
device rollout is deferred per `docs/PLAN.md`.

## Methodology

The project follows a **design-and-governance** methodology rather than a data
or ML methodology. Concretely:

- **Reuse-first.** SendWise Campus is a fork of the parent project
  [SendWise](https://github.com/NamrataG7/SendWise) and lifts four security
  migrations from
  [SendWiseForensic](https://github.com/NamrataG7/SendWiseForensic). Net-new code
  is confined to the browser-extension surface and the campus-specific
  governance layer; the classifier, detection library, dashboard shell, and IME
  are all inherited.
- **Governance-by-design.** Wellbeing team and disciplinary team are separated
  by written policy *and* enforced technically via role-based RLS, a retention
  cron, dual-control approval on any drill-down, and an independent student
  ombudsman with veto power.
- **Defence-in-depth privacy.** Five stacked layers: (1) on-device
  classification; (2) metadata-only egress with server-side content-field
  rejection; (3) client-side local differential privacy (RAPPOR-style
  randomised response) on the category field; (4) server-side k-anonymity
  floor (k=10) on every aggregate tile; (5) hash-chained audit log with a
  daily Merkle-root anchor for external verifiability.
- **Cryptographic governance primitives.** Per-student de-anonymisation
  requires Ed25519 signatures from *both* the wellbeing lead *and* the
  independent ombudsman; both signatures land in the audit log and are
  re-verified on every read. Ombudsman succession runs a K-of-N attestation
  ceremony (default 3-of-N) signed by prior ombudsmen — the role survives
  graduation without collapsing the veto.
- **Reproducibility.** A Docker Compose review profile stands up Postgres +
  migrations + seeds; small Node scripts regenerate the audit anchor,
  transparency report, performance benchmarks, and bias probe. See
  `docs/REPRODUCIBILITY.md`.

## Components

| Path | What it is |
|---|---|
| `extension/` | MV3 browser extension (Chrome + Edge): content script, shadow-DOM overlay, background egress guard, options page with DP epsilon control. |
| `SendWiseCampusKeyboard/` | Android IME fork of SendWise's SafeKeyboardApp (deferred per PLAN.md; APK built in CI). |
| `shared/detection-library/` | Reused JS detectors from SendWise. |
| `shared/models/` | Random-Forest classifier exported as JSON for the browser and IME. |
| `campus-dashboard/` | Next.js 14 wellbeing-team dashboard (public landing at `/`, dashboard at `/dashboard`, aggregate-first views, dual-control drill-down UI). |
| `supabase/migrations/` | 7 migrations: base schema, hash-chained audit, RLS, auto-expiry, scoped-admin dual-control, signed co-approval, ombudsman key rotation. |
| `scripts/audit-anchor/` | Daily Merkle-root anchor publisher + standalone verifier. |
| `scripts/transparency-report/` | Monthly public HTML aggregate report generator. |
| `scripts/benchmarks/` | Extension performance harness (cold-start, P50/P95/P99 latency, RSS). |
| `scripts/eval/` | Bias probe harness (SAE ↔ AAVE pair set; illustrative). |
| `docs/` | Governance charter, key management protocol, LINDDUN threat model, MDM guide, WiFi templates. |

## Detection and warning surface

The classifier sees only text the user is composing in a supported chat or
messaging surface (input events on target hosts). When the category score
crosses the configured threshold, a shadow-DOM overlay is injected into the
page and offers three actions: **Edit** (return to the composer), **Send
anyway** (proceed and record the decision), or **Cancel** (drop the message).
The overlay is style-isolated from the host page and never uploads or renders
the composed text off-device.

## What leaves the device

Only the following fields, per warning event:

```
category, severity, action, score, host, timestamp,
user_id_hash, session_id, campus_code,
dp_applied, dp_epsilon, ext_version
```

Text, message body, and any raw content field are **never** sent. As
defence-in-depth the server-side `/api/violations` ingest rejects any request
that contains a `content`, `message`, or `text` field, and the `action` enum is
constrained to `edited | sent_anyway | cancelled | blocked` (see commit
`dd97efd`). Client-side LDP is applied to `category` before egress; the
`dp_applied` and `dp_epsilon` fields make this auditable downstream.

## Access governance

- **Aggregate-first UI.** The dashboard defaults to cohort-level tiles.
  Every tile is subject to a k=10 minimum bucket size; smaller buckets render
  as "insufficient data" rather than exposing a near-identifiable count.
- **Drill-down request.** A form captures the requesting staff member, the
  target `user_id_hash`, and a free-text reason.
- **Dual-control approval.** Both the wellbeing lead and the student ombudsman
  must sign the request with their Ed25519 private key. Both signatures are
  stored in the audit log; the server-side verifier re-checks them against the
  current roster on every read, so a rotated-out key stops working immediately.
- **Ombudsman succession.** A K-of-N attestation ceremony (default 3-of-N)
  from the prior ombudsmen rotates the roster; the ceremony itself is signed
  and appended to the audit log.
- **Hash-chained audit log.** Every access, role change, and approval is
  appended with a hash link to the previous entry. A daily Merkle root is
  published for external verification (see `docs/AUDIT_ANCHOR.md`).
- **Retention.** Aggregate data ≤ 1 academic year; per-student incident data
  ≤ 6 months post-resolution. A semester purge cron enforces both limits.

## Deployment

- **College-owned devices.** Force-install the MV3 extension via Chrome
  Enterprise, Google Admin, Intune, or Jamf. Managed configuration pushes the
  `campusCode`. See `docs/MDM.md`.
- **Campus WiFi.** Apply a category filter via Pi-hole, NextDNS, or Cloudflare
  for Teams. See `docs/wifi-policies/`.
- **Personal devices.** Voluntary install only. Voluntary opt-out is honoured
  where campus policy allows.

## Getting started (local dev)

1. Clone the repo.
2. `docker compose --profile review up -d` — starts Postgres, applies all
   migrations, and loads seed data.
3. `cd campus-dashboard && npm install && npm run dev` — dashboard on
   <http://localhost:3000>.
4. Load `extension/` unpacked into Chrome: `chrome://extensions` → enable
   Developer mode → Load unpacked. The vendor sync step runs via
   `npm run sync-vendor` inside `extension/` (or CI performs it automatically).
5. Optional: `node scripts/benchmarks/extension-perf.mjs` to reproduce the
   performance table.
6. Optional: `node scripts/audit-anchor/anchor.mjs` (requires `DATABASE_URL`)
   to generate a Merkle anchor over the current audit log.

See `docs/REPRODUCIBILITY.md` for the full step-by-step.

## Continuous integration

`.github/workflows/ci.yml` runs on every push:

- Campus Dashboard TypeScript check.
- MV3 extension zip build + artifact upload.
- Supabase migration lint (`psql` dry-run with `authenticated` / `anon` /
  `service_role` role stubs).
- APK build for `SendWiseCampusKeyboard` (Android IME).

`.github/workflows/audit-anchor.yml` runs on a daily cron (03:17 UTC) and
publishes the audit-log Merkle-root anchor.

## Documentation index

| Doc | Purpose |
|---|---|
| `docs/PLAN.md` | Full plan, device matrix, timeline, effort estimates. |
| `docs/EXTENSION_SPEC.md` | MV3 extension architecture and reuse notes. |
| `docs/GOVERNANCE.md` | Wellbeing / discipline role separation and oversight. |
| `docs/OMBUDSMAN_CHARTER.md` | Independent ombudsman charter. |
| `docs/TERMS_OF_USE.md` | Student-facing terms of use. |
| `docs/PRIVACY_NOTICE.md` | Student-facing privacy notice. |
| `docs/MDM.md` | MDM deployment guide (Chrome Enterprise, Intune, Jamf, Android Enterprise). |
| `docs/RESUME_HERE.md` | One-page checklist to resume the project cold. |
| `docs/KEY_MANAGEMENT.md` | Ed25519 key custody, roster, and K-of-N rotation ceremony. |
| `docs/PRIVACY_MECHANISMS.md` | Local differential privacy + k-anonymity design and parameters. |
| `docs/AUDIT_ANCHOR.md` | Daily Merkle-root anchor: producer, format, and standalone verifier. |
| `docs/TRANSPARENCY_REPORT.md` | Monthly public transparency-report generator. |
| `docs/LINDDUN.md` | LINDDUN privacy threat model, DFD, and residual-risk table. |
| `docs/BIAS_EVALUATION.md` | Bias-probe methodology, mitigation ladder, and Sap et al. 2019 plan. |
| `docs/BENCHMARKS.md` | Extension performance benchmarking protocol. |
| `docs/REPRODUCIBILITY.md` | End-to-end reproducibility recipe. |
| `docs/wifi-policies/` | Pi-hole, NextDNS, and Cloudflare Gateway policy templates. |

## Reuse credits

- Built on **[SendWise](https://github.com/NamrataG7/SendWise)** — the parent
  project. The detection library, classifier weights, Next.js dashboard shell,
  and Android IME are all reused from SendWise.
- Security-migration patterns are lifted from
  **[SendWiseForensic](https://github.com/NamrataG7/SendWiseForensic)** —
  specifically the hash-chained audit log and dual-control admin patterns,
  adapted here for the wellbeing-team / ombudsman roles.

## License

MIT (inherited from SendWise). See `LICENSE`.

## Academic-project disclaimer

This is an academic prototype exploring privacy-preserving campus wellbeing
telemetry. It has not been independently audited, is not certified against any
regulatory framework, and is not intended for production or commercial use. Do
not deploy on real students without institutional ethics review, legal review,
and adaptation to local law. The repository contains no user-tracking beyond
the metadata schema documented above.
