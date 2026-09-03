-- Row-Level Security policies for violations, devices, drill_down_requests, users.
-- Adapted from SendWiseForensic/supabase/migrations/20260831110906_rls_and_query_gates.sql:
--   * Removed warrant/officer/case/jurisdiction concepts.
--   * Roles collapsed to: wellbeing_lead, wellbeing_member, student_ombudsman,
--     admin (+ SYSTEM for background jobs running under service_role).
--
-- JWT assumptions:
--   auth.jwt() ->> 'role'    : role_name (or falls back to SYSTEM for jobs)
--   auth.uid()               : Supabase auth user id, matched against users.auth_user_id

-- ------------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auth_role() RETURNS role_name
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
           NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           'SYSTEM'
         )::role_name;
$$;

CREATE OR REPLACE FUNCTION auth_user_row_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid() AND revoked_at IS NULL LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION auth_user_campus() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT campus_code FROM users WHERE auth_user_id = auth.uid() AND revoked_at IS NULL LIMIT 1;
$$;

COMMENT ON FUNCTION auth_role         IS 'Extracts role_name from Supabase JWT claim `role`. Defaults to SYSTEM when no claims (background jobs).';
COMMENT ON FUNCTION auth_user_row_id  IS 'Resolves users.id for the current auth.uid().';
COMMENT ON FUNCTION auth_user_campus  IS 'Campus code of the currently authenticated wellbeing-team member.';

-- ------------------------------------------------------------------
-- users
-- ------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY users_system_all ON users
  FOR ALL
  USING (auth_role() = 'SYSTEM')
  WITH CHECK (auth_role() = 'SYSTEM');

-- Members can read their own row.
CREATE POLICY users_self_read ON users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- Wellbeing lead + admin can read teammates in the same campus.
CREATE POLICY users_team_read ON users
  FOR SELECT TO authenticated
  USING (
    auth_role() IN ('wellbeing_lead', 'admin')
    AND campus_code = auth_user_campus()
  );

-- ------------------------------------------------------------------
-- violations
-- ------------------------------------------------------------------
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations FORCE ROW LEVEL SECURITY;

CREATE POLICY violations_system_all ON violations
  FOR ALL
  USING (auth_role() = 'SYSTEM')
  WITH CHECK (auth_role() = 'SYSTEM');

-- Wellbeing team: aggregate/read-only access to violations in their campus.
-- Per-student drill-down (joining user_id_hash to a real student identity)
-- is controlled application-side via drill_down_requests dual-control.
CREATE POLICY violations_wellbeing_read ON violations
  FOR SELECT TO authenticated
  USING (
    auth_role() IN ('wellbeing_lead', 'wellbeing_member')
    AND (campus_code IS NULL OR campus_code = auth_user_campus())
  );

-- Student ombudsman: read across campus, oversight role.
CREATE POLICY violations_ombudsman_read ON violations
  FOR SELECT TO authenticated
  USING (auth_role() = 'student_ombudsman');

-- Writes: only SYSTEM (ingest API via service_role) inserts violations.
-- No INSERT policy for authenticated → all authenticated INSERTs blocked.

-- ------------------------------------------------------------------
-- devices
-- ------------------------------------------------------------------
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;

CREATE POLICY devices_system_all ON devices
  FOR ALL
  USING (auth_role() = 'SYSTEM')
  WITH CHECK (auth_role() = 'SYSTEM');

CREATE POLICY devices_wellbeing_read ON devices
  FOR SELECT TO authenticated
  USING (
    auth_role() IN ('wellbeing_lead', 'wellbeing_member', 'student_ombudsman', 'admin')
    AND campus_code = auth_user_campus()
  );

-- ------------------------------------------------------------------
-- drill_down_requests
-- ------------------------------------------------------------------
ALTER TABLE drill_down_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE drill_down_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY ddr_system_all ON drill_down_requests
  FOR ALL
  USING (auth_role() = 'SYSTEM')
  WITH CHECK (auth_role() = 'SYSTEM');

-- Requester can read their own requests.
CREATE POLICY ddr_requester_read ON drill_down_requests
  FOR SELECT TO authenticated
  USING (requester_id = auth_user_row_id());

-- Any wellbeing_member/lead can create a request (they become requester_id).
CREATE POLICY ddr_requester_insert ON drill_down_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth_role() IN ('wellbeing_lead', 'wellbeing_member')
    AND requester_id = auth_user_row_id()
  );

-- Approvers (wellbeing_lead + student_ombudsman) can read all pending requests.
CREATE POLICY ddr_approver_read ON drill_down_requests
  FOR SELECT TO authenticated
  USING (auth_role() IN ('wellbeing_lead', 'student_ombudsman'));

-- Approvers update the approvals jsonb / status. Actual dual-control validation
-- is enforced by trigger in migration 0000000000005.
CREATE POLICY ddr_approver_update ON drill_down_requests
  FOR UPDATE TO authenticated
  USING (auth_role() IN ('wellbeing_lead', 'student_ombudsman'))
  WITH CHECK (auth_role() IN ('wellbeing_lead', 'student_ombudsman'));
