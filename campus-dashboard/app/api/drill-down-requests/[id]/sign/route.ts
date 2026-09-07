import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/utils/supabase/server';
import {
  computePayloadHash,
  fromBase64,
  verify,
  toBase64,
  type DrillDownRequestPayload,
} from '@/lib/crypto/ed25519';
import { verifyDrillDownRequest } from '@/lib/dual-control/verifier';

/**
 * PATCH /api/drill-down-requests/:id/sign
 * Body: { role: 'wellbeing_lead' | 'student_ombudsman', signature_b64: string }
 *
 * Verifies the Ed25519 signature against the caller's active roster key,
 * writes lead_signature_b64 or ombudsman_signature_b64 + timestamp +
 * payload_hash, appends an approvals[] row via p_ddr_coapprove, and when
 * both signatures + both DB co-approval flags are in place, flips status
 * to 'approved'. Every action writes an audit_log row via p_append_audit.
 */

const Schema = z
  .object({
    role: z.enum(['wellbeing_lead', 'student_ombudsman']),
    signature_b64: z.string().min(16).max(256),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
  const { role, signature_b64 } = parsed.data;

  // Fetch the request.
  const { data: row, error: rErr } = await supabase
    .from('drill_down_requests')
    .select('id, requester_id, target_user_id_hash, reason, created_at, status, payload_hash, lead_signature_b64, ombudsman_signature_b64')
    .eq('id', id)
    .single();
  if (rErr || !row) return NextResponse.json({ error: 'request not found' }, { status: 404 });
  if (row.requester_id === user.id) {
    return NextResponse.json({ error: 'requester cannot sign their own request' }, { status: 403 });
  }
  if (row.status !== 'pending') {
    return NextResponse.json({ error: `request is already ${row.status}` }, { status: 409 });
  }

  // Look up caller's active key.
  const { data: keyRow } = await supabase
    .from('approver_keys')
    .select('public_key_b64, role, revoked_at')
    .eq('user_id', user.id)
    .single();
  if (!keyRow || keyRow.revoked_at || keyRow.role !== role) {
    return NextResponse.json({ error: 'no active roster key for this role' }, { status: 403 });
  }

  // Recompute canonical payload hash.
  const payload: DrillDownRequestPayload = {
    request_id: row.id,
    requester_id: row.requester_id,
    target_user_id_hash: row.target_user_id_hash,
    reason: row.reason,
    created_at: row.created_at,
  };
  const hash = await computePayloadHash(payload);

  // Verify signature.
  const ok = await verify(
    fromBase64(signature_b64),
    hash,
    fromBase64(keyRow.public_key_b64),
  );
  if (!ok) return NextResponse.json({ error: 'signature invalid' }, { status: 400 });

  // Persist signature + payload_hash. Store hash as bytea via hex escape.
  const hashHex = `\\x${Buffer.from(hash).toString('hex')}`;
  const patch: Record<string, unknown> = { payload_hash: hashHex };
  if (role === 'wellbeing_lead') {
    patch.lead_signature_b64 = signature_b64;
    patch.lead_signed_at = new Date().toISOString();
  } else {
    patch.ombudsman_signature_b64 = signature_b64;
    patch.ombudsman_signed_at = new Date().toISOString();
  }
  const { error: uErr } = await supabase
    .from('drill_down_requests')
    .update(patch)
    .eq('id', id);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

  // Append DB co-approval row (adds to approvals[] and, if second signer,
  // trigger flips status to 'approved' — which our new trigger also requires
  // both signatures for).
  const { error: aErr } = await supabase.rpc('p_ddr_coapprove', {
    p_request_id: id,
    p_approver_id: user.id,
    p_approver_role: role,
    p_decision: 'approve',
  });
  if (aErr) {
    // The RPC also writes the audit_log row; if it failed, surface it.
    return NextResponse.json({ error: `co-approval failed: ${aErr.message}` }, { status: 500 });
  }

  // Post-hoc cryptographic verification (defence-in-depth: catches any race
  // between signature write + roster mutation).
  const verifyResult = await verifyDrillDownRequest(id);

  return NextResponse.json({
    ok: true,
    role,
    payload_hash_b64: toBase64(hash),
    verified: verifyResult.valid,
    verify_reason: verifyResult.reason,
  });
}
