import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import DashboardClient from '../../dashboard-client';
import {
  computeIncidentList,
  computeDashboardStats,
} from '@/lib/insights-server';

export const dynamic = 'force-dynamic';

/**
 * Per-student detail page — only rendered when the requesting wellbeing-team
 * member has an *approved* drill-down request for this exact target hash.
 *
 * Dual-control approval is enforced upstream in Supabase (Lane C).
 * This page trusts the row-level status field but also refuses to render
 * without an explicit approved match.
 */
export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ user_id_hash: string }>;
}) {
  const { user_id_hash } = await params;
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Check for an approved drill-down request for this (requester, target).
  // TODO(Lane C): if the drill_down_requests migration has not been merged
  // yet in this environment, `error` will be non-null; in that case we
  // fall through to notFound() rather than silently exposing data.
  const { data: approvedReq, error } = await supabase
    .from('drill_down_requests')
    .select('id, status')
    .eq('requester_id', user.id)
    .eq('target_user_id_hash', user_id_hash)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle();

  if (error || !approvedReq) {
    // No approved request — do not reveal whether the student exists.
    notFound();
  }

  const metadata = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const wellbeingLabel =
    metadata.full_name || metadata.name || user.email || 'Wellbeing Team';

  const incidents = await computeIncidentList([user_id_hash]);
  const stats = computeDashboardStats(incidents);

  return (
    <DashboardClient
      parentLabel={wellbeingLabel}
      childCount={1}
      childHashes={[user_id_hash]}
      incidents={incidents}
      stats={stats}
    />
  );
}
