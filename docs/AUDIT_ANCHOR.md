# Audit Anchor

## What it is

Every row of `audit_log` in SendWise Campus is part of a hash chain: each
row stores `row_hash = sha256(prev_hash || canonical_json(payload))`. On top
of that chain we publish a **daily Merkle root** — an RFC 6962-style
sha256 tree over the full sequence of `row_hash` values, in `audit_log.id`
order.

The daily anchor is a small JSON manifest plus a bare `MERKLE_ROOT.txt`
containing the hex root. Both are uploaded as a GitHub Actions artefact,
and (optionally) mirrored to a public Gist so external observers can
snapshot them independently.

## Why it matters

A hash chain protects against *silent* insertion or deletion inside the log,
but only if someone remembers what the head looked like. By publishing the
Merkle root each day on an external, append-only channel (GitHub artefacts /
Gist), we hand external auditors a cryptographic commitment they can compare
against the live database at any later point. If a campus IT administrator
or DBA silently rewrites history, the recomputed Merkle root will diverge
from every anchor published after the tampering event.

This is standard **tamper-evident logging** in the Crosby–Wallach 2009
sense, with the RFC 6962 (Laurie 2013) transparency-log construction for
the Merkle tree.

## How the daily cron works

`.github/workflows/audit-anchor.yml` runs at 03:17 UTC every day and on
manual dispatch. It:

1. Checks out the repo.
2. Installs `scripts/audit-anchor/` dependencies (`pg`).
3. Runs `node anchor.mjs` with `DATABASE_URL` from repo secrets.
4. Uploads `scripts/audit-anchor/out/` as a workflow artefact (90-day
   retention).
5. If `ANCHOR_GIST_TOKEN` and `ANCHOR_GIST_ID` secrets are configured, it
   PATCHes the daily `MERKLE_ROOT_YYYY-MM-DD.txt` into a public Gist.
   TODO — this step is a no-op until those secrets are wired.

## How to verify a claim

Anyone with read access to the live database can independently verify an
anchor:

```bash
# 1. Install Node 20.
# 2. Clone this repo.
git clone <repo-url> && cd SendWiseCampus/scripts/audit-anchor
# 3. Install deps.
npm install
# 4. Download an anchor JSON (from GitHub Actions artefacts or the Gist).
# 5. Run the verifier.
DATABASE_URL='postgres://readonly@host/db' \
  node verify.mjs /path/to/anchor-YYYYMMDD.json
```

Expected output: `PASS` and exit code `0`. On any mismatch, the script
prints the anchored vs. recomputed Merkle root and exits `1`.

`verify.mjs` has no dependency on the campus dashboard code — it is a
standalone ~80-line script an external auditor can review end-to-end.

## Threat model

**Mitigates**
- Retroactive tampering (insertion, deletion, or modification of past
  `audit_log` rows) by campus IT, a DBA, or anyone else with write access
  to the database, *after* an anchor has been published covering those
  rows.
- Silent chain resets: the row count and chain-head hash are anchored,
  so truncation is detectable.

**Does not mitigate**
- Real-time tampering within the current 24-hour window before the next
  anchor. We accept a 24 h detection lag as the cost of a simple daily
  cron; a shorter cadence is a straightforward future change.
- Collusion with the party publishing the anchor. Reviewers wanting
  stronger guarantees can mirror the daily Gist into their own append-only
  store (e.g., a signed email archive or an OpenTimestamps commitment).
- Compromise of the sha256 primitive itself.

## References

- Laurie, B. *Certificate Transparency*. RFC 6962, 2013.
  https://www.rfc-editor.org/rfc/rfc6962
- Crosby, S. A. and Wallach, D. S. *Efficient Data Structures for
  Tamper-Evident Logging*. USENIX Security, 2009.
