# Bias Evaluation Plan — SendWiseCampus

> Companion artefact for `PAPER_PLAN.md` §11 (Honest Risks) and §9 (Planned
> Evaluation). This document exists to address the bias objection *preemptively*
> rather than in reviewer response.

## 1. Purpose

Cyberbullying and hate-speech classifiers have a well-documented pattern of
**mis-flagging African-American Vernacular English (AAVE) as toxic** at higher
rates than semantically equivalent Standard American English (SAE) utterances.
Any campus deployment that ignores this pattern risks disproportionate impact
on Black students — precisely the failure mode CDT documented for
Gaggle/GoGuardian/Bark in the commercial products SendWiseCampus is positioned
against. This document states what we know, what we measure now, and what a
credible follow-up evaluation looks like.

## 2. Known Bias in Cyberbullying / Hate-Speech Classifiers

- **Sap, Card, Gabriel, Choi & Smith (2019). "The Risk of Racial Bias in Hate
  Speech Detection." *ACL 2019*.** Shows that widely-used hate-speech
  classifiers assign substantially higher toxicity probabilities to tweets
  written in AAVE than to tweets in SAE with the same annotated intent. The
  paper releases dialect priors and a dialect-annotated evaluation set.
- **Davidson, Bhattacharya & Weber (2019). "Racial Bias in Hate Speech and
  Abusive Language Detection Datasets." *ACL Workshop on Abusive Language
  Online (ALW3).*** Shows that the training datasets themselves — not just the
  models — carry racial bias in their labels, so a "better classifier" on the
  same data cannot solve the problem.
- **Blodgett, Green & O'Connor (2016). "Demographic Dialectal Variation in
  Social Media." *EMNLP 2016.*** Provides the dialect identification framework
  Sap et al. build on.

SendWiseCampus reuses the SendWise Random Forest detection substrate. That
substrate was not trained on dialect-balanced data, and we do **not** claim it
is bias-free. The paper's ML component is honestly disclosed as a substrate,
not a contribution.

## 3. What The Illustrative Probe Measures

`scripts/eval/bias-probe.mjs` runs the shipped analyzer over an **embedded,
illustrative, hand-written** set of ~40 semantically-equivalent SAE ↔ AAVE
utterance pairs and reports:

- Per-dialect predicted-toxic rate (share of utterances flagged).
- Per-dialect True-Positive Rate (TPR) and False-Positive Rate (FPR) against
  the author's own gold labels.
- **Equalised-odds gap** = max(|TPR_sae − TPR_aave|, |FPR_sae − FPR_aave|).
  A larger gap indicates dialect-conditioned disparate treatment.

**This is a HARNESS, not a validated evaluation.** The embedded pairs are
small, hand-written, and non-representative. Do not cite the harness value as
a benchmark. The harness exists so that:

1. Reviewers can run the pipeline end-to-end and confirm the metric is defined.
2. The engineering is ready to swap in a validated corpus without code churn.
3. The paper's Limitations section has a concrete artefact to point at when
   promising the real evaluation.

## 4. Illustrative Results

Placeholder — run `node scripts/eval/bias-probe.mjs` to populate.

| Dialect | n | Predicted-toxic rate | TPR | FPR |
|---|---:|---:|---:|---:|
| SAE  | — | — | — | — |
| AAVE | — | — | — | — |
| **Equalised-odds gap** | | | | **—** |

Interpretation guidance (for the eventual paper write-up):

- Gap < 0.05: within illustrative-harness noise; do not claim fairness.
- Gap 0.05–0.15: consistent with published dialect disparity direction; report
  as "illustrative signal, real evaluation required."
- Gap > 0.15: strong illustrative signal; the paper must foreground the
  mitigation plan in §5 below.

## 5. Planned Real Evaluation (Future Work)

1. **Dataset access.** Apply for the Sap et al. 2019 dialect-annotated
   evaluation set through the corresponding author / ACL Anthology channels.
   Complement with the Davidson et al. 2017 hate-speech corpus, re-analysed
   under the Davidson et al. 2019 bias framework.
2. **Metrics.** Per-dialect FPR, TPR, calibration; equalised-odds and
   demographic-parity gaps; subgroup calibration under Hardt et al. 2016.
3. **Reporting.** Publish per-category (harassment / hate / threat / sexual)
   dialect gaps, not just aggregate. Aggregate metrics hide the failure mode.
4. **Venue.** A follow-up short paper at an ACL / EMNLP workshop (e.g. ALW,
   WOAH) or as a companion technical report cited from the main SendWiseCampus
   paper.
5. **Pre-registration.** Register the evaluation protocol on OSF before running
   it, so post-hoc metric shopping is impossible.

## 6. Mitigation Options for Future Work

If (when) the real evaluation confirms a dialect disparity, the following
mitigations are on the table, in increasing order of engineering cost:

| # | Mitigation | Cost | Risk |
|---|---|---|---|
| M1 | **Per-dialect threshold calibration** — separate operating points for SAE-classified vs AAVE-classified inputs, chosen to equalise FPR | Low (config only) | Requires reliable dialect classification at inference time; dialect classifier itself is biased |
| M2 | **Reweighting / class-balanced loss** on retraining | Medium | Requires access to training data and retraining pipeline |
| M3 | **Adversarial debiasing** (Zhang, Lemoine & Mitchell 2018) — train the classifier while simultaneously training an adversary that predicts dialect from the representation, and penalising the classifier if the adversary succeeds | High | Instability during training; needs held-out fairness set |
| M4 | **Active human-in-the-loop review** for borderline flags on inputs the dialect prior scores as high-AAVE-likelihood, with the ombudsman as the review authority | Medium (governance already exists) | Adds latency; requires human capacity |
| M5 | **Suppress the warning entirely** for categories where the illustrative gap exceeds a policy threshold, until a bias-corrected model is deployed | Low | Reduces intended utility for real harassment cases |

The paper's position is: **M1 is a cheap immediate lever if the follow-up
study confirms disparity; M4 aligns naturally with the existing ombudsman
role; M2/M3 are proper follow-up research; M5 is the honest safety-first
default while M2/M3 are in flight.**

## 7. Governance Hook

The transparency report (see `TRANSPARENCY_REPORT.md`) will include, once
real evaluation exists, a per-category per-dialect metric block. Until then,
the report includes an explicit "bias evaluation status" line pointing at
this document, so absence of the metric is itself surfaced to the public.

## References

- Sap, M., Card, D., Gabriel, S., Choi, Y. & Smith, N. A. (2019). "The Risk of Racial Bias in Hate Speech Detection." *ACL*.
- Davidson, T., Bhattacharya, D. & Weber, I. (2019). "Racial Bias in Hate Speech and Abusive Language Detection Datasets." *ACL Workshop on Abusive Language Online*.
- Blodgett, S. L., Green, L. & O'Connor, B. (2016). "Demographic Dialectal Variation in Social Media." *EMNLP*.
- Hardt, M., Price, E. & Srebro, N. (2016). "Equality of Opportunity in Supervised Learning." *NeurIPS*.
- Zhang, B. H., Lemoine, B. & Mitchell, M. (2018). "Mitigating Unwanted Biases with Adversarial Learning." *AIES*.
