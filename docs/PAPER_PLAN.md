# SendWiseCampus — Paper Plan and Related-Work Survey

> Status: design/architecture paper. No user pilot has been done. This document is a planning artefact, not the paper itself.
> References marked `[VERIFY]` should be double-checked (year, venue, DOI) before submission.

## 1. Publishability Verdict

**Yes — publishable in a Scopus-indexed venue without a user pilot, if framed as a design / architecture / governance paper rather than an empirical evaluation.** The systems-security, computer-ethics, and privacy-engineering communities have a well-established tradition of accepting design-only papers (e.g., proposed architectures, threat models, governance primitives) at venues like ACM SIGCAS, Springer's *Ethics and Information Technology*, *AI and Ethics*, and *SN Computer Science*. The framing MUST make the design contribution explicit and honest — do not overclaim an evaluation you have not performed. Frame this as **"a design and governance-primitive proposal, with implementation reference and a pre-registered evaluation plan for future work."**

## 2. Recommended Framing (single sentence)

> "SendWiseCampus: a cryptographically enforced dual-control, ombudsman-mediated de-anonymisation architecture for on-device, differentially-private, k-anonymous campus wellbeing telemetry, with externally verifiable audit anchoring — separating student support from academic discipline by design AND by cryptographic construction."

Why this framing:
- Puts **governance** (the genuinely novel contribution) first, not ML (which is reused).
- Avoids claims that require empirical evidence (accuracy, adoption, effectiveness).
- Positions the paper in the ethics/privacy-engineering track rather than the ML track.
- The dual-control + ombudsman + audit-chain combination is under-studied in the student-monitoring literature.

## 3. Suggested Venues (design-only accepted)

Ranked by fit for a design/governance paper from a solo student author, no pilot.

| Rank | Venue | Type | SJR/CS | Fee | Fit |
|---|---|---|---|---|---|
| 1 | **Springer AI and Ethics** | Journal, Scopus | Q1 (new but rising) | ~$1990 OA / free non-OA | Ideal — explicitly accepts design & governance papers |
| 2 | **Springer Ethics and Information Technology** | Journal, Scopus | Q1 | free non-OA (~$3060 OA) | Strong fit; established venue |
| 3 | **Springer SN Computer Science** | Journal, Scopus | Q2 | ~$799 OA | Permissive, fast, accepts prototype papers |
| 4 | **Elsevier Heliyon (Computer Science section)** | Journal, Scopus | Q2/Q3 | ~$2260 OA | Broad scope, accepts descriptive systems papers |
| 5 | **IEEE Access (design article track)** | Journal, Scopus | Q1/Q2 | ~$1995 OA | Fast (~4-6 weeks); needs a system-description angle |
| 6 | **ACM Journal of Responsible Computing** | Journal, Scopus | new | varies | Explicitly welcomes governance-forward CS papers |
| 7 | **ACM SIGCAS Computers and Society Magazine** | Magazine, Scopus (Compendex) | n/a | free | Shorter, ideal for a first paper on the governance angle |
| 8 | **Workshop tracks** — ACM SafeThings, USENIX SOUPS Posters, WPES (co-located with CCS), IEEE SecDev | Workshop | Scopus (via proceedings) | conference registration | Good rehearsal venues for a design paper |

**My recommendation for first submission:** *Springer SN Computer Science* (fast, accepts design papers, low bar, still Scopus-indexed) OR *Springer AI and Ethics* (stronger venue, longer review). If you want a workshop first for feedback: *ACM SafeThings* or *WPES*.

**Avoid:** any journal that promises <14-day decision or charges >$3000 without a clear editorial board. Verify Scopus indexing at <https://www.scopus.com/sources>.

## 4. Related Work Survey (10 papers)

### Bucket A — Cyberbullying detection ML

**[P1] Dinakar, Reichart & Lieberman (2011). "Modeling the Detection of Textual Cyberbullying"**
- *ICWSM Workshop on Social Mobile Web / [VERIFY exact venue]*
- Method: Supervised text classifiers (Naive Bayes, SVM, JRip, J48) on YouTube comments, category-specific.
- Result: Per-topic models outperform generic toxicity models; F1 up to ~0.72 on race, culture, sexuality categories.
- Well: Foundational categorical approach still used by later work.
- Gap for us: server-side inference; no privacy consideration; no deployment surface.

