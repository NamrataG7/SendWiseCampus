# Key Management — SendWise Campus

Cryptographic dual-control for drill-down approvals and K-of-N ombudsman
succession. This document is normative for Lane C+ crypto governance.

## 1. Threat model summary

| Threat                                                                   | Mitigated? |
| ------------------------------------------------------------------------ | ---------- |
| DB admin (or leaked service_role key) forges an "approved" row            | Yes        |
| Full DB dump compromise → attacker fabricates approvals                   | Yes        |
| Single rogue approver acts unilaterally                                  | Yes        |
| Ombudsman succession by admin fiat (no peer sign-off)                    | Yes        |
| Rollback of a legitimate approval (audit log tamper)                    | Yes (audit_log append-only, see migration 0002) |
| Approver browser malware exfiltrating the private key                    | **No**     |
| Approver coerced into signing under duress                              | **No**     |
| Key loss (browser wiped, device lost) — recoverable without re-enrollment| **No**     |

See Anderson, *Security Engineering* (3e), §2 for the integrity-vs-confidentiality
framing, and NIST SP 800-57 Part 2 §4.2 on dual control and split knowledge.

## 2. Key generation ceremony (per approver)

1. Wellbeing team member or student ombudsman logs into the campus dashboard.
2. On first approver action, `lib/crypto/keystore-client.ts::ensureApproverKey()`
   runs in the browser:
   - Generates an Ed25519 keypair via `@noble/ed25519` (`randomPrivateKey()` +
     `getPublicKeyAsync()`).
   - Persists `{privateKey, publicKey, role, createdAt}` in IndexedDB
     (database `sendwise-campus-keystore`, store `approver-keys`, key `self`).
   - POSTs `{role, public_key_b64}` to `/api/keys/enroll`. Server writes the
     row into `approver_keys` (see migration 0006).
3. Private key **never** leaves the browser. Server only ever sees the public
   half.

### Storage model & risks

- **Location**: browser IndexedDB, origin-scoped to the campus dashboard host.
- **Exportable?** No — never surfaced through app code except via `sign()`
  inside `keystore-client.ts`.
- **Sync?** No — IndexedDB is not synchronised across devices; a new device
  needs a fresh enrollment.
- **Wipe risk**: clearing browser data or reinstalling the browser destroys
  the key. This is intentional (no server-held escrow) but means an approver
  must re-enroll (a new `approver_keys` row with a fresh `added_at`).

## 3. Roster publication

`GET /api/keys/roster` returns the current active (non-revoked) roster:

```json
{ "roster": [
  { "user_id": "…", "role": "wellbeing_lead",    "public_key_b64": "…", "added_at": "…" },
  { "user_id": "…", "role": "student_ombudsman", "public_key_b64": "…", "added_at": "…" }
]}
```

The endpoint is deliberately public: signature verification is a public
operation, and third-party auditors (regulators, student union, external
DPO) can independently replay verification against the audit log.

## 4. Approval verification protocol

### Client (`components/DrillDownRequestForm.tsx` + approver UI)

1. Requester creates the drill-down request (POST `/api/drill-down-requests`).
2. Approver #1 (wellbeing_lead) opens the pending row, reviews it, and calls
   `keystore-client.signDrillDownRequest(payload)`:
   - Payload = `{request_id, requester_id, target_user_id_hash, reason, created_at}`.
   - Canonical JSON (sorted keys, no whitespace) is SHA-256 hashed →
     `payload_hash`.
   - `sign(payload_hash, privateKey)` → `signature_b64`.
3. Client PATCHes `/api/drill-down-requests/:id/sign` with `{role, signature_b64}`.
4. Approver #2 (student_ombudsman) repeats.

### Server (`app/api/drill-down-requests/[id]/sign/route.ts`)

For each PATCH:

1. Reject if caller is the requester (self-approval).
2. Reject if request status ≠ `pending`.
3. Look up caller's active roster key; role must match declared role.
4. Recompute canonical payload hash server-side.
5. `verify(fromBase64(sig), hash, fromBase64(pubKey))` — reject on failure.
6. Write signature column + `payload_hash` (bytea) + timestamp.
7. Call `p_ddr_coapprove(...)` RPC to append the approvals[] row; the RPC
   also writes an `audit_log` row (`DRILL_DOWN_APPROVED`).
8. Trigger `trg_ddr_require_signatures` enforces that any transition to
   `status='approved'` requires BOTH signatures + hash present.
9. `verifyDrillDownRequest(id)` re-runs full crypto verification post-write
   as defence-in-depth.

