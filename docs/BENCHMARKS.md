# Benchmarks — SendWiseCampus Extension

> Companion artefact for `PAPER_PLAN.md` §7 (Implementation & Reproducibility)
> and §9 (Planned Evaluation). Provides paper §7 Implementation numbers that
> can be collected **without a user pilot**.

## 1. Purpose

The eventual paper needs a §7 Implementation section that reports concrete
performance numbers so reviewers can gauge deployability. This document
defines the benchmarks, the harness, and how to reproduce them. The point is
*not* to claim a favourable comparison — the point is to give reviewers a
falsifiable, reproducible measurement of the classifier's cost when invoked
from the content-script code path.

## 2. Metrics Measured

| Metric | Definition | Why it matters |
|---|---|---|
| **Cold-start latency** (ms) | Wall-clock time for the *first* `analyze()` call after the analyzer module is loaded | Represents the user-perceived delay on the first keystroke event after page load |
| **Warm P50 latency** (ms) | Median wall-clock time per `analyze()` call over the corpus, after two warm-up passes | Represents steady-state per-keystroke overhead |
| **Warm P95 latency** (ms) | 95th-percentile per-call latency in the same run | Represents the tail experienced during normal use |
| **Warm P99 latency** (ms) | 99th-percentile per-call latency | Represents the pathological tail; matters for the "did the extension freeze my page?" reviewer question |
| **RSS memory before / after** (MB) | Node process resident-set size at start and end of run | Bounds the extension's static footprint contribution |
| **Corpus size** | Number of strings classified | Reproducibility bookkeeping |

## 3. How To Reproduce

```
node scripts/benchmarks/extension-perf.mjs
```

Requirements: **Node 20+**. No `npm install` needed — the harness has zero
external dependencies and uses only `node:perf_hooks`, `node:vm`, and
`node:fs`. The analyzer under test is loaded verbatim from
`shared/detection-library/analyzer.js` — the same source the Chromium content
script bundles — inside a Node VM sandbox, so no modification of `shared/` is
required to run the benchmark.

Output lands in `scripts/benchmarks/out/extension-perf-<timestamp>.json`.
Commit that JSON alongside the paper draft when reporting a specific figure.

## 4. Reporting Table (paper §7)

Placeholder — run the script and paste the produced JSON values here.

| Metric | Value | Node | Machine |
|---|---:|---|---|
| Cold-start | — ms | — | — |
| Warm P50 | — ms | — | — |
| Warm P95 | — ms | — | — |
| Warm P99 | — ms | — | — |
| RSS before | — MB | — | — |
| RSS after | — MB | — | — |
| Corpus size | 200 | — | — |

Rule for the paper: report the median of **three independent runs** on a
clean machine; do not cherry-pick the best run.

## 5. Caveats and Limitations

The following limitations are documented up front rather than surfaced by
reviewers.

1. **Synthetic corpus.** The 200-string corpus is embedded in the harness,
   mixes benign / borderline / toxic-ish content, and contains no real
   personal data. It is not sampled from real student communications and
   should not be treated as representative of production input distribution.
2. **Single-machine measurement.** Absolute latencies depend on hardware and
   Node build. Cross-machine comparability is limited; report relative
   figures where possible and always report Node version and OS.
3. **Node ≠ browser.** The harness executes the analyzer under Node's V8
   isolate, not Chromium's renderer. In-browser numbers can differ (Chromium
   turns on additional optimisations and adds shadow-DOM / event-loop cost).
   Browser-vs-Node divergence is **not** measured here and is disclosed as a
   limitation in the paper.
4. **Warm-up policy.** Two throwaway passes precede the measured pass; this
   is documented in the harness source. Reviewers who prefer no warm-up
   should re-run with the warm-up loop removed.
5. **Only the classifier is measured.** End-to-end latency includes DOM
   inspection, shadow-DOM overlay render, and background-worker RPC; those
   are not captured by this harness and belong in the pilot (§9 of the
   paper plan).
6. **No adversarial inputs.** Extreme-length inputs and adversarial Unicode
   are not exercised; the paper's threat model does not currently claim
   latency robustness under those inputs.
7. **RSS is a coarse proxy.** V8 heap fragmentation and GC pause distributions
   are not reported. If reviewers request them, `--expose-gc` and
   `v8.getHeapStatistics()` extensions to the harness are straightforward.

## 6. Cross-References

- `PAPER_PLAN.md` §7 — the paper's Implementation & Reproducibility section
  will cite this document.
- `LINDDUN.md` — the threat model does not currently include denial-of-service
  from adversarial input latency; that is future work.
- `BIAS_EVALUATION.md` — this benchmark measures *cost*, not *fairness*;
  see the bias evaluation document for fairness metrics.
