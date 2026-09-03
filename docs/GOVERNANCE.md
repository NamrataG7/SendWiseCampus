# Governance — SendWiseCampus

## Design principle

Without governance guardrails this project degrades into student surveillance. These rules are load-bearing, not optional.

## Wellbeing team ≠ disciplinary team

- The extension / IME / WiFi filter emit data ONLY to the wellbeing team.
- The wellbeing team is organisationally separate from the disciplinary committee.
- Data from this platform is **inadmissible** in academic misconduct or disciplinary proceedings by policy. Written into the college terms of use.
- The wellbeing team has no authority to expel, suspend, mark down grades, or refer to police. Only support, referral to counselling, and voluntary conversation.

## Aggregate-first UI

- Default dashboard view is per-course, per-hostel, per-time-window — never per-student.
- Per-student drill-down requires:
  - A documented incident (student reported to wellbeing, another student reported them, or a manual escalation).
  - Two-person authorisation: wellbeing lead + student ombudsman must both approve.
  - Full audit log — see below.

## Student ombudsman

- Independent role (not appointed by the college administration; often the elected student union). Reads the platform's audit log. Reviews every per-student drill-down.
- Publishes a semester summary of platform use for transparency.

## Audit log

- Every read/write on non-aggregate data is logged with actor id + reason + timestamp.
- Hash-chained (reuse SendWiseForensic's `audit_log` migration).
- Read by wellbeing lead, ombudsman, and Data Protection Officer.

## Retention

- Aggregate metadata: 1 academic year, then deleted.
- Per-student data (when drill-down was authorised): 6 months from incident closure, then deleted.
- Cron enforces the deletes; not a "we promise" policy.

## Consent and terms of use

For **managed devices**:
- Login banner: "This device is provided by the college. Use is subject to the acceptable-use policy. On-device analysis for cyberbullying nudges is active. See <link>."
- Written enrolment agreement covers the extended terms.

For **student-owned devices**:
- Extension install page describes exactly what is monitored (nothing leaves the device by default), what leaves the device (opt-in metadata), and how to uninstall.
- No enrolment-conditional consent. Ever.

## What we will not build

- No integration with the college's disciplinary systems (LMS grade adjustment, IT ban lists, hostel eviction).
- No screen recording.
- No keystroke logging in the raw sense — the classifier fires on committed text segments only, and never uploads them.
- No content upload from student-owned devices, ever.
- No permanent retention.
- No sale or research use of individual-student data. Aggregate metrics may be published with ethics-board approval.

## Escalation path (when something bad happens)

1. Warning overlay in-browser / in-keyboard (99% of cases stop here).
2. Repeated same-category warnings within a period → the extension nudges the student to a self-help resource (counselling contact).
3. Aggregate dashboard trend → wellbeing team offers a broader campus intervention (not per-student).
4. External report (student comes forward, or another student reports) → wellbeing lead + ombudsman authorise per-student view. Wellbeing conversation offered.
5. If a serious offence is disclosed (self-harm intent, threats), wellbeing team escalates to campus counsellor or, only if the student agrees or law requires, external services. NEVER through this platform's data flow.

## Ethics review

Before piloting: ethics board approval (or equivalent institutional review). Written policy. Student union consultation. Public FAQ.

## Sunset

Every academic year: platform use is re-authorised by the ombudsman and student union. If not re-authorised, platform goes offline until it is.
