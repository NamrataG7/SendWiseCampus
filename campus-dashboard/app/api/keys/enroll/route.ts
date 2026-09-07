import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/keys/enroll
 * Body: { role: 'wellbeing_lead' | 'student_ombudsman', public_key_b64: string }
 * Writes an approver_keys row for the caller.
 */

const Schema = z
  .object({
    role: z.enum(['wellbeing_lead', 'student_ombudsman']),
    public_key_b64: z.string().min(16).max(256),
  })
  .strict();

export async function POST(req: NextRequest) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid payload', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { role, public_key_b64 } = parsed.data;

  const { error } = await supabase
    .from('approver_keys')
    .upsert(
      {
        user_id: user.id,
        role,
        public_key_b64,
        key_algo: 'ed25519',
        revoked_at: null,
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
