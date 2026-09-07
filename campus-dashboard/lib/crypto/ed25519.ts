/**
 * Ed25519 primitives for cryptographic dual-control.
 *
 * Thin wrapper around @noble/ed25519 so route handlers, the browser
 * keystore, and the verifier all agree on encoding + canonicalization.
 */

import * as ed from '@noble/ed25519';

export interface DrillDownRequestPayload {
  request_id: string;
  requester_id: string;
  target_user_id_hash: string;
  reason: string;
  created_at: string;
}

/** Canonical JSON: sorted keys, no whitespace. Same on client and server. */
export function canonicalJson(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => {
    const v = obj[k];
    return `${JSON.stringify(k)}:${JSON.stringify(v)}`;
  });
  return `{${parts.join(',')}}`;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  // Node 18+ and modern browsers both ship SubtleCrypto.
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
}

export async function computePayloadHash(
  payload: DrillDownRequestPayload,
): Promise<Uint8Array> {
  const canon = canonicalJson(payload as unknown as Record<string, unknown>);
  return sha256(new TextEncoder().encode(canon));
}

export async function generateKeyPair(): Promise<{
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { privateKey, publicKey };
}

export async function sign(
  payload: Uint8Array,
  privateKey: Uint8Array,
): Promise<Uint8Array> {
  return ed.signAsync(payload, privateKey);
}

export async function verify(
  signature: Uint8Array,
  payload: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  try {
    return await ed.verifyAsync(signature, payload, publicKey);
  } catch {
    return false;
  }
}

// ---------- base64 helpers (browser + Node compatible) ----------

export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function fromBase64(s: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(s, 'base64'));
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
