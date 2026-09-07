// verify.mjs
//
// This script has no dependency on the campus dashboard. Anyone can run it
// against a claimed anchor to verify that the audit_log in a live database
// still matches the published Merkle root.
//
// Usage:
//   DATABASE_URL=postgres://... node verify.mjs path/to/anchor-YYYYMMDD.json
//
// Exit codes:
//   0 — recomputed Merkle root matches the anchored root (PASS)
//   1 — mismatch, or unable to reach the anchor's chain_head_id (FAIL)
//   2 — invocation / environment error
//
// See docs/AUDIT_ANCHOR.md.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;

function sha256Buf(buf) {
  return createHash('sha256').update(buf).digest();
}
function sha256Hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function merkleRootHex(rowHashesHex) {
  if (rowHashesHex.length === 0) return sha256Hex(Buffer.alloc(0));
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
  const anchorPath = process.argv[2];
  if (!anchorPath) {
    console.error('Usage: DATABASE_URL=... node verify.mjs <anchor.json>');
    process.exit(2);
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is required.');
    process.exit(2);
  }

  const anchor = JSON.parse(await readFile(anchorPath, 'utf8'));
  const headId = anchor.chain_head_id;
  const claimedRoot = anchor.merkle_root_hex;

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  let rows;
  try {
    const res = await client.query(
      'SELECT id, row_hash FROM audit_log WHERE id <= $1 ORDER BY id ASC',
      [headId]
    );
    rows = res.rows;
  } finally {
    await client.end();
  }

  if (rows.length !== anchor.count) {
    console.error(
      `FAIL: row count mismatch — anchor says ${anchor.count}, DB returned ${rows.length} at head id ${headId}`
    );
    process.exit(1);
  }

  const computed = merkleRootHex(rows.map((r) => r.row_hash));
  if (computed !== claimedRoot) {
    console.error('FAIL: Merkle root mismatch.');
    console.error(`  anchored:  ${claimedRoot}`);
    console.error(`  recomputed: ${computed}`);
    process.exit(1);
  }

  console.log('PASS');
  console.log(`  head id:      ${headId}`);
  console.log(`  count:        ${rows.length}`);
  console.log(`  merkle root:  ${computed}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
