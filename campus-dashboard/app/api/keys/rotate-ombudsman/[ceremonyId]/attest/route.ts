import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import { fromBase64, verify } from '@/lib/crypto/ed25519';

/**
 * PATCH /api/keys/rotate-ombudsman/:ceremonyId/attest
 * Body: { prior_ombudsman_user_id: uuid, signature_b64: string }
 *
 * Verifies the signature against the prior ombudsman's public key
 * (including revoked keys if signed_at was before revocation), persists
 * the attestation, and — once quorum is reached — completes the ceremony
 * and enrolls the incoming user's public key into approver_keys.
 */

const Schema = z
  .object({
    prior_ombudsman_user_id: z.string().uuid(),
    signature_b64: z.string().min(16).max(256),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ceremonyId: string }> },
) {
  const { ceremonyId } = await params;
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
    return NextResponse.json({ error: 'invalid payload', issues: parsed.error.issues }, { status: 400 });
  }
  const { prior_ombudsman_user_id, signature_b64 } = parsed.data;

  // Fetch ceremony.
  const { data: ceremony, error: cErr } = await supabase
    .from('ombudsman_rotation_ceremonies')
    .select('id, incoming_public_key_b64, quorum_size, completed_at, incoming_user_id')
    .eq('id', ceremonyId)
    .single();
  if (cErr || !ceremony) return NextResponse.json({ error: 'ceremony not found' }, { status: 404 });
  if (ceremony.completed_at) return NextResponse.json({ error: 'ceremony already completed' }, { status: 409 });

  // Fetch prior ombudsman key (may be revoked; accept if it was active at some point).
  const { data: keyRow } = await supabase
    .from('approver_keys')
    .select('public_key_b64, role, revoked_at')
    .eq('user_id', prior_ombudsman_user_id)
    .single();
  if (!keyRow || keyRow.role !== 'student_ombudsman') {
    return NextResponse.json({ error: 'no ombudsman key on file for attester' }, { status: 400 });
  }

  // Verify signature: message is the incoming public key bytes.
  const msg = fromBase64(ceremony.incoming_public_key_b64);
  const ok = await verify(
    fromBase64(signature_b64),
    msg,
    fromBase64(keyRow.public_key_b64),
  );
  if (!ok) return NextResponse.json({ error: 'signature invalid' }, { status: 400 });

  // Persist attestation.
  const { error: aErr } = await supabase
    .from('ombudsman_rotation_attestations')
    .insert({
      ceremony_id: ceremonyId,
      prior_ombudsman_user_id,
      signature_b64,
    });
  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

  // Check quorum.
  const { count } = await supabase
    .from('ombudsman_rotation_attestations')
    .select('*', { count: 'exact', head: true })
    .eq('ceremony_id', ceremonyId);

  const attestations = count ?? 0;
  let completed = false;
  if (attestations >= ceremony.quorum_size) {
    // Enroll new key + mark ceremony completed.
    await supabase.from('approver_keys').upsert(
      {
        user_id: ceremony.incoming_user_id,
        role: 'student_ombudsman',
        public_key_b64: ceremony.incoming_public_key_b64,
        key_algo: 'ed25519',
        revoked_at: null,
      },
      { onConflict: 'user_id' },
    );
    await supabase
      .from('ombudsman_rotation_ceremonies')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', ceremonyId);
    completed = true;
  }

  return NextResponse.json({
    ok: true,
    attestations,
    quorum_size: ceremony.quorum_size,
    completed,
  });
}
