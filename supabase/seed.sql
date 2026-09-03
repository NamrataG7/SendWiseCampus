-- Seed data for local development.
-- Two wellbeing-team members: one lead, one ombudsman — the dual-control pair.
--
-- NOTE: auth_user_id is left NULL here because auth.users rows are created by
-- Supabase Auth when the user actually signs in. Wire them up by updating
-- users.auth_user_id = <auth.users.id> after first login (or use the
-- Supabase dashboard to invite the emails below and copy the resulting IDs).

INSERT INTO users (email, role, campus_code)
VALUES
  ('lead@campus.test',      'wellbeing_lead',    'CAMPUS-001'),
  ('ombudsman@campus.test', 'student_ombudsman', 'CAMPUS-001')
ON CONFLICT (email) DO NOTHING;
