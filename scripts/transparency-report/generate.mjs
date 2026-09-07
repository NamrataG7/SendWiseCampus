// generate.mjs
//
// Monthly public transparency report for SendWise Campus dual-control
// drill-down usage. Emits a self-contained accessible HTML page + a JSON
// sibling for machine consumption.
//
// Env:
//   DATABASE_URL      Postgres connection string (required)
//   REPO_URL          Public repo URL (optional; shown in the disclaimer)
//   GIT_COMMIT        Git commit SHA pinning the report (optional; auto-detected)
//
// Privacy: applies a k-anonymity floor of K=5 consistent with
// docs/PRIVACY_MECHANISMS.md — any aggregate strictly less than 5 is
// suppressed and rendered as "<5".
//
// See docs/TRANSPARENCY_REPORT.md.

import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const K_ANON = 5;

function suppress(n) {
  if (n === null || n === undefined) return null;
  return n < K_ANON ? `<${K_ANON}` : n;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function detectGitCommit() {
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT;
  try {
    return execSync('git rev-parse HEAD', { cwd: __dirname }).toString().trim();
  } catch {
    return 'unknown';
  }
}

async function fetchMonthlyStats(client) {
  // 12 rolling months ending at the current month.
  const sql = `
    WITH months AS (
      SELECT date_trunc('month', (now() AT TIME ZONE 'UTC') - (n || ' months')::interval) AS month_start
      FROM generate_series(0, 11) AS n
    ),
    agg AS (
      SELECT
        date_trunc('month', created_at AT TIME ZONE 'UTC') AS month_start,
        COUNT(*)                                            AS requested,
        COUNT(*) FILTER (WHERE status = 'approved')         AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')         AS rejected,
        COUNT(*) FILTER (WHERE status = 'expired')          AS expired,
        COUNT(DISTINCT requester_id)                        AS unique_requesters,
        COUNT(DISTINCT approver_id) FILTER (
          WHERE status = 'approved' AND approver_id IS NOT NULL
        )                                                   AS unique_ombudsmen_involved,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (approved_at - created_at)) / 3600.0
        ) FILTER (WHERE status = 'approved' AND approved_at IS NOT NULL)
                                                            AS median_time_to_approval_hours
      FROM drill_down_requests
      WHERE created_at >= date_trunc('month', (now() AT TIME ZONE 'UTC') - INTERVAL '11 months')
      GROUP BY 1
    )
    SELECT
      to_char(m.month_start, 'YYYY-MM')                    AS month,
      COALESCE(a.requested, 0)                             AS requested,
      COALESCE(a.approved, 0)                              AS approved,
      COALESCE(a.rejected, 0)                              AS rejected,
      COALESCE(a.expired, 0)                               AS expired,
      COALESCE(a.unique_requesters, 0)                     AS unique_requesters,
      COALESCE(a.unique_ombudsmen_involved, 0)             AS unique_ombudsmen_involved,
      a.median_time_to_approval_hours                      AS median_time_to_approval_hours
    FROM months m
    LEFT JOIN agg a USING (month_start)
    ORDER BY m.month_start ASC;
  `;
  const res = await client.query(sql);
  return res.rows;
}

function renderSvgBarChart(rows) {
  const width = 720;
  const height = 240;
  const pad = { top: 16, right: 16, bottom: 40, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const n = rows.length || 1;
  const bw = plotW / n;
  const maxVal = Math.max(1, ...rows.map((r) => Number(r.requested) || 0));

  const bars = rows
    .map((r, i) => {
      const raw = Number(r.requested) || 0;
      const h = (raw / maxVal) * plotH;
      const x = pad.left + i * bw + bw * 0.15;
      const y = pad.top + (plotH - h);
      const w = bw * 0.7;
      const label = suppress(raw);
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(
        2
      )}" height="${h.toFixed(2)}" fill="#2b5aa0"><title>${escapeHtml(
        r.month
      )}: ${escapeHtml(String(label))} requested</title></rect>`;
    })
    .join('');

  const xLabels = rows
    .map((r, i) => {
      const x = pad.left + i * bw + bw / 2;
      const y = height - pad.bottom + 14;
      return `<text x="${x.toFixed(2)}" y="${y}" font-size="10" text-anchor="middle" fill="#333">${escapeHtml(
        r.month.slice(2)
      )}</text>`;
    })
    .join('');

  const yTicks = [0, 0.5, 1]
    .map((f) => {
      const val = Math.round(maxVal * f);
      const y = pad.top + plotH - f * plotH;
      return `<g><line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="#eee"/><text x="${
        pad.left - 4
      }" y="${y + 3}" font-size="10" text-anchor="end" fill="#555">${val}</text></g>`;
    })
    .join('');

  return `<svg role="img" aria-label="Monthly drill-down requests bar chart" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <title>Monthly drill-down requests</title>
    ${yTicks}
    ${bars}
    ${xLabels}
  </svg>`;
}

