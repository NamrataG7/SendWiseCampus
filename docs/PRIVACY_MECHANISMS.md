# Privacy mechanisms in SendWise Campus

This note documents the two mathematically-defensible privacy primitives
that sharpen SendWise Campus beyond a metadata-only design: a
**k-anonymity floor** on the aggregate dashboard, and **local
differential privacy** on the extension egress path. Both are
MDM-configurable and have sane defaults.

---

## 1. k-anonymity floor on the aggregate dashboard

### Formal definition

Sweeney (2002) defines a release to satisfy *k-anonymity* if every record
in the release is indistinguishable from at least `k - 1` other records
with respect to the quasi-identifiers projected onto the release. For an
aggregate dashboard this translates to a cell-level rule: any breakdown
bucket whose count is strictly between 0 and `k` is suppressed.

Formally, let `c(b)` be the count in bucket `b` and let `k` be the floor.
We publish

```
    c'(b) = { c(b)   if c(b) = 0 or c(b) >= k
            { 0      otherwise, and flag b as suppressed
```

Exact zero counts remain visible (there is nothing to re-identify from
a zero); micro-counts `1 <= c(b) < k` are always suppressed.

### Threshold rationale — why `k = 10` for campus scale

Sweeney (2002) and subsequent work argue that `k` in the range
`[5, 15]` is appropriate for medium-cohort re-identification risk when
the quasi-identifier space is low-dimensional. A single-college cohort
of 200–2000 students typically has a handful of active categories at
any given moment; a floor of `k = 10` guarantees that no headline tile
or distribution slice reveals a sub-cohort of fewer than ten students,
which is small enough to correlate with side channels (class rosters,
club membership, incident reports).

### UI behaviour

`campus-dashboard/components/StatsOverview.tsx` renders every headline
tile through the `Tile` component. When a tile is suppressed the numeric
value is replaced by the string

>   insufficient data (k<N) ⓘ

and the ⓘ affordance carries a tooltip citing k-anonymity so viewers
understand why the number is hidden. The chart layer
(`payloadToChartData`) receives k-anonymised counts from
`applyKAnonymityToPayload` before conversion to percentages, so donuts
and trend cards inherit the same guarantee.

### MDM tuning

The floor is read from `NEXT_PUBLIC_K_ANONYMITY_FLOOR` at request time,
falling back to `DEFAULT_K = 10`. A campus deployment can raise the floor
(e.g. `NEXT_PUBLIC_K_ANONYMITY_FLOOR=25` for a very large public
institution) or lower it (e.g. `5` for a small college pilot) without a
code change. Persistence is not touched — this is a rendering guard.

---

## 2. Local differential privacy on extension egress

### Randomised response definition

Warner (1965) introduced randomised response as a survey-design tool:
each respondent flips a private coin and answers truthfully with
probability `1 - p`, otherwise emits a uniform random response. Erlingsson,
Pihur, and Korolova (2014, "RAPPOR") generalised this to a scalable
local-differential-privacy mechanism for browser telemetry.

For a two-outcome mechanism the flip probability

```
    p = 1 / (1 + e^epsilon)
```

gives `epsilon`-local-DP: an adversary observing the emitted category
cannot distinguish, with confidence exceeding `e^epsilon`, whether the
true category was `c` or `c'`.

### `epsilon` meaning

`epsilon` is the *privacy loss* parameter. Smaller `epsilon` = stronger
privacy = more noise = less accurate aggregate. `epsilon = 1.0` is a
widely-used starting point (RAPPOR ships with `epsilon` values between
`ln 3` and `2` for various fields); `epsilon = 0` disables the mechanism.

### Sensitivity

For a single count-based metadata event the *sensitivity* Δf of the
released statistic is 1 — adding or removing one client changes the
category histogram by exactly one unit in one bucket. The Laplace-mechanism
helper `addDPNoise(count, epsilon, sensitivity = 1)` in
`campus-dashboard/lib/privacy/differential-privacy.ts` uses this fact
directly.

### Why category-flip and not additive noise?

The extension emits *individual events*, not aggregate counts. Additive
Laplace noise on a single categorical event is undefined (there is no
"category + 0.7"). Randomised response is the canonical local-DP
mechanism for categorical data: the client perturbs its own label in
isolation, and the wellbeing-team dashboard debiases the aggregate at
read time (Erlingsson et al. 2014, §4). This gives every student a
plausible-deniability guarantee — an observer of the raw ingest stream
cannot conclude which category the student's message actually triggered.

