// anchor.mjs
//
// Daily audit-log anchor publisher.
//
// Reads the SendWise Campus `audit_log` hash chain, verifies the chain
// integrity, computes an RFC 6962-style Merkle root over row_hashes, and
// emits a signed-artefact-ready JSON manifest + a bare MERKLE_ROOT.txt.
//
// Env:
//   DATABASE_URL     Postgres connection string (required)
//   CAMPUS_CODE      Free-form campus tag written into the manifest (optional)
//
// Output:
//   scripts/audit-anchor/out/anchor-YYYYMMDD.json
//   scripts/audit-anchor/out/MERKLE_ROOT.txt
//
// See docs/AUDIT_ANCHOR.md for the threat model and verification workflow.

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function sha256Buf(buf) {
  return createHash('sha256').update(buf).digest();
}

// Canonical JSON: sorted keys, no whitespace. Matches what the DB trigger
// hashes when it builds row_hash. If the DB uses a different canonicalisation
// the verifier will still catch mismatches — this is the reference impl.
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
}

// RFC 6962-style Merkle root over hex row_hashes.
// - Empty tree: sha256("") hex.
// - Leaves are used as-is (already sha256 digests from the DB).
// - Internal nodes: sha256(left || right) on the raw 32-byte digests.
// - Odd node at a level is promoted (duplicated) — this is the "sorted-pair"
//   convention used by many transparency-log implementations. We do NOT sort
//   leaves; ordering is by audit_log.id ASC to preserve chain semantics.
export function merkleRootHex(rowHashesHex) {
  if (rowHashesHex.length === 0) {
    return sha256Hex(Buffer.alloc(0));
  }
  let level = rowHashesHex.map((h) => Buffer.from(h, 'hex'));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(sha256Buf(Buffer.concat([left, right])));
    }
    level = next;
  }
  return level[0].toString('hex');
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is required.');
    process.exit(2);
  }
  const campusCode = process.env.CAMPUS_CODE || 'unspecified';

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  let rows;
  try {
    const res = await client.query(
      'SELECT id, prev_hash, row_hash, payload, created_at FROM audit_log ORDER BY id ASC'
    );
    rows = res.rows;
  } finally {
    await client.end();
  }

  // Verify the hash chain.
  let mismatches = 0;
  let prev = '';
  for (const r of rows) {
    const expectedPrev = prev;
    if ((r.prev_hash || '') !== expectedPrev) {
      mismatches++;
    }
    const payloadCanon = canonicalJson(r.payload ?? null);
    const expectedRowHash = sha256Hex(Buffer.from((r.prev_hash || '') + payloadCanon, 'utf8'));
    if (r.row_hash !== expectedRowHash) {
      mismatches++;
    }
    prev = r.row_hash;
  }

  const rowHashes = rows.map((r) => r.row_hash);
  const merkle = merkleRootHex(rowHashes);
  const head = rows[rows.length - 1];

  const now = new Date();
  const stamp =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, '0') +
    String(now.getUTCDate()).padStart(2, '0');

  const manifest = {
    generated_at: now.toISOString(),
    chain_head_id: head ? head.id : null,
    chain_head_row_hash: head ? head.row_hash : null,
    merkle_root_hex: merkle,
    count: rows.length,
    chain_verification_mismatches: mismatches,
    campus_code_env: campusCode,
    algorithm: {
      hash: 'sha256',
      merkle: 'rfc6962-style, promote-odd, order-by-id-asc',
      canonical_json: 'sorted-keys, no-whitespace'
    }
  };

  const outDir = join(__dirname, 'out');
  await mkdir(outDir, { recursive: true });
  const manifestPath = join(outDir, `anchor-${stamp}.json`);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(join(outDir, 'MERKLE_ROOT.txt'), merkle + '\n', 'utf8');

  console.log(`Wrote ${manifestPath}`);
  console.log(`Merkle root: ${merkle}`);
  console.log(`Rows: ${rows.length}  Mismatches: ${mismatches}`);
  if (mismatches > 0) {
    // Non-fatal: we still publish the anchor so external observers can see
    // that the chain was already broken at anchoring time.
    console.warn('WARNING: chain verification mismatches detected — see manifest.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
