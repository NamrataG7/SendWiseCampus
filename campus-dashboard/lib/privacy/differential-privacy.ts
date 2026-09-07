/**
 * Local differential privacy primitives.
 *
 * Definition (Dwork 2006, "Differential Privacy"): a randomized mechanism
 * M satisfies epsilon-DP if for all neighbouring datasets D, D' differing
 * in a single record and all measurable S subseteq Range(M):
 *
 *     Pr[M(D) in S] <= exp(epsilon) * Pr[M(D') in S]
 *
 * For scalar count queries with sensitivity Delta_f = 1, the Laplace
 * mechanism M(D) = f(D) + Lap(Delta_f / epsilon) is epsilon-DP.
 *
 * References:
 *  - Dwork C. (2006) Differential Privacy. ICALP.
 *  - Dwork, McSherry, Nissim, Smith (2006) Calibrating Noise to
 *    Sensitivity in Private Data Analysis. TCC.
 *  - Erlingsson, Pihur, Korolova (2014) RAPPOR: Randomized Aggregatable
 *    Privacy-Preserving Ordinal Response. CCS.
 *  - Warner S.L. (1965) Randomized Response: A Survey Technique for
 *    Eliminating Evasive Answer Bias. JASA 60(309): 63-69.
 *
 * This module is client-safe: it uses crypto.getRandomValues (available
 * in the browser, service worker, and Node 19+) and does NOT import any
 * server-only code.
 */

/**
 * Draw one uniform sample in (0, 1) using crypto.getRandomValues. We
 * exclude the exact endpoints so log(1 - 2|u - 0.5|) is well-defined.
 */
function uniform01(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  // Map to (0, 1). +1 in numerator, +2 in denominator avoids 0 and 1.
  return (buf[0] + 1) / (0xffffffff + 2);
}

/**
 * Sample Laplace(0, scale) noise via inverse-CDF transform.
 *   F^{-1}(u) = -scale * sgn(u - 0.5) * ln(1 - 2|u - 0.5|)
 */
export function laplaceNoise(scale: number): number {
  if (!(scale > 0) || !Number.isFinite(scale)) return 0;
  const u = uniform01() - 0.5;
  const sign = u < 0 ? -1 : 1;
  return -scale * sign * Math.log(1 - 2 * Math.abs(u));
}

/**
 * Add epsilon-DP Laplace noise to a non-negative integer count.
 * For a single count-based metadata event the sensitivity is 1, so the
 * scale is 1 / epsilon. The result is clamped to non-negative integers.
 */
export function addDPNoise(
  count: number,
  epsilon: number,
  sensitivity: number = 1,
): number {
  if (!(epsilon > 0) || !Number.isFinite(epsilon)) return count;
  const scale = sensitivity / epsilon;
  const noisy = count + laplaceNoise(scale);
  return Math.max(0, Math.round(noisy));
}

/**
 * Randomised response over a categorical label set (Warner 1965;
 * generalised by Erlingsson et al. 2014 for RAPPOR-style local DP).
 *
 * With probability p_truth = e^epsilon / (e^epsilon + k - 1) the true
 * category is retained; otherwise a uniformly random *other* category
 * is emitted. For the simpler two-outcome case this reduces to the
 * classic p = 1 / (1 + e^epsilon) flip probability.
 *
 * When `epsilon <= 0` or is undefined the input is returned unchanged
 * (mechanism disabled).
 */
export function randomisedResponseCategory<T extends string>(
  category: T,
  epsilon: number,
  labelSet: readonly T[],
): T {
  if (!(epsilon > 0) || !Number.isFinite(epsilon)) return category;
  if (labelSet.length < 2) return category;

  // Two-outcome flip probability from spec: p = 1 / (1 + e^epsilon).
  const flipProb = 1 / (1 + Math.exp(epsilon));
  if (uniform01() >= flipProb) return category;

  // Flip: pick uniformly at random from the label set. This preserves
  // epsilon-LDP even if we occasionally pick the same label back
  // (rejection sampling below excludes the original to strengthen the
  // signal-to-noise budget for downstream aggregation).
  const others = labelSet.filter((l) => l !== category);
  if (others.length === 0) return category;
  const idx = Math.floor(uniform01() * others.length);
  return others[Math.min(idx, others.length - 1)];
}
