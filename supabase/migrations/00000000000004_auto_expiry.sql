-- Auto-expiry / retention.
-- Adapted from SendWiseForensic/supabase/migrations/20260831110907_auto_expiry.sql.
-- Forensic authorization/session cascade replaced with campus retention policy:
--
--   * Per-student violation rows: purged 6 months after their `timestamp`.
--   * Aggregate rollups (campus-level counts): retained 1 year (application-side view).
--   * Semester purge: hard sweep runs quarterly (Jan / Apr / Jul / Oct 1st) — any
--     violation older than 6 months is deleted regardless.
--   * drill_down_requests: expired requests past `expires_at` flipped to 'rejected'.
--
-- All state transitions append rows to the hash-chained audit_log.

CREATE OR REPLACE FUNCTION campus_retention_sweep()
RETURNS TABLE (
  purged_violations       bigint,
  expired_drill_requests  bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purged_ids       uuid[];
  v_expired_ddr_ids  uuid[];
  v_purged_count     bigint := 0;
  v_expired_count    bigint := 0;
  v_id               uuid;
BEGIN
  -- 1) Per-student violation purge: 6 months post-incident.
  WITH purged AS (
    DELETE FROM violations
     WHERE timestamp < now() - interval '6 months'
     RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_purged_ids FROM purged;
  v_purged_count := COALESCE(array_length(v_purged_ids, 1), 0);

  -- 2) Expire pending drill-down requests past their expires_at.
  WITH expired AS (
    UPDATE drill_down_requests
       SET status     = 'rejected',
           decided_at = now()
     WHERE status     = 'pending'
       AND expires_at < now()
     RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_expired_ddr_ids FROM expired;
  v_expired_count := COALESCE(array_length(v_expired_ddr_ids, 1), 0);

  -- 3) Audit rows via the sanctioned append function.
  IF v_purged_count > 0 THEN
    PERFORM p_append_audit(
      NULL, 'SYSTEM', 'RETENTION_PURGE',
      'violations', NULL,
      jsonb_build_object('reason', 'timestamp < now() - 6 months',
                         'purged_count', v_purged_count)
    );
  END IF;

  IF v_expired_count > 0 THEN
    FOREACH v_id IN ARRAY v_expired_ddr_ids LOOP
      PERFORM p_append_audit(
        NULL, 'SYSTEM', 'DRILL_DOWN_AUTO_EXPIRE',
        'drill_down_requests', v_id::text,
        jsonb_build_object('reason', 'expires_at < now()')
      );
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_purged_count, v_expired_count;
END;
$$;

COMMENT ON FUNCTION campus_retention_sweep IS
  'Campus retention: per-student violations purged 6 months post-incident; drill-down requests expired past expires_at. Aggregate (1yr) rollups derived at query time from surviving rows.';

-- ------------------------------------------------------------------
-- Scheduling
-- ------------------------------------------------------------------
-- Preferred: pg_cron.
--   * Nightly retention sweep at 03:15 UTC.
--   * Quarterly semester purge on the 1st of Jan/Apr/Jul/Oct at 04:00 UTC
--     (same function; the 6-month cutoff already implements the semester rule).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';

      PERFORM cron.unschedule(jobid)
        FROM cron.job
        WHERE jobname IN ('sendwisecampus_retention_nightly',
                          'sendwisecampus_semester_purge');

      PERFORM cron.schedule(
        'sendwisecampus_retention_nightly',
        '15 3 * * *',
        $cron$SELECT public.campus_retention_sweep();$cron$
      );

      PERFORM cron.schedule(
        'sendwisecampus_semester_purge',
        '0 4 1 1,4,7,10 *',
        $cron$SELECT public.campus_retention_sweep();$cron$
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron present but unable to schedule (insufficient privilege?). See supabase/README.md.';
    END;
  ELSE
    RAISE NOTICE 'pg_cron not available. Configure Supabase Scheduled Function to call public.campus_retention_sweep() nightly. See supabase/README.md.';
  END IF;
END $$;
