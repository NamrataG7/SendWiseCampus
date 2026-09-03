-- Dual-control (co-approval) on drill_down_requests.
-- Adapted from SendWiseForensic/supabase/migrations/20260902000200_scoped_admin_and_coapproval.sql.
--
-- Rule: a drill-down request only flips to status='approved' once TWO distinct
-- approvers have signed off — exactly one wellbeing_lead AND exactly one
-- student_ombudsman. The requester may never approve their own request.
--
-- The approvals column stores an ordered jsonb array of decisions:
--   [{"approver_id": <uuid>, "approver_role": "wellbeing_lead", "decision": "approve", "decided_at": "..."}]

BEGIN;

-- Trigger: validate approvals composition and prevent self-approval.
CREATE OR REPLACE FUNCTION drill_down_requests_validate_coapproval()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_lead_count   int := 0;
  v_ombuds_count int := 0;
  v_reject_count int := 0;
  v_approvers    uuid[];
  v_a            jsonb;
BEGIN
  -- No self-approval.
  FOR v_a IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.approvals, '[]'::jsonb)) LOOP
    IF (v_a ->> 'approver_id')::uuid = NEW.requester_id THEN
      RAISE EXCEPTION 'requester cannot co-approve their own drill-down request (dual-control)';
    END IF;

    v_approvers := array_append(v_approvers, (v_a ->> 'approver_id')::uuid);

    IF (v_a ->> 'decision') = 'reject' THEN
      v_reject_count := v_reject_count + 1;
    ELSIF (v_a ->> 'decision') = 'approve' THEN
      IF (v_a ->> 'approver_role') = 'wellbeing_lead' THEN
        v_lead_count := v_lead_count + 1;
      ELSIF (v_a ->> 'approver_role') = 'student_ombudsman' THEN
        v_ombuds_count := v_ombuds_count + 1;
      ELSE
        RAISE EXCEPTION 'approver_role must be wellbeing_lead or student_ombudsman, got %', v_a ->> 'approver_role';
      END IF;
    END IF;
  END LOOP;

  -- Two distinct approvers required.
  IF v_approvers IS NOT NULL
     AND array_length(v_approvers, 1) <> (
       SELECT count(DISTINCT x) FROM unnest(v_approvers) AS x
     ) THEN
    RAISE EXCEPTION 'the same approver appears twice in approvals (dual-control requires two distinct approvers)';
  END IF;

  -- Status transitions.
  IF NEW.status = 'approved' THEN
    IF v_lead_count < 1 OR v_ombuds_count < 1 THEN
      RAISE EXCEPTION 'status=approved requires one wellbeing_lead + one student_ombudsman approval (got lead=%, ombuds=%)',
        v_lead_count, v_ombuds_count;
    END IF;
    IF NEW.decided_at IS NULL THEN
      NEW.decided_at := now();
    END IF;
  ELSIF NEW.status = 'rejected' THEN
    IF NEW.decided_at IS NULL THEN
      NEW.decided_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ddr_validate_coapproval ON drill_down_requests;
CREATE TRIGGER trg_ddr_validate_coapproval
  BEFORE INSERT OR UPDATE OF approvals, status ON drill_down_requests
  FOR EACH ROW EXECUTE FUNCTION drill_down_requests_validate_coapproval();

COMMENT ON FUNCTION drill_down_requests_validate_coapproval IS
  'Dual-control: two distinct approvers (wellbeing_lead + student_ombudsman), requester cannot self-approve. Enforced regardless of RLS.';

-- Sanctioned helper: append a single approval and (optionally) flip status.
CREATE OR REPLACE FUNCTION p_ddr_coapprove(
  p_request_id      uuid,
  p_approver_id     uuid,
  p_approver_role   role_name,
  p_decision        text          -- 'approve' | 'reject'
)
RETURNS drill_down_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row       drill_down_requests%ROWTYPE;
  v_new_appr  jsonb;
  v_lead      int := 0;
  v_ombuds    int := 0;
  v_a         jsonb;
  v_new_status drill_down_status;
BEGIN
  IF p_decision NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'decision must be approve or reject';
  END IF;

  IF p_approver_role NOT IN ('wellbeing_lead','student_ombudsman') THEN
    RAISE EXCEPTION 'only wellbeing_lead or student_ombudsman may co-approve';
  END IF;

  SELECT * INTO v_row FROM drill_down_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'drill_down_request % not found', p_request_id;
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'request % is already %', p_request_id, v_row.status;
  END IF;

  v_new_appr := COALESCE(v_row.approvals, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'approver_id',   p_approver_id,
      'approver_role', p_approver_role::text,
      'decision',      p_decision,
      'decided_at',    to_jsonb(now())
    )
  );

  -- Recount to decide status transition.
  FOR v_a IN SELECT * FROM jsonb_array_elements(v_new_appr) LOOP
    IF (v_a ->> 'decision') = 'approve' THEN
      IF (v_a ->> 'approver_role') = 'wellbeing_lead'    THEN v_lead   := v_lead   + 1; END IF;
      IF (v_a ->> 'approver_role') = 'student_ombudsman' THEN v_ombuds := v_ombuds + 1; END IF;
    END IF;
  END LOOP;

  IF p_decision = 'reject' THEN
    v_new_status := 'rejected';
  ELSIF v_lead >= 1 AND v_ombuds >= 1 THEN
    v_new_status := 'approved';
  ELSE
    v_new_status := 'pending';
  END IF;

  UPDATE drill_down_requests
     SET approvals = v_new_appr,
         status    = v_new_status
   WHERE id = p_request_id;

  PERFORM p_append_audit(
    p_approver_id, p_approver_role,
    CASE p_decision
      WHEN 'approve' THEN 'DRILL_DOWN_APPROVED'::audit_action
      ELSE                'DRILL_DOWN_REJECTED'::audit_action
    END,
    'drill_down_requests', p_request_id::text,
    jsonb_build_object('new_status', v_new_status::text)
  );

  RETURN v_new_status;
END;
$$;

COMMENT ON FUNCTION p_ddr_coapprove IS
  'Sanctioned co-approval path. Appends decision to approvals[], recomputes status (approved only after wellbeing_lead + student_ombudsman both approve), and writes an audit_log row.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION p_ddr_coapprove(uuid, uuid, role_name, text) TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION p_ddr_coapprove(uuid, uuid, role_name, text) TO service_role';
  END IF;
END $$;

COMMIT;
