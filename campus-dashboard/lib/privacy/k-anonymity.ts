/**
 * k-anonymity floor for aggregate dashboard tiles.
 *
 * Formal definition (Sweeney 2002, "k-Anonymity: A Model for Protecting
 * Privacy"): a release of data is said to have the k-anonymity property if
 * the information for each person contained in the release cannot be
 * distinguished from at least k-1 other individuals whose information also
 * appears in the release.
 *
 * For an aggregate dashboard, we enforce this at the *cell* level:
 * any breakdown bucket (category, severity, etc.) whose count falls below
 * `k` is suppressed to zero and flagged `suppressed: true`, so a wellbeing
 * team member cannot infer that "exactly one student in the cohort is
 * flagged for self_harm" and then correlate with other side channels.
 *
 * This is a rendering guard only — the underlying persistence is untouched.
 *
 * References:
 *  - Sweeney L. (2002) k-anonymity: A Model for Protecting Privacy.
 *    Int. J. Uncertain. Fuzziness Knowl.-Based Syst. 10(5): 557-570.
 */

import type { DashboardStats } from '@/lib/types';

export const DEFAULT_K = 10;

export interface Suppressible {
  count: number;
  suppressed?: boolean;
}

/**
 * Suppress any row whose count is below `k`. Suppressed rows have their
 * `count` overwritten to 0 and are flagged `suppressed: true` so the UI
 * layer can render an "insufficient data (k<N)" placeholder.
 */
export function applyKAnonymity<T extends Suppressible>(
  rows: T[],
  k: number = DEFAULT_K,
): T[] {
  return rows.map((row) => {
    if (row.count < k) {
      return { ...row, count: 0, suppressed: true };
    }
    return { ...row, suppressed: false };
  });
}

/**
 * Distribution-flavoured DashboardStats returned by insights aggregations.
 * We can't change the persisted DashboardStats shape without ripple, so
 * `applyKAnonymityToTiles` returns an *extended* shape that carries
 * per-field suppression flags.
 */
export interface KAnonymizedStats extends DashboardStats {
  suppressed?: {
    totalIncidents?: boolean;
    criticalIncidents?: boolean;
    highPriorityIncidents?: boolean;
    messagesPrevented?: boolean;
  };
  kFloor: number;
}

function suppressField(v: number, k: number): { value: number; suppressed: boolean } {
  if (v > 0 && v < k) return { value: 0, suppressed: true };
  return { value: v, suppressed: false };
}

/**
 * Walk the DashboardStats headline tiles and suppress low-N cells.
 * A field is suppressed if `0 < count < k`. Exact-zero counts remain
 * visible (there is nothing to re-identify from a zero).
 */
export function applyKAnonymityToTiles(
  stats: DashboardStats,
  k: number = DEFAULT_K,
): KAnonymizedStats {
  const total = suppressField(stats.totalIncidents, k);
  const critical = suppressField(stats.criticalIncidents, k);
  const high = suppressField(stats.highPriorityIncidents, k);
  const prevented = suppressField(stats.messagesPrevented, k);

  return {
    totalIncidents: total.value,
    criticalIncidents: critical.value,
    highPriorityIncidents: high.value,
    messagesPrevented: prevented.value,
    lastIncidentTime: stats.lastIncidentTime,
    suppressed: {
      totalIncidents: total.suppressed,
      criticalIncidents: critical.suppressed,
      highPriorityIncidents: high.suppressed,
      messagesPrevented: prevented.suppressed,
    },
    kFloor: k,
  };
}

/**
 * Read the k-anonymity floor from the environment, falling back to the
 * campus-scale default of 10 (Sweeney 2002 argues k in [5, 15] is
 * appropriate for medium-cohort re-identification risk).
 */
export function kFloorFromEnv(): number {
  const raw = process.env.NEXT_PUBLIC_K_ANONYMITY_FLOOR;
  if (!raw) return DEFAULT_K;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_K;
  return n;
}
