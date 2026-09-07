/**
 * Server-side verification of dual-control signatures on a drill-down request.
 *
 * Fetches the request row + the current roster (approver_keys), recomputes
 * the canonical payload hash, and verifies both Ed25519 signatures against
 * the correct roles' active public keys.
 */

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import {
  computePayloadHash,
  fromBase64,
  verify,
  type DrillDownRequestPayload,
} from '@/lib/crypto/ed25519';

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}

interface DDRRow {
  id: string;
  requester_id: string;
  target_user_id_hash: string;
  reason: string;
  created_at: string;
  payload_hash: string | null;
  lead_signature_b64: string | null;
  ombudsman_signature_b64: string | null;
  approvals: Array<{ approver_id: string; approver_role: string; decision: string }> | null;
}

interface RosterKey {
  user_id: string;
  role: string;
  public_key_b64: string;
  added_at: string;
  revoked_at: string | null;
}

export async function verifyDrillDownRequest(
  requestId: string,
): Promise<VerificationResult> {
  const supabase = createClient(await cookies());

  const { data: row, error } = await supabase
    .from('drill_down_requests')
    .select(
      'id, requester_id, target_user_id_hash, reason, created_at, payload_hash, lead_signature_b64, ombudsman_signature_b64, approvals',
    )
    .eq('id', requestId)
    .single();

  if (error || !row) {
    return { valid: false, reason: 'request not found' };
  }
  const r = row as DDRRow;

  if (!r.lead_signature_b64 || !r.ombudsman_signature_b64) {
    return { valid: false, reason: 'missing one or both signatures' };
  }

  const payload: DrillDownRequestPayload = {
    request_id: r.id,
    requester_id: r.requester_id,
    target_user_id_hash: r.target_user_id_hash,
    reason: r.reason,
    created_at: r.created_at,
  };
  const hash = await computePayloadHash(payload);

  const { data: roster } = await supabase
    .from('approver_keys')
    .select('user_id, role, public_key_b64, added_at, revoked_at');

  const keys: RosterKey[] = (roster as RosterKey[]) ?? [];
  const approvals = r.approvals ?? [];

  async function verifyRole(
    role: 'wellbeing_lead' | 'student_ombudsman',
    sigB64: string,
  ): Promise<VerificationResult> {
    const approval = approvals.find(
      (a) => a.approver_role === role && a.decision === 'approve',
    );
    if (!approval) {
      return { valid: false, reason: `no ${role} approval row` };
    }
    const rosterKey = keys.find(
      (k) => k.user_id === approval.approver_id && k.role === role && !k.revoked_at,
    );
    if (!rosterKey) {
      return { valid: false, reason: `no active ${role} key for approver` };
    }
    const ok = await verify(
      fromBase64(sigB64),
      hash,
      fromBase64(rosterKey.public_key_b64),
    );
    return ok ? { valid: true } : { valid: false, reason: `${role} signature invalid` };
  }

  const lead = await verifyRole('wellbeing_lead', r.lead_signature_b64);
  if (!lead.valid) return lead;
  const ombuds = await verifyRole('student_ombudsman', r.ombudsman_signature_b64);
  if (!ombuds.valid) return ombuds;

  return { valid: true };
}
