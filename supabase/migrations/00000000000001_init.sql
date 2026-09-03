-- SendWiseCampus — base schema.
-- Mirrors campus-dashboard/lib/schema.ts (ViolationIngestSchema) and the
-- Lane B drill-down request flow in app/api/drill-down-requests/route.ts.
--
-- Privacy rule: violations NEVER store message content. Only structured
-- categorical metadata about the incident is persisted.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Dedicated schema for crypto helpers used by the audit log (aligns with the
-- reused SendWiseForensic audit_log migration which calls extensions.digest()).
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------------
-- ENUMs
-- ------------------------------------------------------------------

-- Wellbeing-team roles. Mirrors the RLS and co-approval migrations that
-- follow (wellbeing_lead + student_ombudsman are the dual-control pair).
CREATE TYPE role_name AS ENUM (
  'wellbeing_lead',
  'wellbeing_member',
  'student_ombudsman',
  'admin',
  'SYSTEM'
);

-- Mirrors IncidentCategoryEnum in campus-dashboard/lib/schema.ts.
CREATE TYPE incident_category AS ENUM (
  'harassment',
  'threats',
  'hate_speech',
  'sexual_content',
  'self_harm'
);

CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high');

CREATE TYPE incident_action AS ENUM (
  'edited',
  'sent_anyway',
  'blocked',
  'cancelled'
);

CREATE TYPE drill_down_status AS ENUM ('pending', 'approved', 'rejected');

-- Audit actions used by the hash-chained audit_log (migration 0000000000002).
-- Extend as new event types are added; never rename existing values.
CREATE TYPE audit_action AS ENUM (
  'LOGIN',
  'LOGOUT',
  'VIOLATION_INGEST',
  'VIOLATION_READ',
  'DEVICE_PAIR',
  'DEVICE_UNPAIR',
  'DRILL_DOWN_REQUESTED',
  'DRILL_DOWN_APPROVED',
  'DRILL_DOWN_REJECTED',
  'DRILL_DOWN_AUTO_EXPIRE',
  'ROLE_GRANT',
  'ROLE_REVOKE',
  'RETENTION_PURGE'
);

-- ------------------------------------------------------------------
-- users — wellbeing-team members
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id  uuid UNIQUE,       -- Supabase auth.users.id
  email         text UNIQUE NOT NULL,
  role          role_name NOT NULL,
  campus_code   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz
);

CREATE INDEX IF NOT EXISTS users_role_idx        ON users(role);
CREATE INDEX IF NOT EXISTS users_campus_code_idx ON users(campus_code);

-- ------------------------------------------------------------------
-- devices — student device pairing (hashed identifiers only)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id_hash  text NOT NULL CHECK (user_id_hash ~ '^[a-f0-9]{64}$'),
  campus_code   text NOT NULL,
  paired_at     timestamptz NOT NULL DEFAULT now(),
  unpaired_at   timestamptz,
  device_label  text
);

CREATE INDEX IF NOT EXISTS devices_user_hash_idx   ON devices(user_id_hash);
CREATE INDEX IF NOT EXISTS devices_campus_code_idx ON devices(campus_code);

-- ------------------------------------------------------------------
-- violations — structured incident metadata (no message content, EVER)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS violations (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id_hash  text NOT NULL CHECK (user_id_hash ~ '^[a-f0-9]{64}$'),
  session_id    text NOT NULL,
  category      incident_category NOT NULL,
  severity      incident_severity NOT NULL,
  action        incident_action   NOT NULL,
  timestamp     timestamptz NOT NULL,
  campus_code   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS violations_user_hash_idx   ON violations(user_id_hash);
CREATE INDEX IF NOT EXISTS violations_timestamp_idx   ON violations(timestamp DESC);
CREATE INDEX IF NOT EXISTS violations_campus_code_idx ON violations(campus_code);
CREATE INDEX IF NOT EXISTS violations_category_idx    ON violations(category);

COMMENT ON TABLE violations IS
  'Structured violation metadata only. Message content MUST NEVER be stored — enforced by API-layer FORBIDDEN_CONTENT_FIELDS guard.';

-- ------------------------------------------------------------------
-- drill_down_requests — Lane B dual-control student drill-down
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drill_down_requests (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id          uuid NOT NULL REFERENCES users(id),
  target_user_id_hash   text NOT NULL CHECK (target_user_id_hash ~ '^[a-f0-9]{64}$'),
  reason                text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 2000),
  status                drill_down_status NOT NULL DEFAULT 'pending',
  approvals             jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  decided_at            timestamptz,
  expires_at            timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS ddr_requester_idx  ON drill_down_requests(requester_id);
CREATE INDEX IF NOT EXISTS ddr_target_idx     ON drill_down_requests(target_user_id_hash);
CREATE INDEX IF NOT EXISTS ddr_status_idx     ON drill_down_requests(status);
CREATE INDEX IF NOT EXISTS ddr_expires_at_idx ON drill_down_requests(expires_at);

COMMENT ON COLUMN drill_down_requests.approvals IS
  'Array of {approver_id, approver_role, decided_at, decision} objects. Two distinct approvers (wellbeing_lead + student_ombudsman) required to flip status → approved. Enforced by migration 0000000000005.';

COMMIT;
