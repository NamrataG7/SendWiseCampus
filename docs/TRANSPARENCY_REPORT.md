# Public Ombudsman Transparency Report

## Purpose

The SendWise Campus drill-down flow is dual-controlled: an ombudsman must
co-sign every request that reveals per-student detail. To hold that flow
publicly accountable — and to make dual-control usage visible to the
campus community without leaking anything about the underlying cases —
we publish a **monthly aggregate transparency report** as a static HTML
page.

## Schedule

Monthly. The generator is run at the start of each calendar month and
covers the trailing 12 months on a rolling basis. Automated scheduling
via GitHub Actions is a future addition; for now the report is generated
by a maintainer running the script manually (see below).

## What is published

For each of the last 12 months:

- `requested` — number of drill-down requests submitted
- `approved` / `rejected` / `expired` — outcome counts
- `unique_requesters` — distinct staff members who submitted a request
- `unique_ombudsmen_involved` — distinct ombudsmen who co-signed an
  approval
- `median_time_to_approval_hours` — median wall-clock latency from
  submission to approval, for approved requests

All counts strictly below **K = 5** are suppressed and rendered as
`<5`, matching the k-anonymity floor defined in
[`docs/PRIVACY_MECHANISMS.md`](PRIVACY_MECHANISMS.md).

## What is NOT published

- The raw text of any request or justification.
- The identity of any requester, approver, or subject student.
- Per-student, per-course, or per-cohort breakdowns.
- Time-of-day or day-of-week distributions fine enough to re-identify
  individual events.

## How the report is generated

```bash
cd scripts/transparency-report
npm install
DATABASE_URL='postgres://readonly@host/db' \
  REPO_URL='https://github.com/<org>/SendWiseCampus' \
  node generate.mjs
```

This writes two files into `scripts/transparency-report/out/`:

- `transparency-YYYYMM.html` — the public, self-contained HTML page
  (plain HTML + inline SVG bar chart, no external JS or CSS).
- `transparency-YYYYMM.json` — the same aggregates in machine-readable
  form for downstream consumers.

The HTML page includes an academic disclaimer, a link back to this
repository, the generation timestamp, and the pinned git commit hash so
readers can reproduce the exact artefact from source.

## Sample output

```
| Month   | Requested | Approved | Rejected | Expired | Unique requesters | Unique ombudsmen | Median approval time (h) |
|---------|-----------|----------|----------|---------|-------------------|------------------|--------------------------|
| 2026-08 | 42        | 28       | 9        | 5       | 17                | 6                | 3.7                      |
| 2026-07 | 38        | 22       | 11       | <5      | 15                | 6                | 4.1                      |
| ...     | ...       | ...      | ...      | ...     | ...               | ...              | ...                      |
```

(Illustrative numbers only.)
