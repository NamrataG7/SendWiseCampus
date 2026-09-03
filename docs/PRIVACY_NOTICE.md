# Privacy Notice — SendWiseCampus (Student-Facing)

*Plain English. If you only read one section, read section 2.*

## 1. Who is the data controller?

Your college's **wellbeing office** — organisationally separate from the disciplinary committee. Contact the Data Protection Officer at `dpo@campus.example.edu` (placeholder).

## 2. What we collect — and don't

### We collect (metadata only):

| Field | Example | Why |
|---|---|---|
| `category` | `insult`, `threat`, `slur` | To count incident types in aggregate. |
| `severity` | `low` / `med` / `high` | To triage wellbeing resources. |
| `action_taken` | `edit` / `send_anyway` / `cancel` | To measure whether nudges work. |
| `host` | `instagram.com` | To know which platforms to focus on. |
| `timestamp` | `2026-09-15T14:22:00Z` | For time-of-day trends. |
| `anonymous_user_hash` | a random per-browser-profile ID | To count unique users, never mapped to your identity. |
| `session_id` | random UUID | To group events in the same sitting. |

### We do NOT collect:

- The text you typed. (It stays on your device.)
- The URL of the page, only the host.
- Names, email addresses, roll numbers, IP addresses beyond what campus WiFi already sees.
- Screenshots, audio, video, or keystrokes.
- Anything from your personal devices unless you voluntarily installed the extension there.

## 3. Where the analysis happens

On your device. The cyberbullying classifier is a small model shipped inside the browser extension. It runs in your browser and produces a category label. Only that label — plus the metadata above — is sent to the wellbeing team.

## 4. Who can see what

- **Wellbeing team analyst:** aggregate dashboard only (counts per course / hostel / week).
- **Wellbeing lead + student ombudsman together:** can approve per-student drill-down when a documented incident exists. Both must sign the audit log.
- **Disciplinary committee / academic misconduct board:** *no access, ever.* This is written into the terms of use and enforced by database roles.
- **External parties (police, parents, employers):** no access. Data is not disclosed except where Indian law compels it, in which case only the metadata (never content, because we don't have it) can be produced.

## 5. Retention

- Aggregate metadata: 1 academic year.
- Per-student data (only if drill-down was authorised): 6 months from incident closure.
- Automatic deletion enforced by a scheduled job.

## 6. Your rights

- **Review** your data — email the ombudsman.
- **Correct** any wrong metadata — same route.
- **Delete** your records early — same route; granted unless an active incident is under review.
- **Complain** to the ombudsman or the DPO. Complaints are logged.

## 7. Ombudsman path

1. Email `ombudsman@campus.example.edu` (placeholder), or
2. Drop a slip in the Ombudsman Office box, Student Union Building Room 12, or
3. Use the anonymous form: `https://ombudsman.campus.example.edu/report` (placeholder).

The ombudsman is independent of the college administration and the wellbeing team.

## 8. Legal basis

Legitimate interest under DPDP Act 2023 (India), balanced against your rights via the governance controls in `docs/GOVERNANCE.md`. Consent is captured for personal-device installs.

## 9. Contact

- **Data Protection Officer:** `dpo@campus.example.edu` (placeholder)
- **Student Ombudsman:** `ombudsman@campus.example.edu` (placeholder)
- **Project maintainer (academic):** Namrata Gaikwad — `namratamgaikwad@gmail.com`
