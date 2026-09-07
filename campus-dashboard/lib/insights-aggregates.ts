/**
 * Insights aggregates for Fig 3 (Behavioral Insights).
 *
 * Client-safe helpers (no redis/server imports) that convert the server-side
 * InsightsPayload into chart-ready data for components/insights/*.
 * The static sample-data-based getters have been removed: chart cards are
 * now purely presentational and receive their data from the page layer.
 */

import type { InsightsPayload } from './insights-server-types';
import { DEFAULT_K, kFloorFromEnv } from './privacy/k-anonymity';

export interface TrendPoint {
  date: string;
  interventions: number;
}

export interface DonutSlice {
  name: string;
  value: number; // percentage (0-100)
  color: string;
}

export interface InsightsChartData {
  total: number;
  trend: TrendPoint[];
  categoryDistribution: DonutSlice[];
  severityDistribution: DonutSlice[];
  editedVsSent: DonutSlice[];
}

// ---------------------------------------------------------------------------
// Live-data helpers (client-safe: no redis/server imports)
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  harassment: { label: 'Harassment', color: '#7C5CD6' },
  threats: { label: 'Threats', color: '#F59B2A' },
  hate_speech: { label: 'Hate Speech', color: '#2F6BFF' },
  sexual_content: { label: 'Sexual Content', color: '#E5484D' },
  self_harm: { label: 'Self-Harm Risk', color: '#B08CFF' },
};

const SEVERITY_META: Record<string, { label: string; color: string }> = {
  high: { label: 'High', color: '#E5484D' },
  medium: { label: 'Medium', color: '#F59B2A' },
  low: { label: 'Low', color: '#2AAE6B' },
};

function toPercentSlices(
  counts: Record<string, number>,
  meta: Record<string, { label: string; color: string }>,
): DonutSlice[] {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const order = Object.keys(meta);
  if (total === 0) {
    return order.map((k) => ({ name: meta[k].label, value: 0, color: meta[k].color }));
  }
  return order.map((k) => ({
    name: meta[k].label,
    value: Math.round(((counts[k] ?? 0) / total) * 100),
    color: meta[k].color,
  }));
}

function formatDayLabel(iso: string): string {
  // "2025-08-20" -> "20 Aug"
  const d = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Apply a k-anonymity floor to the raw distribution counts inside an
 * `InsightsPayload` *before* converting to percentages. Buckets whose
 * absolute count falls strictly between 0 and k are zeroed out so a
 * wellbeing team viewer cannot infer that "exactly one student in the
 * cohort exhibits self_harm risk" from a non-zero micro-slice.
 *
 * See Sweeney L. (2002) k-Anonymity: A Model for Protecting Privacy.
 * The floor defaults to `DEFAULT_K` (10) and is overridable via
 * `NEXT_PUBLIC_K_ANONYMITY_FLOOR`.
 */
export function applyKAnonymityToPayload(
  payload: InsightsPayload,
  k: number = kFloorFromEnv(),
): InsightsPayload {
  const suppress = (v: number) => (v > 0 && v < k ? 0 : v);

  const categoryDistribution = Object.fromEntries(
    Object.entries(payload.categoryDistribution).map(([kk, v]) => [kk, suppress(v)]),
  ) as InsightsPayload['categoryDistribution'];
  const severityDistribution = Object.fromEntries(
    Object.entries(payload.severityDistribution).map(([kk, v]) => [kk, suppress(v)]),
  ) as InsightsPayload['severityDistribution'];

  return {
    ...payload,
    categoryDistribution,
    severityDistribution,
    editedVsSent: {
      edited: suppress(payload.editedVsSent.edited),
      sent_anyway: suppress(payload.editedVsSent.sent_anyway),
    },
  };
}

export { DEFAULT_K };

/**
 * Convert the server-side InsightsPayload to the chart-ready shape used by
 * the client components in components/insights/*.
 */
export function payloadToChartData(payload: InsightsPayload): InsightsChartData {
  const trend: TrendPoint[] = payload.trend.map((p) => ({
    date: formatDayLabel(p.date),
    interventions: p.count,
  }));

  const categoryDistribution = toPercentSlices(
    payload.categoryDistribution as unknown as Record<string, number>,
    CATEGORY_META,
  );
  const severityDistribution = toPercentSlices(
    payload.severityDistribution as unknown as Record<string, number>,
    SEVERITY_META,
  );

  const editedTotal = payload.editedVsSent.edited + payload.editedVsSent.sent_anyway;
  const editedPct = editedTotal === 0 ? 0 : Math.round((payload.editedVsSent.edited / editedTotal) * 100);
  const sentPct = editedTotal === 0 ? 0 : 100 - editedPct;
  const editedVsSent: DonutSlice[] = [
    { name: 'Edited Before Sending', value: editedPct, color: '#2AAE6B' },
    { name: 'Sent Unchanged', value: sentPct, color: '#2F6BFF' },
  ];

  return {
    total: payload.total,
    trend,
    categoryDistribution,
    severityDistribution,
    editedVsSent,
  };
}

/**
 * Zero-filled chart data for the empty state (parent has no linked children).
 * Preserves the visual layout (labels + colors) so the page never shows a
 * jarring blank grid.
 */
export function emptyInsights(): InsightsChartData {
  const now = new Date();
  const trend: TrendPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    trend.push({
      date: formatDayLabel(d.toISOString().slice(0, 10)),
      interventions: 0,
    });
  }
  return {
    total: 0,
    trend,
    categoryDistribution: Object.keys(CATEGORY_META).map((k) => ({
      name: CATEGORY_META[k].label,
      value: 0,
      color: CATEGORY_META[k].color,
    })),
    severityDistribution: Object.keys(SEVERITY_META).map((k) => ({
      name: SEVERITY_META[k].label,
      value: 0,
      color: SEVERITY_META[k].color,
    })),
    editedVsSent: [
      { name: 'Edited Before Sending', value: 0, color: '#2AAE6B' },
      { name: 'Sent Unchanged', value: 0, color: '#2F6BFF' },
    ],
  };
}