**[P2] Van Hee et al. (2018). "Automatic detection of cyberbullying in social media text"**
- *PLoS ONE 13(10): e0203794. DOI: 10.1371/journal.pone.0203794* [VERIFY]
- Method: Fine-grained annotation + linear SVM on English + Dutch corpora (Ask.fm).
- Result: F1 ~0.64 English, ~0.61 Dutch; role detection (harasser, victim, bystander).
- Well: Multi-lingual, role-aware annotation schema.
- Gap for us: batch/off-line; not a real-time intervention.

**[P3] Emmery et al. (2021). "Current limitations in cyberbullying detection: on evaluation criteria, reproducibility, and data scarcity"**
- *Language Resources and Evaluation, 55(3), 597–633.* [VERIFY]
- Method: Systematic meta-review of ~85 cyberbullying classifiers.
- Result: Field is over-optimistic; datasets tiny + non-representative; near-zero cross-domain generalisation.
- Well: Sober assessment reviewers respect.
- Gap for us: they call for deployment studies — we address this by proposing a governance-aware deployment.

### Bucket B — Warning / just-in-time / pre-send interventions

**[P4] Bowler, Knobel & Mattern (2015). "From cyberbullying to well-being: A narrative-based participatory approach…"**
- *Journal of the Association for Information Science and Technology (JASIST), 66(6), 1274-1293.* [VERIFY]
- Method: Youth co-design of anti-cyberbullying features including reflection prompts.
- Result: Youth prefer non-punitive, self-reflective UI over reporting.
- Well: Grounds the "nudge over punish" framing.
- Gap for us: paper-based prototype only; no implementation, no deployment.

**[P5] Chatzakou et al. (2017). "Mean Birds: Detecting Aggression and Bullying on Twitter"**
- *ACM WebSci 2017. DOI: 10.1145/3091478.3091487* [VERIFY]
- Method: Feature engineering + Random Forest on labelled Twitter accounts.
- Result: 90%+ AUC for aggressor/bully account classification.
- Well: Strong ML baseline; shows RF is competitive.
- Gap for us: post-hoc detection at platform level, no user-facing warning surface.

**[P6] "ReThink" / Bhatt (2013+ ongoing) — pre-send intervention system**
- *Various IEEE/ACM student-conference papers on the ReThink app; author Trisha Prabhu.* [VERIFY specific paper — start with IEEE 2014 or 2015 paper on ReThink]
- Method: Pre-send popup on Android keyboard prompting user to reconsider.
- Result: Self-reported reduction ~90% in test settings; small-N.
- Well: Pioneered the pre-send warning modality.
- Gap for us: personal-device consumer app; no institutional governance; no dual-control; no aggregate telemetry; no ombudsman.

### Bucket C — On-device / privacy-preserving inference

**[P7] Hard et al. (2018). "Federated Learning for Mobile Keyboard Prediction"**
- *arXiv:1811.03604* [VERIFY — Google paper, definitely arXiv, may be published elsewhere]
- Method: FL for next-word prediction on Gboard.
- Result: FL matches server-side accuracy while keeping user text on device.
- Well: Establishes the "keep content on device" pattern for keyboards.
- Gap for us: FL trains a model; we do INFERENCE on device (simpler, still novel in campus context) and add governance around metadata reporting.

**[P8] Warden & Situnayake (2019/2020). *TinyML* [book] and related ACM/IEEE surveys on on-device inference**
- *O'Reilly, ISBN 978-1492052043 [book — for survey use a follow-up peer-reviewed paper: Banbury et al. 2020 "Benchmarking TinyML Systems", arXiv:2003.04821]* [VERIFY]
- Method: Survey on-device inference constraints (RAM, latency, energy).
- Result: Sub-100kB classifiers feasible on microcontrollers.
- Well: Justifies the "small RF/DecisionTree on the client" architecture.
- Gap for us: purely technical; no policy layer, no ethics.

### Bucket D — Student monitoring products & critique

**[P9] Barrett & Rice / Center for Democracy & Technology (2021). "Online and Observed: Student Privacy Implications of School-Issued Devices and Student Activity Monitoring Software"**
- *CDT Report, Sept 2021. https://cdt.org/insights/report-online-and-observed…* [VERIFY exact title/URL]
- Method: Survey of 1000+ teachers, parents, students + policy analysis of Gaggle, GoGuardian, Bark, Securly.
- Result: Widespread deployment; disproportionate impact on LGBTQ+ and minority students; near-zero governance transparency; misuse for discipline is common.
- Well: Best-known critique of the current-generation products. Essential citation.
- Gap for us: exactly the wellbeing-vs-discipline conflation SendWiseCampus rules out by policy AND by design.

### Bucket E — Ethics / governance of youth surveillance