function renderHtml({ rows, generatedAt, repoUrl, gitCommit, stamp }) {
  const tbody = rows
    .map((r) => {
      const med =
        r.median_time_to_approval_hours === null || r.median_time_to_approval_hours === undefined
          ? '—'
          : Number(r.median_time_to_approval_hours).toFixed(1);
      return `<tr>
        <th scope="row">${escapeHtml(r.month)}</th>
        <td>${escapeHtml(String(suppress(Number(r.requested))))}</td>
        <td>${escapeHtml(String(suppress(Number(r.approved))))}</td>
        <td>${escapeHtml(String(suppress(Number(r.rejected))))}</td>
        <td>${escapeHtml(String(suppress(Number(r.expired))))}</td>
        <td>${escapeHtml(String(suppress(Number(r.unique_requesters))))}</td>
        <td>${escapeHtml(String(suppress(Number(r.unique_ombudsmen_involved))))}</td>
        <td>${escapeHtml(med)}</td>
      </tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>SendWise Campus — Transparency Report ${escapeHtml(stamp)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; color: #222; line-height: 1.5; }
  h1 { margin-bottom: 0.25rem; }
  .sub { color: #555; margin-top: 0; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; font-size: 0.95rem; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: right; }
  th[scope="row"] { text-align: left; background: #f6f6f6; }
  thead th { background: #eef; text-align: center; }
  caption { text-align: left; font-weight: 600; margin-bottom: 0.5rem; }
  .disclaimer { margin-top: 2rem; padding: 1rem; background: #fafafa; border-left: 4px solid #2b5aa0; font-size: 0.9rem; }
  code { background: #f2f2f2; padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
<h1>Ombudsman Transparency Report</h1>
<p class="sub">Aggregate dual-control drill-down activity, last 12 months. Generated ${escapeHtml(
    generatedAt
  )}.</p>

<h2>Monthly requests (chart)</h2>
${renderSvgBarChart(rows)}

<h2>Monthly aggregates</h2>
<table>
  <caption>Counts &lt; ${K_ANON} are suppressed as "&lt;${K_ANON}" per the k-anonymity floor.</caption>
  <thead>
    <tr>
      <th scope="col">Month</th>
      <th scope="col">Requested</th>
      <th scope="col">Approved</th>
      <th scope="col">Rejected</th>
      <th scope="col">Expired</th>
      <th scope="col">Unique requesters</th>
      <th scope="col">Unique ombudsmen</th>
      <th scope="col">Median approval time (h)</th>
    </tr>
  </thead>
  <tbody>
${tbody}
  </tbody>
</table>

<section class="disclaimer">
<p><strong>Academic disclaimer.</strong> This report is generated from a research prototype
(SendWise Campus). Aggregate counts strictly below K=${K_ANON} are suppressed in accordance with
the project's privacy model — see <code>docs/PRIVACY_MECHANISMS.md</code>. Raw request text,
requester identity, and target-student identity are never published.</p>
<p>Repository: ${
    repoUrl
      ? `<a href="${escapeHtml(repoUrl)}">${escapeHtml(repoUrl)}</a>`
      : '<em>(REPO_URL not set)</em>'
  }<br/>
Pinned git commit: <code>${escapeHtml(gitCommit)}</code><br/>
Generated at: <code>${escapeHtml(generatedAt)}</code></p>
</section>
</body>
</html>
`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is required.');
    process.exit(2);
  }
  const repoUrl = process.env.REPO_URL || '';
  const gitCommit = detectGitCommit();

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  let rows;
  try {
    rows = await fetchMonthlyStats(client);
  } finally {
    await client.end();
  }

  const now = new Date();
  const stamp =
    now.getUTCFullYear().toString() + String(now.getUTCMonth() + 1).padStart(2, '0');
  const generatedAt = now.toISOString();

  const outDir = join(__dirname, 'out');
  await mkdir(outDir, { recursive: true });

  const jsonPayload = {
    generated_at: generatedAt,
    git_commit: gitCommit,
    k_anonymity_floor: K_ANON,
    months: rows.map((r) => ({
      month: r.month,
      requested: suppress(Number(r.requested)),
      approved: suppress(Number(r.approved)),
      rejected: suppress(Number(r.rejected)),
      expired: suppress(Number(r.expired)),
      unique_requesters: suppress(Number(r.unique_requesters)),
      unique_ombudsmen_involved: suppress(Number(r.unique_ombudsmen_involved)),
      median_time_to_approval_hours:
        r.median_time_to_approval_hours === null
          ? null
          : Number(Number(r.median_time_to_approval_hours).toFixed(2))
    }))
  };

  const htmlPath = join(outDir, `transparency-${stamp}.html`);
  const jsonPath = join(outDir, `transparency-${stamp}.json`);
  await writeFile(
    htmlPath,
    renderHtml({ rows, generatedAt, repoUrl, gitCommit, stamp }),
    'utf8'
  );
  await writeFile(jsonPath, JSON.stringify(jsonPayload, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${htmlPath}`);
  console.log(`Wrote ${jsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
