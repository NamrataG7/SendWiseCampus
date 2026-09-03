import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/drill-down-requests
 *
 * Creates a pending drill-down request. A wellbeing-team member submits a
 * reason plus a target student hash; the row lands in Supabase table
 * `drill_down_requests` with status='pending'.
 *
 * The actual approval flow is a dual-control (co-approval) mechanism
 * implemented by Supabase co-approval — Lane C. This handler intentionally
 * does NOT approve requests; it only records them.
 *
 * GET /api/drill-down-requests
 * Lists the current user's submitted requests (any status).
 */

const HEX64 = /^[a-f0-9]{64}$/i;

const CreateSchema = z
  .object({
    reason: z.string().min(10).max(2000),
    target_user_id_hash: z.string().regex(HEX64),
  })
  .strict();

export async function POST(req: NextRequest) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { reason, target_user_id_hash } = parsed.data;

  // TODO(Lane C): once the drill_down_requests migration lands, this insert
  // will hit the real table with an RLS policy that requires a second
  // wellbeing-team member to co-approve before status flips to 'approved'.
  const { data, error } = await supabase
    .from('drill_down_requests')
    .insert({
      requester_id: user.id,
      target_user_id_hash,
      reason,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    // Migration may not be merged yet — degrade gracefully so the UI flow
    // is testable end-to-end.
    // TODO(Lane C): remove this fallback once the table exists in all envs.
    return NextResponse.json(
      {
        id: `stub-${Date.now()}`,
        status: 'pending',
        note: 'drill_down_requests table not available; stub id returned',
      },
      { status: 202 },
    );
  }

  return NextResponse.json({ id: data.id, status: 'pending' }, { status: 201 });
}

export async function GET() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('drill_down_requests')
    .select('id, target_user_id_hash, reason, status, created_at')
    .eq('requester_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    // TODO(Lane C): remove once migrations merged.
    return NextResponse.json({ requests: [] }, { status: 200 });
  }

  return NextResponse.json({ requests: data ?? [] });
}
