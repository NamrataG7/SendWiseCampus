import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/keys/revoke — mark the caller's approver key revoked.
 */
export async function POST() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('approver_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
