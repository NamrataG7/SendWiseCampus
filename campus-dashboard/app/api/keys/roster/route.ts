import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/keys/roster — public list of currently active approver keys.
 *
 * Public because signature verification is a public operation: anyone
 * with the roster + audit log can independently verify that a drill-down
 * request was properly co-signed. This is the transparency lever.
 */
export async function GET() {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from('approver_keys')
    .select('user_id, role, public_key_b64, key_algo, added_at, revoked_at')
    .is('revoked_at', null);

  if (error) return NextResponse.json({ roster: [] });
  return NextResponse.json({ roster: data ?? [] });
}
