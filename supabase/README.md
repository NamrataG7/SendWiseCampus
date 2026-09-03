# SendWiseCampus — Supabase

Database migrations, RLS policies, retention automation, and dual-control
approval logic for the campus wellbeing dashboard.

Four of the five migrations were **reused directly from SendWiseForensic** and
adapted to strip warrant / evidence / jurisdiction concepts. The hash-chained
`audit_log` is copied verbatim (only column comments and the actor-role enum
values changed).

---

## Migration files

| File | Purpose |
| --- | --- |
| `migrations/00000000000001_init.sql` | Base schema: `users`, `devices`, `violations`, `drill_down_requests`, enums (`role_name`, `incident_category`, `incident_severity`, `incident_action`, `drill_down_status`, `audit_action`). Mirrors `campus-dashboard/lib/schema.ts`. |
| `migrations/00000000000002_audit_log.sql` | Append-only, hash-chained `audit_log` + `p_append_audit()` sanctioned write path. Reused from Forensic. |
| `migrations/00000000000003_rls_and_query_gates.sql` | RLS for `users`, `violations`, `devices`, `drill_down_requests`. Roles simplified to `wellbeing_lead`, `wellbeing_member`, `student_ombudsman`, `admin`, `SYSTEM`. |
| `migrations/00000000000004_auto_expiry.sql` | `campus_retention_sweep()` + pg_cron schedules. |
| `migrations/00000000000005_scoped_admin_and_coapproval.sql` | Dual-control on drill-down requests + `p_ddr_coapprove()` helper. |

---

## Running migrations locally

### Option A — Supabase CLI (recommended)

```bash
# From the repo root:
cd supabase
supabase db reset   # applies all migrations + seed.sql against local Postgres
```

### Option B — plain psql

```bash
export DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres

for f in supabase/migrations/*.sql; do
  echo "==> $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

psql "$DATABASE_URL" -f supabase/seed.sql
```

### Verifying the hash chain

```sql
SELECT id, action, prev_hash, hash FROM audit_log ORDER BY id;
```
Every row's `prev_hash` must equal the previous row's `hash`. A NULL `prev_hash`
is only valid on row `id = 1`.

---

## Retention policy summary

| Data class | Retention | Enforced by |
| --- | --- | --- |
| Aggregate rollups (campus-level counts) | 1 year | Derived at query time from surviving `violations` rows; no separate table. |
| Per-student `violations` rows | 6 months from `timestamp` | `campus_retention_sweep()` nightly cron (`15 3 * * *`). |
| Semester purge (Jan/Apr/Jul/Oct 1st) | Hard sweep — same 6-month cutoff | `campus_retention_sweep()` quarterly cron (`0 4 1 1,4,7,10 *`). |
| `drill_down_requests` pending past `expires_at` (default +7 days) | Flipped to `rejected` | `campus_retention_sweep()` |
| `audit_log` | Never purged (append-only, tamper-evident) | Triggers reject UPDATE/DELETE unconditionally. |

If `pg_cron` is not available in your Supabase project, wire a Supabase
Scheduled Function to call `public.campus_retention_sweep()` on the same
cadence.

---

## Dual-control (co-approval) flow

Any per-student drill-down (joining a `user_id_hash` to a real student identity
via `drill_down_requests`) requires **two distinct approvers**:
one `wellbeing_lead` **and** one `student_ombudsman`. The requester can never
approve their own request.

```
  +----------------------+
  |  wellbeing_member    |
  |  (requester)         |
  +----------+-----------+
             |
             | POST /api/drill-down-requests
             |   { target_user_id_hash, reason }
             v
  +----------------------+       status = pending
  | drill_down_requests  |       approvals = []
  |  row inserted        |       expires_at = now() + 7d
  +----------+-----------+
             |
   +---------+---------+
   |                   |
   v                   v
+--------------+   +------------------+
| wellbeing_   |   | student_         |
| lead         |   | ombudsman        |
|              |   |                  |
| p_ddr_       |   | p_ddr_           |
| coapprove(   |   | coapprove(       |
|  'approve')  |   |  'approve')      |
+------+-------+   +---------+--------+
       |                     |
       +----------+----------+
                  |
                  v
       +-------------------------+
       | trigger recount:        |
       |  lead >= 1 AND          |
       |  ombuds >= 1            |
       |     -> status=approved  |
       |  any reject             |
       |     -> status=rejected  |
       |  else                   |
       |     -> stay pending     |
       +-----------+-------------+
                   |
                   v
       +-------------------------+
       |  audit_log row appended |
       |  (hash-chained)         |
       +-------------------------+
```

Guardrails enforced regardless of RLS:

* `trg_ddr_validate_coapproval` — rejects self-approval, duplicate approver,
  and any `status='approved'` without both roles.
* `p_ddr_coapprove()` — the only sanctioned write path; also writes the
  matching `DRILL_DOWN_APPROVED` / `DRILL_DOWN_REJECTED` audit row.
* Auto-expiry — a pending request past `expires_at` is flipped to `rejected`
  by `campus_retention_sweep()`.
