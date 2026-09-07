-- Cryptographic dual-control on drill_down_requests.
--
-- Extends Lane C's DB-flag co-approval (migration 0005) with Ed25519
-- signatures. Every approval decision that flips a request to 'approved'
-- must carry TWO Ed25519 signatures — one from a wellbeing_lead, one from a
-- student_ombudsman — over a canonicalized payload hash. The actual crypto
-- verification is performed by the Next.js route handler (@noble/ed25519);
-- Postgres only enforces structural invariants (both sig columns present,
-- payload_hash present) because pgcrypto's Ed25519 support is not portable
-- across managed Supabase environments. See docs/KEY_MANAGEMENT.md.

BEGIN;

-- 1. Approver key roster: one row per (user, role) enrollment.
CREATE TABLE IF NOT EXISTS approver_keys (
  user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role           role_name NOT NULL,
  public_key_b64 text NOT NULL,
  key_algo       text NOT NULL DEFAULT 'ed25519',
  added_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_approver_keys_role_active
  ON approver_keys(role)
  WHERE revoked_at IS NULL;

COMMENT ON TABLE approver_keys IS
  'Public-key roster for cryptographic dual-control. Private keys never leave the approver browser (IndexedDB non-exportable).';

-- 2. Extend drill_down_requests with signature columns.
ALTER TABLE drill_down_requests
  ADD COLUMN IF NOT EXISTS payload_hash             bytea,
  ADD COLUMN IF NOT EXISTS lead_signature_b64       text,
  ADD COLUMN IF NOT EXISTS ombudsman_signature_b64  text,
  ADD COLUMN IF NOT EXISTS lead_signed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS ombudsman_signed_at      timestamptz;

COMMENT ON COLUMN drill_down_requests.payload_hash IS
  'SHA-256 of the canonical-JSON request payload. Both signatures cover this hash.';

-- 3. Trigger: when status transitions → 'approved', require BOTH sigs + hash.
CREATE OR REPLACE FUNCTION drill_down_requests_require_signatures()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    IF NEW.payload_hash IS NULL THEN
      RAISE EXCEPTION 'cannot approve drill-down request without payload_hash (crypto dual-control)';
    END IF;
    IF NEW.lead_signature_b64 IS NULL OR NEW.ombudsman_signature_b64 IS NULL THEN
      RAISE EXCEPTION 'cannot approve drill-down request without both Ed25519 signatures (lead + ombudsman)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ddr_require_signatures ON drill_down_requests;
CREATE TRIGGER trg_ddr_require_signatures
  BEFORE UPDATE OF status, lead_signature_b64, ombudsman_signature_b64, payload_hash
  ON drill_down_requests
  FOR EACH ROW EXECUTE FUNCTION drill_down_requests_require_signatures();

COMMENT ON FUNCTION drill_down_requests_require_signatures IS
  'Structural gate: bar approved status without both Ed25519 signatures + payload_hash. Cryptographic verification happens in the app-tier verifier.';

-- 4. Server-side verification stub. See doc comment.
CREATE OR REPLACE FUNCTION p_verify_ddr_signatures(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_row drill_down_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM drill_down_requests WHERE id = request_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  RETURN v_row.lead_signature_b64 IS NOT NULL
     AND v_row.ombudsman_signature_b64 IS NOT NULL
     AND v_row.payload_hash IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION p_verify_ddr_signatures IS
  'STUB: returns TRUE iff both signatures + payload_hash are present. Real Ed25519 verification runs in the Next.js route handler (lib/dual-control/verifier.ts) because pgcrypto lacks portable Ed25519 primitives across Supabase-managed Postgres. The trigger + this function together enforce "no approval without both sigs"; app-tier verifier catches forgery.';

COMMIT;
