# Student Ombudsman — Charter

## 1. Purpose

The Student Ombudsman exists to keep SendWiseCampus honest. Without an independent watcher, an on-device cyberbullying nudge platform degrades into student surveillance. The ombudsman is the load-bearing check.

## 2. Role definition

The ombudsman:

- Reviews **every** per-student drill-down request before it is executed.
- Reads the platform's hash-chained audit log at will.
- Publishes a quarterly public report on platform use (see §6).
- Receives student complaints about the platform and investigates them.
- Holds a **veto** on de-anonymisation, retention extensions, and new denylist entries (see §5).
- Re-authorises the platform each academic year; without re-authorisation the platform goes offline.

## 3. Independence

The ombudsman must be independent of:

| Body | Why the separation matters |
|---|---|
| **Wellbeing team** | The wellbeing team benefits from more data. The ombudsman restrains that appetite. |
| **Disciplinary committee** | The disciplinary committee must never see this data; the ombudsman confirms that boundary. |
| **College administration / management** | Prevents managerial pressure to expand scope. |
| **IT department** | IT operates the system; someone outside IT must review it. |
| **SendWiseCampus project maintainers** | The project team cannot mark its own homework. |

Structural safeguards:

- Appointed by the **elected student union**, not by the college.
- Fixed term (typically one academic year), renewable once.
- Cannot be removed by the college mid-term without a student-union super-majority.
- Paid honorarium comes from the student-union budget, not the wellbeing office.
- Has a dedicated read-only Supabase role separate from wellbeing roles.

## 4. Co-approval veto

Any of the following actions requires **wellbeing lead AND ombudsman** to both approve. Either can veto:

1. Per-student drill-down on any dashboard view.
2. Extension of retention beyond the defaults (1 year aggregate / 6 months incident).
3. Addition of a new domain to the campus DNS denylist.
4. Onboarding of a new data source (new host, new signal type, new device class).
5. Any export of data outside the platform.

Vetoes are recorded in the audit log with reason.

## 5. Access rights

- Read-only access to the full Supabase audit log.
- Read-only access to aggregate dashboards.
- Read access to per-student drill-downs **only after** the ombudsman has co-approved them.
- Ability to trigger an emergency **kill switch** that disables telemetry ingestion campus-wide, pending review.

## 6. Quarterly report — obligation

Every quarter the ombudsman publishes a report on the campus portal containing:

- Number of drill-down requests received / approved / vetoed.
- Number of complaints received and their disposition.
- Aggregate platform metrics (events per week, top categories, top hosts).
- Any policy changes made or blocked in the quarter.
- Auditor's note on hash-chain integrity of the audit log.

The report is discussed at an open student-union meeting. Failure to publish for two consecutive quarters automatically pauses the platform.

## 7. Annual re-authorisation

At the end of each academic year the ombudsman, together with the student union, formally re-authorises the platform. Non-authorisation takes the platform offline until concerns are resolved.

## 8. Contact

- Ombudsman inbox: `ombudsman@campus.example.edu` (placeholder)
- Office: Student Union Building Room 12 (placeholder)
- Anonymous form: `https://ombudsman.campus.example.edu/report` (placeholder)
- Escalation to Data Protection Officer: `dpo@campus.example.edu` (placeholder)

## 9. Academic note

This charter is a template developed for an academic project. Real deployments must adapt it to the college's statutes and to Indian law (DPDP Act 2023, UGC guidelines).
