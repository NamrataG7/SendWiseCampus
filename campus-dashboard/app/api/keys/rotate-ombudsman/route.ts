import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/keys/rotate-ombudsman
 * Body: { incoming_user_id: uuid, incoming_public_key_b64: string, quorum_size?: number }
 * Creates a ceremony row. Attestations are added via PATCH .../attest.
 */

const Schema = z
  .object({
    incoming_user_id: z.string().uuid(),
    incoming_public_key_b64: z.string().min(16).max(256),
    quorum_size: z.number().int().min(1).max(9).optional(),
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

  const { incoming_user_id, incoming_public_key_b64, quorum_size } = parsed.data;

  const { data, error } = await supabase
    .from('ombudsman_rotation_ceremonies')
    .insert({
      incoming_user_id,
      incoming_public_key_b64,
      initiated_by: user.id,
      quorum_size: quorum_size ?? 3,
    })
    .select('id, quorum_size')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ceremony_id: data.id, quorum_size: data.quorum_size }, { status: 201 });
}
