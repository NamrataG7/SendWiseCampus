# LINDDUN Threat Model — SendWiseCampus

> Companion to `PAPER_PLAN.md` §8. The STRIDE-lite table in the paper plan is a
> summary; this document is the full LINDDUN treatment referenced from §5
> (Threat Model) of the eventual manuscript.
>
> LINDDUN references: Deng et al. 2011 (*Requirements Engineering* 16(1),
> 3–32); Wuyts, Sion & Joosen 2020 "LINDDUN GO: A Lightweight Approach to
> Privacy Threat Modelling" (*IEEE EuroS&PW*).

## 1. Data-Flow Diagram (DFD)

```
   [Student device — Chromebook / campus tablet]
   ┌────────────────────────────────────────────┐
   │  Browser (Chromium MV3)                    │
   │  ┌───────────────────────────────────────┐ │
   │  │ content-script.js                     │ │
   │  │   → lib/classifier.js (on-device ML)  │ │
   │  │   → shadow-DOM overlay (UI only)      │ │
   │  │   → local differential privacy layer  │ │
   │  │     (RAPPOR-style randomised response)│ │
   │  └──────────────────┬────────────────────┘ │
   │                     │  metadata-only JSON  │
   │                     │  { category, sev,    │
   │                     │    action, user_hash,│
   │                     │    session, campus } │
   └─────────────────────┼──────────────────────┘
                         │  HTTPS (TLS 1.3)
                         ▼
   ┌────────────────────────────────────────────┐
   │  campus-dashboard API (Next.js edge)       │
   │   • auth: short-lived session token        │
   │   • server-side field-rejection            │
   │     (drops any `text`/`content` fields)    │
   │   • enforces k-anonymity floor on the      │
   │     aggregate UI (min bucket = 10)         │
   └────────┬─────────────────────────┬─────────┘
            │                         │
            ▼                         ▼
   ┌──────────────────┐   ┌─────────────────────────┐
   │  Supabase / PG   │   │  audit_log (hash-chain) │
   │  events (RLS)    │──▶│  every drilldown read,  │
   │  approvals       │   │  every approval, every  │
   │  ombudsman keys  │   │  purge → linked H_n =   │
   └──────────────────┘   │  SHA256(H_{n-1} ‖ row)  │
                          └────────────┬────────────┘
                                       │  daily cron
                                       ▼
                   ┌───────────────────────────────────┐
                   │  Audit anchor publisher           │
                   │   → Merkle root over day's chain  │
                   │   → published to public channel   │
                   │     (GitHub Pages / notary URL)   │
                   └───────────────────────────────────┘
                                       │
                                       ▼
                   ┌───────────────────────────────────┐
                   │  Monthly transparency report      │
                   │  aggregate counts + roster hash   │
                   │  (public, human-readable)         │
                   └───────────────────────────────────┘

   Trust boundaries (⨯):
     ⨯1  device ⨯ network      (TLS + metadata-only egress)
     ⨯2  network ⨯ dashboard   (auth, RLS)
     ⨯3  dashboard ⨯ auditor   (public Merkle root)
     ⨯4  wellbeing lead ⨯ ombudsman  (dual Ed25519 signatures)
```

External entities: **Student, Wellbeing Lead, Ombudsman, External Auditor / Public**.
Data stores: **events**, **approvals**, **audit_log**, **ombudsman_keys**,
**merkle_anchors**, **transparency_reports**.
Processes: **classify**, **egress-privatise (LDP)**, **dashboard-render (k-anon)**,
**dual-signature-verify**, **hash-chain-append**, **merkle-anchor**, **retention-purge**.

## 2. LINDDUN Threat Categories

For each category we list SendWiseCampus-specific threats and the concrete
mitigation implemented in the codebase or governance charter.

### 2.1 Linkability

*Threat that two observations can be linked to the same subject even without
identification.*

| # | Threat | Mitigation | Reference |
|---|---|---|---|
| L1 | Two events from the same `user_id_hash` linkable across sessions, allowing behavioural profiling by a dashboard viewer | k-anonymity floor on aggregate UI (min bucket 10) blocks per-user drilldown at low N; per-user drill-down is gated behind dual-control approval | `PRIVACY_MECHANISMS.md` §k-anonymity; `KEY_MANAGEMENT.md` §dual-control |
| L2 | Per-campus, per-category counts allow correlation with an out-of-band roster leak | LDP randomised response on category field bounds any single query's information gain | `PRIVACY_MECHANISMS.md` §LDP |
| L3 | Ombudsman signing key reuse links approvals across cases | K-of-N roster with rotation ceremony ensures no single key persists across the retention window | `KEY_MANAGEMENT.md` §rotation |