**[P10] Livingstone (2018) or Marder et al. (2022) — surveillance in schools**
- Option A: **Livingstone (2018) "Children's data and privacy online: growing up in a digital age"** *LSE Media Policy Project.* [VERIFY]
- Option B: **Marder, Houghton et al. (2022) "Every post you make, every pic you take…: A study of parent–child conflict over social media surveillance"** *Computers in Human Behavior* [VERIFY]
- Method: Interviews + framework analysis.
- Result: Youth agency and independent redress channels matter; opaque monitoring erodes trust.
- Well: Provides the ombudsman justification.
- Gap for us: no proposed technical mechanism; we operationalise the ombudsman role.

*(Bucket F — Dual-control / two-person integrity — see §7 baseline discussion; drawn from classic infosec, e.g. Anderson's Security Engineering §14, NIST SP 800-57 key-management guidance, HIPAA "two-person integrity" pattern in medical audit. These are cited but not core survey slots.)*

*(Bucket G — Ombudsman / independent oversight — HIPAA privacy-officer role; IRB structure per 45 CFR 46. Cited for governance analogue, not core survey.)*

## 5. Gap Analysis Matrix

Rows: the 10 papers above. Columns: the 8 features that define SendWiseCampus.

| Paper | 1. On-device inference | 2. Metadata-only telemetry | 3. Pre-send warning | 4. Cross-modal (IME + browser) | 5. Aggregate-first UI | 6. Dual-control de-anon | 7. Independent ombudsman | 8. Wellbeing/discipline separation |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| P1 Dinakar 2011 | N | N | N | N | N | N | N | N |
| P2 Van Hee 2018 | N | N | N | N | N | N | N | N |
| P3 Emmery 2021 (survey) | — | — | — | — | — | — | — | — |
| P4 Bowler 2015 | N | Partial (design) | Partial (concept) | N | Partial | N | N | Partial (advocated) |
| P5 Chatzakou 2017 | N | N | N | N | N | N | N | N |
| P6 ReThink | Partial (on keyboard) | Partial (self-report only) | **Y** | N (keyboard only) | N | N | N | N |
| P7 Hard/FL 2018 | **Y** | Partial (gradients only) | N | N | N | N | N | N |
| P8 TinyML | **Y** | — | N | N | N | N | N | N |
| P9 CDT 2021 (critique) | — | Advocates | — | — | Advocates | Advocates | Advocates | **Y (advocates strongly)** |
| P10 Livingstone/Marder | — | Advocates | — | — | — | — | Advocates | Advocates |
| **SendWiseCampus (this)** | **Y** | **Y** | **Y** | **Y** | **Y** | **Y** | **Y** | **Y** |

**Column totals (Y count across P1–P10, ignoring —):** 1, 0, 1, 0, 0, 0, 0, 1.

**Interpretation:** No prior system combines all eight properties. ReThink [P6] has the pre-send warning. FL keyboards [P7] have on-device inference. The critique/ethics literature [P9, P10] *advocates* for the governance properties (aggregate-first, dual-control, ombudsman, wellbeing/discipline separation) but does not implement them. SendWiseCampus is the first design proposal that operationalises the advocated governance properties atop an on-device pre-send-warning stack.

## 6. Where Novelty Lies

Explicit novelty claims after the crypto / privacy / audit upgrades (see
`KEY_MANAGEMENT.md`, `PRIVACY_MECHANISMS.md`, `AUDIT_ANCHOR.md`,
`TRANSPARENCY_REPORT.md`):

1. **First cross-modal on-device pre-send warning surface for campus deployment.**
   Chromium MV3 browser extension + Android IME sharing a single detection
   library. Closes the surface gap in [P6] (keyboard only) and [P5] (post-hoc).

2. **Cryptographic dual-control de-anonymisation.** Ed25519 signatures from
   the wellbeing lead **and** an independent student ombudsman, verified
   server-side and appended to a hash-chained audit log. Extends the
   two-person-integrity pattern from HSM / nuclear / NIST SP 800-57 key-custody
   domains (Anderson, *Security Engineering*) into student-support tooling.
   Not proposed for wellbeing telemetry in any prior surveyed paper.

3. **Independent student ombudsman with veto power, plus K-of-N succession
   ceremony for role continuity.** Advocated as principle by [P9] and [P10];
   not previously operationalised as a required signer with veto AND a
   documented key-rotation ceremony that survives graduation.

4. **Three-layer privacy composition on egress and display.** Metadata-only
   schema with defence-in-depth field-rejection **and** client-side local
   differential privacy (RAPPOR-style randomised response; Erlingsson, Pihur
   & Korolova 2014) **and** server-side k-anonymity floor (Sweeney 2002) on
   the aggregate UI. All three layers are DP-safe under Dwork et al. 2006
   post-processing.

5. **Externally verifiable audit anchor.** Daily Merkle root publication over
   the hash-chained audit log to a public channel; third parties can detect
   retroactive tampering without dashboard access. Draws on the Certificate
   Transparency literature (Laurie 2013, RFC 6962) and tamper-evident logging
   (Crosby & Wallach 2009). Complemented by a public monthly transparency
   report (see `TRANSPARENCY_REPORT.md`).

6. **Wellbeing/discipline separation enforced by policy AND technical
   inadmissibility mechanisms.** Retention cron, ombudsman veto over
   drilldown, and public transparency reporting render telemetry inadmissible
   in disciplinary proceedings by construction, not by promise.

*(Reused, not novel: the Random Forest classifier — reused from parent
project SendWise. Honestly disclosed; the ML is a substrate, not a
contribution. Bias in the substrate is separately treated in
`BIAS_EVALUATION.md`.)*

## 7. Baseline Selection

**Primary baseline: [P6] ReThink.**

Why:
- Same intervention modality (pre-send warning).
- Same delivery surface family (mobile keyboard) — closest apples-to-apples.
- Well-known in the cyberbullying-intervention community; reviewers will expect a comparison.
- Its documented weaknesses (personal-device only, no aggregate reporting, no governance) map directly to our contributions.

**Internal ablation baseline: SendWise (the parent project).** Same ML, same detection library, same overlay copy — differences reduce to the campus-specific governance layer + browser surface + dashboard fork. This lets us claim: "For a fixed detection substrate, the governance contribution is measurable independently of ML accuracy." Reviewers appreciate honest ablation framing.

**Optional commercial baseline: Bark or Gaggle** (via published API docs / CDT critique [P9]) — as an ethics contrast, not a technical benchmark.

### Comparison table (goes in §5 of the actual paper)

| Feature | ReThink [P6] | SendWise (parent) | Gaggle / Bark (commercial) | **SendWiseCampus** |
|---|:-:|:-:|:-:|:-:|
| Pre-send warning | Y | Y | N (post-hoc) | Y |
| On-device inference | Y (keyboard) | Y (keyboard) | N (cloud) | Y (keyboard + browser) |
| Cross-modal (IME + browser) | N | N | N | **Y** |
| Metadata-only telemetry | N (self-report only) | Y | N (content sent) | Y |
| Aggregate-first dashboard | N | N (per-child) | N | **Y** |
| Dual-control de-anon | N | N | N | **Y** |
| **Cryptographic dual-signature approvals (Ed25519)** | N | N | N | **Y** |
| Independent ombudsman | N | N | N | **Y** |
| Hash-chained audit | N | N | N (opaque) | **Y** |
| **Local differential privacy on egress** | N | N | N | **Y** |
| **k-anonymity floor on aggregate UI** | N | N | N | **Y** |
| **Externally verifiable audit anchor (daily Merkle root)** | N | N | N | **Y** |
| **Public transparency report** | N | N | N | **Y** |
| Auto-retention purge | N | N | N (indefinite) | **Y** |
| Wellbeing ≠ discipline (by policy + design) | N/A | N/A | N (discipline use documented) | **Y** |
| Deployment scope constraint (college-owned devices only) | N/A | N/A | Mixed | **Y** |
| Independence from parent/authority | N/A | Parent-centric | Authority-centric | Ombudsman-mediated |

## 8. Threat Model

Four adversaries × mitigations. STRIDE-lite summary; **full LINDDUN treatment
lives in `docs/LINDDUN.md`** — reviewers wanting the seven-category analysis,
DFD with trust boundaries, and residual-risk table should read that document.
The paper §5 will cite LINDDUN.md and reproduce the summary table below.

| Adversary | Wants | Threat | SendWiseCampus mitigation |
|---|---|---|---|
| **A1 — College administration seeking discipline data** | Use wellbeing data to sanction a student | Unauthorised repurposing | (i) Terms of Use + Governance charter render data inadmissible; (ii) hash-chained audit records every access; (iii) dual-control gate requires ombudsman signature — refuses on discipline request; (iv) per-student data auto-purges 6 months post-resolution |
| **A2 — Insider on wellbeing team acting alone** | Look up a specific student | Unilateral de-anon | Dual-control: any drill-down requires ombudsman co-approval; ombudsman is independent role by charter; audit log records the request whether approved or denied |
| **A3 — External attacker on dashboard** | Exfiltrate student data | Data breach | (i) Supabase RLS + tightly scoped roles; (ii) content never on server (only metadata); (iii) TLS + short-lived tokens; (iv) drilldown requires session + role + valid approval row |
| **A4 — MDM operator (school IT) or Chrome Web Store compromise** | Push malicious extension update | Supply-chain | (i) Extension source public on GitHub; (ii) reproducible build via CI (`extension-pack` job produces a zip artefact tied to commit hash); (iii) Chrome Enterprise policy pin extension_id + update_url + minimum_version to auditable values |

Not mitigated (limitations to disclose):
- Malicious student device rooted/jailbroken → could disable extension. Out of scope; MDM tampering detection is a separate control layer.
- Statistical re-identification from aggregate data at low N (small campus, rare category). Discussed in §11.

## 9. Planned Evaluation (Future Work section of the paper)

Since we have no pilot, describe a credible evaluation plan:

**9.1 Pre-registered pilot design**
- Population: 60–100 students, one department, single university, opt-in for personal-device arm and force-installed on college-owned arm.
- Duration: 6 weeks (matches PLAN.md timeline). Two arms: (a) extension only, (b) extension + IME.
- IRB path: minimal-risk expedited review under 45 CFR 46.110 [VERIFY local IRB framework], parental notification for under-18, standard consent for over-18.
- Blinding: unblinded (technical constraint).

**9.2 Primary quantitative measures**
- Warning-shown rate per active hour of typing/browsing.
- Edit / Send-Anyway / Cancel ratio (already logged by the extension as `action` metadata).
- False-positive rate: self-reported via optional per-warning feedback ("this warning did not apply").
- Latency P50/P95 of classification (already logged client-side).

**9.3 Secondary qualitative measures**
- Pre/post Student Experience Survey (7-point Likert): felt-surveillance, trust in wellbeing team, perceived fairness.
- Semi-structured interviews with wellbeing-team + ombudsman (n≈6).

**9.4 Ethics review**
- Data-Retention audit at end of pilot.
- No re-identification analysis run without ombudsman sign-off.
- Publication data: aggregate only, min bucket size 10.

**9.5 Success criteria (pre-registered)**
- Deployability: 95%+ successful force-install via MDM.
- Governance efficacy: 0 unilateral de-anon attempts succeed (audit-log inspection).
- Student acceptance: median trust score ≥ 4/7 post-pilot.

**9.6 Benchmarks already collectible without users**
- Cold-start, warm P50 / P95 / P99 latency, RSS memory footprint of the
  content-script analyzer — reproduced by `node scripts/benchmarks/extension-perf.mjs`.
  Reporting protocol and caveats in `docs/BENCHMARKS.md`.

**9.7 Bias probe harness (illustrative, not a benchmark)**
- `scripts/eval/bias-probe.mjs` runs the shipped analyzer over an embedded
  SAE ↔ AAVE pair set and reports per-dialect predicted-toxic rate and
  equalised-odds gap.
- Explicitly **illustrative**: real bias evaluation is deferred to the
  Sap et al. 2019 (ACL) dataset once access is arranged. Rationale, mitigation
  ladder, and reporting protocol in `docs/BIAS_EVALUATION.md`.

## 10. IMRaD Outline

```
1. Introduction (~1.5 pp)
   1.1 Motivation — cyberbullying prevalence, wellbeing-vs-discipline conflict
   1.2 Contributions — 5 novelty claims from §6 above
   1.3 Paper structure

2. Related Work (~2 pp)
   2.1 Cyberbullying detection classifiers (P1, P2, P3)
   2.2 Just-in-time / pre-send interventions (P4, P5, P6)
   2.3 On-device inference & privacy-preserving telemetry (P7, P8)
   2.4 Critiques of school monitoring & governance advocacy (P9, P10)

3. System Design (~3 pp)
   3.1 Architecture overview (Figure 1)
   3.2 Extension: content script → detector → shadow-DOM overlay → bg-worker
   3.3 Android IME (deferred fork of SendWise)
   3.4 Aggregate-first dashboard (Figure 2)
   3.5 Metadata schema and field-rejection (Table 1)

4. Governance Primitives (~2.5 pp) ★ core contribution
   4.1 Wellbeing-team / ombudsman roles
   4.2 Dual-control de-anonymisation flow (Figure 3)
   4.3 Hash-chained audit log
   4.4 Retention cron & semester purge
   4.5 Discipline-separation policy
   4.6 Cryptographic dual-signature protocol (Ed25519, K-of-N roster,
       rotation ceremony) — new subsection, see KEY_MANAGEMENT.md
   4.7 Client-side local differential privacy and server-side k-anonymity —
       new subsection, see PRIVACY_MECHANISMS.md
   4.8 Verifiable audit anchor (daily Merkle root + monthly transparency
       report) — new subsection, see AUDIT_ANCHOR.md, TRANSPARENCY_REPORT.md

5. Threat Model (~1 pp)
   Table from §8; discussion of residual risks

6. Comparative Analysis (~1 pp)
   Comparison table from §7; positioning vs ReThink, SendWise, Bark/Gaggle

7. Implementation & Reproducibility (~1 pp)
   GitHub repo, commit hash pin, CI-produced artefacts, migrations reproducible via docker-compose

8. Discussion & Future Work (~1.5 pp)
   8.1 Planned pilot (§9)
   8.2 Ethical open questions (small-N re-identification, personal-device voluntariness)
   8.3 Cross-jurisdictional applicability

9. Conclusion (~0.5 pp)

References (~1 pp, 15-25 entries)
```

**Figures (7 max):**
1. Architecture diagram (student browser → extension → dashboard → Supabase, with metadata-only egress boundary marked).
2. Dashboard aggregate-first UI mockup.
3. Dual-control approval sequence diagram (drill-down request → wellbeing lead sign → ombudsman sign → approved read).
4. Hash-chained audit-log data structure.
5. Governance comparison bar chart (SendWiseCampus vs baselines across the 8 features from §5).
6. **Ed25519 dual-signature ceremony sequence + K-of-N ombudsman roster** (new; supports §4.6).
7. **LINDDUN DFD with trust boundaries** (new; supports §5 threat model and cross-references `LINDDUN.md`).

## 11. Honest Risks & Reviewer Objections

Top 5 objections + pre-emptive responses:

1. **"No user study / no evaluation."**
   *Response:* Explicitly a design paper. Cite the tradition of design/architecture-only publications in ethics-of-computing venues (this is why we picked AI and Ethics / SN CS). Include the pre-registered evaluation plan (§9) as an evaluable commitment.

2. **"ML component is not novel."**
   *Response:* Yes — honestly disclosed. The paper's contribution is the governance layer and cross-modal deployment surface, not the classifier. Position ML as substrate.

3. **"Small-N campuses allow re-identification even from aggregate data."**
   *Response:* Partly addressed by the shipped **k-anonymity floor (min bucket
   = 10)** on the aggregate UI (see `PRIVACY_MECHANISMS.md`), backed by
   client-side local differential privacy (RAPPOR-style randomised response)
   on egress. Residual small-N risk in the presence of out-of-band roster
   knowledge is disclosed in `LINDDUN.md` §3 (R1) as a Medium residual risk.
   Cite Sweeney 2002 (k-anonymity), Erlingsson et al. 2014 (RAPPOR),
   Dwork et al. 2006 (DP composition).

4. **"How is 'ombudsman' guaranteed to be independent in practice?"**
   *Response:* The paper does not claim to solve organisational politics — it
   provides a **cryptographic veto mechanism** (Ed25519 signature required on
   every drilldown approval; see `KEY_MANAGEMENT.md`). Independence is a
   policy prerequisite; the system enforces the technical consequence.
   K-of-N rotation ceremony handles ombudsman succession without collapse
   of the veto.

5. **"Why not existing solutions (Bark, Gaggle)? They already work."**
   *Response:* Cite [P9] Barrett & Rice on documented misuse. Existing
   solutions violate wellbeing/discipline separation and lack independent
   oversight, cryptographic dual-control, differential privacy, k-anonymity
   floors, and externally verifiable audit anchors. Frame SendWiseCampus as
   governance-first alternative, not an incremental improvement.

6. **"How do we know you haven't retroactively tampered with the audit log?"**
   *Response:* Daily **Merkle-root anchor** published to a public channel
   (`AUDIT_ANCHOR.md`); external auditors verify without dashboard access.
   Draws on Certificate Transparency (Laurie 2013, RFC 6962) and tamper-evident
   logging (Crosby & Wallach 2009). The monthly public transparency report
   (`TRANSPARENCY_REPORT.md`) makes anchor absence itself detectable.

7. **"Your ML has documented dialect bias."**
   *Response:* Acknowledged and disclosed. See `BIAS_EVALUATION.md`. The
   substrate is honestly disclosed as inherited from SendWise, an illustrative
   probe harness is shipped in `scripts/eval/bias-probe.mjs`, and a Sap et al.
   2019 dataset evaluation is committed as follow-up work with a concrete
   mitigation ladder (per-dialect thresholds, reweighting, adversarial
   debiasing, human-in-the-loop review).

Additional risks worth stating up front:
- The Chrome Enterprise policy enforcement can be bypassed on a jailbroken device — same as any MDM tool.
- Aggregate-first UI defeats bad-actor drill-down only if the underlying DB RLS is correctly configured — code review is not a substitute for formal verification.
- Cyberbullying detection ML has documented dialect/AAVE bias [cite Sap et al. 2019, ACL] — acknowledge and cite.

## 12. Immediate Next Actions (2-week checklist)

- [ ] Verify all `[VERIFY]` citations against Scopus / DOI / Google Scholar. Fix any wrong years/venues.
- [ ] Draft §1 (Introduction) and §4 (Governance Primitives) — the two sections that define the contribution.
- [ ] Draw Figure 1 (architecture) and Figure 3 (dual-control sequence) — recommend draw.io / Excalidraw, export to PDF.
- [ ] Complete Related Work §2 by expanding the per-paper 1-line summaries into 3-4 sentence paragraphs.
- [ ] Fill the Comparison Table (§7 here → paper §6) into full text.
- [ ] Send outline + §1/§4 draft to a supervising professor for pre-submission read. A named supervisor as co-author dramatically raises acceptance odds.
- [ ] Pick venue: recommend SN Computer Science first submission (2-4 month decision). Backup: AI and Ethics.
- [ ] Prepare ORCID + institutional affiliation for submission.
- [ ] Run `node scripts/benchmarks/extension-perf.mjs` on the reference
      machine and populate the table in `docs/BENCHMARKS.md` §4.
- [ ] Draft the new IMRaD subsections **§4.6** (Ed25519 dual-signature
      protocol), **§4.7** (LDP + k-anonymity), and **§4.8** (verifiable
      audit anchor) — each cross-referencing the corresponding companion doc.
- [ ] Draw the two new figures — **Figure 6** dual-signature ceremony
      sequence + K-of-N ombudsman roster, and **Figure 7** LINDDUN DFD
      (source in `docs/LINDDUN.md` §1) — in Excalidraw or draw.io, export PDF.
- [ ] Apply for the Sap et al. 2019 dialect-annotated dataset per
      `docs/BIAS_EVALUATION.md` §5 to unblock the real bias evaluation.

## References

*(BibTeX-style, verify before use)*

```bibtex
@inproceedings{dinakar2011cyberbullying,
  author  = {Dinakar, Karthik and Reichart, Roi and Lieberman, Henry},
  title   = {Modeling the detection of textual cyberbullying},
  booktitle = {ICWSM Workshop on Social Mobile Web},
  year    = {2011}
}

@article{vanhee2018cyberbullying,
  author  = {Van Hee, Cynthia and others},
  title   = {Automatic detection of cyberbullying in social media text},
  journal = {PLoS ONE},
  volume  = {13}, number = {10}, pages = {e0203794},
  year    = {2018},
  doi     = {10.1371/journal.pone.0203794}
}

@article{emmery2021limitations,
  author  = {Emmery, Chris and others},
  title   = {Current limitations in cyberbullying detection: on evaluation criteria, reproducibility, and data scarcity},
  journal = {Language Resources and Evaluation},
  volume  = {55}, number = {3}, pages = {597--633},
  year    = {2021}
}

@article{bowler2015cyberbullying,
  author  = {Bowler, Leanne and Knobel, Cory and Mattern, Eleanor},
  title   = {From cyberbullying to well-being: A narrative-based participatory approach},
  journal = {JASIST},
  volume  = {66}, number = {6}, pages = {1274--1293},
  year    = {2015}
}

@inproceedings{chatzakou2017meanbirds,
  author  = {Chatzakou, Despoina and others},
  title   = {Mean Birds: Detecting Aggression and Bullying on Twitter},
  booktitle = {ACM WebSci},
  year    = {2017},
  doi     = {10.1145/3091478.3091487}
}

@misc{prabhu2015rethink,
  author  = {Prabhu, Trisha},
  title   = {ReThink: Pre-send warning intervention system for cyberbullying},
  note    = {Various IEEE/ACM student-conference papers; verify specific citation},
  year    = {2014--2018}
}

@article{hard2018federated,
  author  = {Hard, Andrew and others},
  title   = {Federated Learning for Mobile Keyboard Prediction},
  journal = {arXiv:1811.03604},
  year    = {2018}
}

@article{banbury2020tinyml,
  author  = {Banbury, Colby and others},
  title   = {Benchmarking TinyML Systems: Challenges and Direction},
  journal = {arXiv:2003.04821},
  year    = {2020}
}

@techreport{cdt2021onlineobserved,
  author  = {Barrett, Elizabeth Laird and Rice, Cody},
  title   = {Online and Observed: Student Privacy Implications of School-Issued Devices and Student Activity Monitoring Software},
  institution = {Center for Democracy and Technology},
  year    = {2021},
  url     = {https://cdt.org/insights/report-online-and-observed-student-privacy-implications-of-school-issued-devices-and-student-activity-monitoring-software/}
}

@article{livingstone2018children,
  author  = {Livingstone, Sonia},
  title   = {Children's data and privacy online: growing up in a digital age},
  institution = {LSE Media Policy Project},
  year    = {2018}
}

@article{sweeney2002kanonymity,
  author  = {Sweeney, Latanya},
  title   = {k-anonymity: A Model for Protecting Privacy},
  journal = {International Journal on Uncertainty, Fuzziness and Knowledge-Based Systems},
  volume  = {10}, number = {5}, pages = {557--570},
  year    = {2002}
}

@inproceedings{erlingsson2014rappor,
  author  = {Erlingsson, {\'U}lfar and Pihur, Vasyl and Korolova, Aleksandra},
  title   = {{RAPPOR}: Randomized Aggregatable Privacy-Preserving Ordinal Response},
  booktitle = {ACM CCS},
  year    = {2014}
}

@inproceedings{dwork2006dp,
  author  = {Dwork, Cynthia and McSherry, Frank and Nissim, Kobbi and Smith, Adam},
  title   = {Calibrating Noise to Sensitivity in Private Data Analysis},
  booktitle = {TCC},
  year    = {2006}
}

@article{laurie2013ct,
  author  = {Laurie, Ben},
  title   = {Certificate Transparency},
  journal = {ACM Queue},
  year    = {2013},
  note    = {See also RFC 6962}
}

@inproceedings{crosby2009tamperevident,
  author  = {Crosby, Scott A. and Wallach, Dan S.},
  title   = {Efficient Data Structures for Tamper-Evident Logging},
  booktitle = {USENIX Security},
  year    = {2009}
}

@article{deng2011linddun,
  author  = {Deng, Mina and Wuyts, Kim and Scandariato, Riccardo and Preneel, Bart and Joosen, Wouter},
  title   = {A privacy threat analysis framework: supporting the elicitation and fulfillment of privacy requirements},
  journal = {Requirements Engineering},
  volume  = {16}, number = {1}, pages = {3--32},
  year    = {2011}
}

@inproceedings{wuyts2020linddungo,
  author  = {Wuyts, Kim and Sion, Laurens and Joosen, Wouter},
  title   = {{LINDDUN GO}: A Lightweight Approach to Privacy Threat Modelling},
  booktitle = {IEEE European Symposium on Security and Privacy Workshops (EuroS\&PW)},
  year    = {2020}
}

@inproceedings{sap2019racialbias,
  author  = {Sap, Maarten and Card, Dallas and Gabriel, Saadia and Choi, Yejin and Smith, Noah A.},
  title   = {The Risk of Racial Bias in Hate Speech Detection},
  booktitle = {ACL},
  year    = {2019}
}

@inproceedings{davidson2019racialbias,
  author  = {Davidson, Thomas and Bhattacharya, Debasmita and Weber, Ingmar},
  title   = {Racial Bias in Hate Speech and Abusive Language Detection Datasets},
  booktitle = {ACL Workshop on Abusive Language Online (ALW3)},
  year    = {2019}
}

@techreport{nist80057,
  author  = {{NIST}},
  title   = {SP 800-57 Part 1 Rev. 5 — Recommendation for Key Management},
  institution = {National Institute of Standards and Technology},
  year    = {2020}
}

@book{anderson2020security,
  author    = {Anderson, Ross},
  title     = {Security Engineering: A Guide to Building Dependable Distributed Systems},
  edition   = {3rd},
  publisher = {Wiley},
  year      = {2020},
  note      = {Chapter on two-person integrity / dual control}
}
```

Additional recommended citations (for the actual paper, not core survey):
- Anderson, R. *Security Engineering* (chapter on two-person integrity).
- Sap et al. (2019) *ACL* on racial bias in hate-speech detection (AAVE).
- Sweeney (2002) on k-anonymity.
- NIST SP 800-57 on key-custodian dual control.
- 45 CFR 46 (US Common Rule) for IRB framing.

---

*End of paper plan. Next step: verify DOIs, then draft §1 and §4.*