Additive Laplace noise (`addDPNoise`) is retained in the library for
future use on *server-side* aggregates (e.g. exporting a noised
histogram to a paper or public dashboard).

### Defaults and MDM tuning

- Default `epsilon = 1.0` (see `extension/background.js` DEFAULTS).
- User-configurable in `extension/options.html` with range `[0, 10]`.
- `dpEpsilon` is exposed as an MDM key in `extension/managed-schema.json`;
  managed values win over user-sync values, and the options-page field
  is disabled when the value is managed.
- `epsilon <= 0` (or undefined / non-finite) disables the mechanism and
  the payload is emitted verbatim — this preserves backward
  compatibility with pre-DP deployments.

The perturbed payload additionally carries `dp_applied: true` and
`dp_epsilon: <n>` so the ingest route can log the provenance for
audit / paper reproducibility. The Zod schema
(`campus-dashboard/lib/schema.ts`) accepts these fields as optional and
the route strips them before persistence (no jsonb column exists in the
Redis-list store; schema migrations are deliberately out of scope for
this lane).

---

## 3. Composition — k-anon + LDP

k-anonymity and local differential privacy operate at *different layers*
of the pipeline and provide *independent* guarantees:

- LDP protects the individual client: for any single POSTed event, no
  observer of the ingest stream (including a compromised dashboard
  operator) can determine the true category with confidence exceeding
  `e^epsilon`.
- k-anonymity protects the aggregate consumer: even a semi-honest
  wellbeing-team viewer cannot single out a micro-cohort of fewer than
  `k` students from the rendered dashboard.

Dwork, McSherry, Nissim, and Smith (2006) show that DP composes cleanly
under post-processing: any deterministic function applied to a DP output
remains DP. Because our k-anonymity floor is a deterministic
post-processing step applied to already-DP counts, the composed pipeline
retains the `epsilon`-LDP guarantee of the client while additionally
enforcing a `k`-anonymity guarantee on the rendered aggregate.

The two mechanisms are chosen for complementary threat models — one
defends against a curious server, the other against a curious viewer —
rather than to be composed for a joint bound.

---

## 4. What these mechanisms do NOT protect against

Neither mechanism is a substitute for careful system engineering:

- **Small-subgroup composition attacks.** If the same student is
  singled out across many independent breakdowns (e.g. category *and*
  time-of-day *and* host domain), the intersection can drop below the
  k-anonymity floor even when each individual view respects it. Mitigation:
  restrict the number of concurrent filters (already enforced by the
  aggregate-first dashboard layout) and raise `k` for high-dimensional
  releases.
- **Side channels.** Timing of dashboard refreshes, order of drill-down
  requests, and network-level metadata are outside the scope of these
  primitives. Lane C (dual-control drill-down) and Lane E (Ed25519-signed
  audit log) address these separately.
- **Audit-log timing.** The audit trail intentionally records *when* a
  drill-down was approved and by whom. That timing itself is a
  quasi-identifier and is protected only by the dual-control policy,
  not by DP or k-anonymity.
- **A compromised extension.** LDP protects against passive observers
  of the network stream; it does not protect against an attacker who
  controls the extension itself and can bypass the randomised-response
  step before egress. This is a hardware/attestation problem, not a
  cryptographic one.

---

## References

- Dwork, C. (2006). *Differential Privacy.* ICALP 2006.
- Dwork, C., McSherry, F., Nissim, K., & Smith, A. (2006). *Calibrating
  Noise to Sensitivity in Private Data Analysis.* TCC 2006.
- Erlingsson, Ú., Pihur, V., & Korolova, A. (2014). *RAPPOR: Randomized
  Aggregatable Privacy-Preserving Ordinal Response.* ACM CCS 2014.
- Sweeney, L. (2002). *k-anonymity: A Model for Protecting Privacy.*
  International Journal of Uncertainty, Fuzziness and Knowledge-Based
  Systems, 10(5), 557–570.
- Warner, S. L. (1965). *Randomized Response: A Survey Technique for
  Eliminating Evasive Answer Bias.* Journal of the American Statistical
  Association, 60(309), 63–69.
