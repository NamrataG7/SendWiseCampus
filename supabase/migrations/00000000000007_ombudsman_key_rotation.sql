-- Ombudsman key-rotation ceremony (K-of-N attestation).
--
-- When a new student_ombudsman is being enrolled to replace an outgoing one,
-- a rotation ceremony is opened. K prior/peer ombudsman key-holders each
-- Ed25519-sign the incoming user's new public key. Once quorum is reached
-- AND all attestations verify (app-tier), the ceremony completes and the
-- incoming public key is written into approver_keys.
--
-- This is the K-of-N Ed25519 attestation simplification of a Shamir secret-
-- sharing succession ceremony — same threat model (no single admin can
-- install a rogue ombudsman) with far simpler crypto for academic scope.
-- See docs/KEY_MANAGEMENT.md.

BEGIN;

CREATE TABLE IF NOT EXISTS ombudsman_rotation_ceremonies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_user_id  uuid NOT NULL REFERENCES users(id),
  incoming_public_key_b64 text NOT NULL,
  initiated_by      uuid NOT NULL REFERENCES users(id),
  initiated_at      timestamptz NOT NULL DEFAULT now(),
  quorum_size       int NOT NULL DEFAULT 3 CHECK (quorum_size >= 1),
  completed_at      timestamptz
);

COMMENT ON TABLE ombudsman_rotation_ceremonies IS
  'K-of-N Ed25519 attestation ceremony for installing a new student_ombudsman.';

CREATE TABLE IF NOT EXISTS ombudsman_rotation_attestations (
  ceremony_id              uuid NOT NULL REFERENCES ombudsman_rotation_ceremonies(id) ON DELETE CASCADE,
  prior_ombudsman_user_id  uuid NOT NULL REFERENCES users(id),
  signature_b64            text NOT NULL,
  signed_at                timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ceremony_id, prior_ombudsman_user_id)
);

COMMENT ON TABLE ombudsman_rotation_attestations IS
  'Each row = one prior ombudsman signing off on the incoming user public key.';

-- Trigger: ceremony can only be marked completed when attestations >= quorum.
CREATE OR REPLACE FUNCTION ombudsman_rotation_require_quorum()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL) THEN
    SELECT count(*) INTO v_count
      FROM ombudsman_rotation_attestations
     WHERE ceremony_id = NEW.id;
    IF v_count < NEW.quorum_size THEN
      RAISE EXCEPTION 'ombudsman rotation ceremony % lacks quorum: % of % attestations',
        NEW.id, v_count, NEW.quorum_size;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ombudsman_rotation_quorum ON ombudsman_rotation_ceremonies;
CREATE TRIGGER trg_ombudsman_rotation_quorum
  BEFORE UPDATE OF completed_at ON ombudsman_rotation_ceremonies
  FOR EACH ROW EXECUTE FUNCTION ombudsman_rotation_require_quorum();

COMMENT ON FUNCTION ombudsman_rotation_require_quorum IS
  'Structural gate: completion requires >= quorum_size attestation rows. App-tier verifier confirms each signature is a valid Ed25519 signature by a prior ombudsman key.';

-- Server-side verification stub.
CREATE OR REPLACE FUNCTION p_verify_ombudsman_rotation(ceremony_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_ceremony ombudsman_rotation_ceremonies%ROWTYPE;
  v_count int;
BEGIN
  SELECT * INTO v_ceremony FROM ombudsman_rotation_ceremonies WHERE id = ceremony_id;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT count(*) INTO v_count
    FROM ombudsman_rotation_attestations
   WHERE ombudsman_rotation_attestations.ceremony_id = ceremony_id;
  RETURN v_count >= v_ceremony.quorum_size;
END;
$$;

COMMENT ON FUNCTION p_verify_ombudsman_rotation IS
  'STUB: returns TRUE iff attestation count meets quorum. Real Ed25519 verification of each attestation runs in the Next.js route handler; DB enforces quorum count only.';

COMMIT;