### 2.2 Identifiability

*Threat that a subject can be identified from data that was intended to be
anonymous.*

| # | Threat | Mitigation | Reference |
|---|---|---|---|
| I1 | Small-N campus + rare category → row uniquely identifies a student | k-anonymity floor suppresses aggregate cells below 10; drilldown requires dual-control | `PRIVACY_MECHANISMS.md` §k-anonymity |
| I2 | `user_id_hash` is deterministic → a stolen roster + hash-function knowledge re-identifies | Hash is HMAC-keyed per-campus with a server-held pepper; pepper rotates on ombudsman ceremony | `KEY_MANAGEMENT.md` §id-hashing |
| I3 | Free-text field leaks names/emails despite policy | Client-side field-rejection AND server-side field-rejection; content fields dropped before persistence | `EXTENSION_SPEC.md`; `PLAN.md` §telemetry schema |

### 2.3 Non-repudiation

*Threat that a subject cannot deny an action (a **privacy** threat when it
enables coercion), OR that a legitimate action can be repudiated (an
**integrity** threat).*

| # | Threat | Mitigation | Reference |
|---|---|---|---|
| N1 | Wellbeing lead denies having read a specific student record | Every drilldown appends a signed row to the hash-chained audit log; daily Merkle anchor makes retroactive edits externally detectable | `AUDIT_ANCHOR.md`; `KEY_MANAGEMENT.md` |
| N2 | Ombudsman denies having approved a de-anonymisation | Ed25519 signature on the approval row is cryptographically bound to the ombudsman's rotated key; roster hash in the transparency report | `KEY_MANAGEMENT.md` §Ed25519 |
| N3 | Student wants to *repudiate* a warning event (privacy sense — cannot deny it happened) | Content is never transmitted; only category+severity+action. Nothing recoverable to attribute a specific utterance without the device itself | `PLAN.md` §telemetry schema; `PRIVACY_MECHANISMS.md` |

### 2.4 Detectability

*Threat that the existence of a record can be observed even without reading
its contents.*

| # | Threat | Mitigation | Reference |
|---|---|---|---|
| D1 | Traffic-analysis observer notes an extension egress and infers a warning was shown | LDP dummy submissions and randomised timing jitter reduce single-event inference | `PRIVACY_MECHANISMS.md` §LDP dummies |
| D2 | Presence of an approval row in the public transparency report reveals that a specific student was drilled into | Report aggregates only; roster and per-request identifiers are hashed and rate-bucketed | `TRANSPARENCY_REPORT.md` |
| D3 | Audit-log size growth is observable | Padding + monthly rollover; anchors are constant-size per day | `AUDIT_ANCHOR.md` |

### 2.5 Disclosure of information

*Threat that information is disclosed to an unauthorised party.*

| # | Threat | Mitigation | Reference |
|---|---|---|---|
| DI1 | Dashboard breach exfiltrates events | Metadata-only schema — no content ever on server; RLS + short-lived tokens | `PLAN.md` §RLS |
| DI2 | Insider on wellbeing team unilaterally reads a specific student's history | Dual-control gate: any drilldown requires ombudsman Ed25519 co-signature; refused requests still logged | `KEY_MANAGEMENT.md`; `AUDIT_ANCHOR.md` |
| DI3 | Chrome Web Store or MDM channel compromised → malicious content-script exfiltrates text | Reproducible build (CI zip artefact pinned to commit hash); Chrome Enterprise policy pins `extension_id` + `update_url` + `minimum_version` | `EXTENSION_SPEC.md` §MDM pinning |
| DI4 | Merkle-anchor publication channel compromised | Multi-channel publication (GitHub Pages + notary URL); auditors verify chain independently | `AUDIT_ANCHOR.md` §multi-channel |

### 2.6 Unawareness

*Threat that the subject is not informed of, or cannot meaningfully consent
to, the processing.*

| # | Threat | Mitigation | Reference |
|---|---|---|---|
| U1 | Student unaware that a warning event was recorded | Shadow-DOM overlay explicitly says "this event is recorded as metadata"; onboarding disclosure required at first launch | `EXTENSION_SPEC.md` §onboarding copy |
| U2 | Student unaware of the wellbeing-vs-discipline separation | Governance charter is public; transparency report is public and human-readable | `TRANSPARENCY_REPORT.md`; `GOVERNANCE.md` |
| U3 | Student unaware of who holds ombudsman keys | Roster hash + ombudsman identity published in the transparency report (institution names, not personal PII beyond role) | `TRANSPARENCY_REPORT.md` |

