'use client';

/**
 * Browser keystore: persists the approver's Ed25519 private key in IndexedDB
 * as a non-exportable CryptoKey-shaped blob. Never syncs, never leaves the
 * device. Loss of browser storage means a re-enrollment ceremony.
 *
 * We use raw bytes (not WebCrypto CryptoKey) because WebCrypto does not
 * expose Ed25519 across all target browsers yet. Keys are marked
 * `origin-local` and never surfaced to app code outside of sign() calls.
 */

import {
  generateKeyPair,
  sign,
  toBase64,
  type DrillDownRequestPayload,
  computePayloadHash,
} from './ed25519';

const DB_NAME = 'sendwise-campus-keystore';
const STORE = 'approver-keys';
const KEY_ID = 'self';

interface StoredKey {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  role: 'wellbeing_lead' | 'student_ombudsman';
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<StoredKey | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY_ID);
    req.onsuccess = () => resolve((req.result as StoredKey) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(value: StoredKey): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Idempotent: returns existing key if enrolled, else generates + POSTs. */
export async function ensureApproverKey(
  role: 'wellbeing_lead' | 'student_ombudsman',
): Promise<{ publicKeyB64: string }> {
  const existing = await idbGet();
  if (existing && existing.role === role) {
    return { publicKeyB64: toBase64(existing.publicKey) };
  }

  const { privateKey, publicKey } = await generateKeyPair();
  const publicKeyB64 = toBase64(publicKey);

  await idbPut({
    privateKey,
    publicKey,
    role,
    createdAt: new Date().toISOString(),
  });

  const res = await fetch('/api/keys/enroll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role, public_key_b64: publicKeyB64 }),
  });
  if (!res.ok) {
    throw new Error(`enroll failed: ${res.status}`);
  }
  return { publicKeyB64 };
}

/** Sign a drill-down request payload with the enrolled key. */
export async function signDrillDownRequest(
  payload: DrillDownRequestPayload,
): Promise<{ signatureB64: string; payloadHashB64: string; role: string }> {
  const stored = await idbGet();
  if (!stored) throw new Error('no approver key enrolled on this device');
  const hash = await computePayloadHash(payload);
  const sig = await sign(hash, stored.privateKey);
  return {
    signatureB64: toBase64(sig),
    payloadHashB64: toBase64(hash),
    role: stored.role,
  };
}

export async function getEnrolledRole(): Promise<string | null> {
  const stored = await idbGet();
  return stored?.role ?? null;
}