The two triggers stack: `trg_ddr_validate_coapproval` (from migration 0005)
enforces the DB-flag rule (two distinct approvers, correct roles, no
self-approval). `trg_ddr_require_signatures` (migration 0006) additionally
demands the signature columns be populated. Neither trigger *verifies* the
signature bytes — that is the route handler's job — but together they mean
even a compromised service_role cannot flip a request to `approved` without
producing signature ciphertext that will later fail public verification.

## 5. Ombudsman succession (K-of-N ceremony)

Rationale: a single wellbeing_lead + a single student_ombudsman gate every
drill-down. If succession of the ombudsman role were unilateral (admin sets
new user), a compromised admin could install a puppet ombudsman and unlock
one half of dual-control. We require K peer/prior ombudsman attestations
before a new key becomes authoritative.

We call this a K-of-N Ed25519 attestation. Semantically it plays the same
role as a Shamir-secret-shared succession — no single party can install a
new ombudsman — but with vastly simpler crypto suitable for academic scope.

Default K = 3.

### Sequence

```
Outgoing / prior          Initiator             Incoming user       DB (Postgres)
ombudsmen (N holders)     (any authed user)      (new candidate)
       |                       |                       |                 |
       |                       |  POST /api/keys/rotate-ombudsman        |
       |                       |    { incoming_user_id, pk_b64,          |
       |                       |      quorum_size=3 }                    |
       |                       |------------------------------------->   |
       |                       |          ceremony_id                    |
       |<-- share ceremony_id + incoming pk -----|                       |
       |                                                                 |
  each prior ombudsman signs incoming_pk with their existing priv key    |
       |                                                                 |
       |  PATCH /api/keys/rotate-ombudsman/:id/attest                    |
       |     { prior_ombudsman_user_id, signature_b64 }                  |
       |---------------------------------------------------------------->|
       |         verify(sig, incoming_pk, prior_pubkey)                  |
       |         → insert into ombudsman_rotation_attestations           |
       |                                                                 |
       |  ... repeat until attestations >= quorum_size ...               |
       |                                                                 |
       |         → upsert approver_keys(incoming_user_id, 'student_ombudsman', pk_b64)
       |         → update ceremonies set completed_at = now()            |
       |         (trigger trg_ombudsman_rotation_quorum guards)          |
```

### Step-by-step

1. Any authenticated user opens a ceremony via
   `POST /api/keys/rotate-ombudsman` with the incoming user's UUID and their
   new (browser-generated) public key.
2. K prior ombudsman key-holders each fetch `incoming_public_key_b64` (raw
   bytes are the "message") and sign it with their existing IndexedDB
   private key. Attester keys may be currently active or previously revoked;
   what matters is that the key existed at some point in `approver_keys`.
3. Each attester PATCHes `/api/keys/rotate-ombudsman/:ceremonyId/attest`.
   The route verifies the Ed25519 signature server-side and rejects invalid
   ones with HTTP 400.
4. When attestation count ≥ `quorum_size`, the route enrolls the incoming
   key into `approver_keys` (role = `student_ombudsman`) and marks the
   ceremony `completed_at`.
5. Trigger `trg_ombudsman_rotation_quorum` (migration 0007) guards the
   completion transition at the DB level.

## 6. Revocation

- Approver-initiated: `POST /api/keys/revoke` sets `revoked_at = now()` on
  the caller's row. Roster GET immediately stops returning the key.
- Verification behaviour: signatures produced *before* revocation remain
  verifiable for audit purposes (the roster still holds the row, only the
  `revoked_at` column changes; historical audit replay uses that timestamp).
- For a rotation attestation, we accept a prior ombudsman's key even if
  currently revoked — succession sign-off is exactly the operation you
  perform *because* you are stepping down.

## 7. What this design does NOT solve

- **Browser malware**: an attacker with code execution in the approver's
  browser can call `sign()` with an arbitrary payload. Mitigation: FIDO2
  hardware keys (future work — noted in paper §Limitations).
- **Coerced signature**: dual-control does not protect against two willing
  colluders or two coerced approvers. Out-of-band whistleblower channel
  needed.
- **Key loss recovery**: no key escrow, no PIN unwrap. Lost key = new
  enrollment (produces new `added_at`; audit trail preserved).

## 8. References

- Ross Anderson, *Security Engineering: A Guide to Building Dependable
  Distributed Systems* (3rd ed.), Ch. 2 "Who is the opponent?" and §2
  integrity discussion.
- NIST SP 800-57 Part 2 Rev. 1, §4.2 (Dual control and split knowledge).
- Bernstein et al., "High-speed high-security signatures" (Ed25519), 2011.