### 2.7 Non-compliance

*Threat that the system violates policy, law, or its own stated properties.*

| # | Threat | Mitigation | Reference |
|---|---|---|---|
| NC1 | Retention overrun — data kept past 6-month post-resolution window | Retention cron enforced; purge rows appended to audit chain and covered by daily Merkle anchor (i.e. non-purge is externally detectable) | `AUDIT_ANCHOR.md` §retention rows |
| NC2 | Wellbeing telemetry used in a disciplinary proceeding | Governance charter marks records inadmissible; ombudsman veto is a required signer; audit chain evidences every access | `GOVERNANCE.md`; `KEY_MANAGEMENT.md` |
| NC3 | k-anonymity floor silently disabled by a code change | Floor is a database view constraint AND a client render check; the transparency report includes the current floor value | `PRIVACY_MECHANISMS.md`; `TRANSPARENCY_REPORT.md` |
| NC4 | LDP epsilon budget silently increased | Epsilon is published in the monthly transparency report; changes appear in the roster/config hash diff | `TRANSPARENCY_REPORT.md`; `PRIVACY_MECHANISMS.md` |

## 3. Residual Risks

| # | Risk | Severity | Disclosure text for the paper Limitations section |
|---|---|---|---|
| R1 | Statistical re-identification at very small N despite the k-anonymity floor, when combined with out-of-band knowledge | **Medium** | "The k-anonymity floor bounds direct re-identification from the aggregate UI but does not defend against a well-informed adversary combining public roster data with rare-category timing." |
| R2 | Rooted/jailbroken student device disabling the extension entirely | Low (integrity, not privacy leakage) | "A tampered device can suppress warnings; MDM tamper-detection is treated as an orthogonal control layer." |
| R3 | Compromise of BOTH wellbeing-lead and ombudsman signing keys | **High** *(low likelihood, high impact)* | "The dual-control primitive collapses if both key-custody chains are simultaneously compromised. K-of-N rotation, air-gapped key generation, and per-ceremony hardware attestation are recommended as future work." |
| R4 | Merkle-anchor publication channel censored or delayed | Medium | "Anchor publication is best-effort; if suppressed, external auditors lose real-time tamper-evidence but retain retrospective verifiability once anchors are published." |
| R5 | Illustrative bias probe is not a validated evaluation | Medium | "Dialect fairness has not been evaluated on a validated corpus; see BIAS_EVALUATION.md for the planned Sap et al. 2019 dataset study." |
| R6 | Ombudsman independence is a policy claim, not a technical one | Medium | "The system enforces a signature requirement; genuine political independence of the ombudsman is a governance prerequisite." |

## 4. Reviewer-Facing Summary

SendWiseCampus applies LINDDUN across a bounded architecture in which
**content never leaves the device** and every subsequent processing step is
either dual-controlled (Ed25519 signatures from a wellbeing lead and an
independent ombudsman), differentially-privatised (RAPPOR-style client-side
randomised response, plus a server-side k-anonymity floor on the aggregate
UI), or externally verifiable (daily Merkle anchoring of a hash-chained audit
log). The residual risks that remain — small-N re-identification, device
tamper, dual-key compromise, and dialect bias — are disclosed in the paper's
Limitations section rather than mitigated post-hoc, and each has an explicit
future-work item.

## References

- Deng, M., Wuyts, K., Scandariato, R., Preneel, B., & Joosen, W. (2011). "A privacy threat analysis framework: supporting the elicitation and fulfillment of privacy requirements." *Requirements Engineering*, 16(1), 3–32.
- Wuyts, K., Sion, L., & Joosen, W. (2020). "LINDDUN GO: A Lightweight Approach to Privacy Threat Modelling." *IEEE European Symposium on Security and Privacy Workshops (EuroS&PW)*.
- Laurie, B. (2013). "Certificate Transparency." *ACM Queue* / RFC 6962.
- Crosby, S. A. & Wallach, D. S. (2009). "Efficient Data Structures for Tamper-Evident Logging." *USENIX Security*.
- Sweeney, L. (2002). "k-anonymity: A model for protecting privacy." *IJUFKS*, 10(5), 557–570.
- Erlingsson, Ú., Pihur, V., & Korolova, A. (2014). "RAPPOR: Randomized Aggregatable Privacy-Preserving Ordinal Response." *ACM CCS*.
- NIST SP 800-57 Part 1 Rev. 5 (key-management dual control).
- Anderson, R. *Security Engineering* (3rd ed.) — chapter on two-person integrity.
