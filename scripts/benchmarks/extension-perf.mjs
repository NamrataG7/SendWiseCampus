#!/usr/bin/env node
/*
 * ============================================================================
 *  Academic prototype benchmark — synthetic corpus.
 *  Reproduces § of docs/BENCHMARKS.md.
 *
 *  Measures the SendWiseCampus content-script analyzer as invoked from Node
 *  (browser divergence is documented as a limitation in BENCHMARKS.md).
 *
 *  Corpus is embedded, small, benign+toxic-ish, and contains NO real personal
 *  data. This benchmark exists to give the paper §7 Implementation section
 *  reproducible numbers without requiring a user pilot.
 *
 *  Usage:  node scripts/benchmarks/extension-perf.mjs
 * ============================================================================
 */

import { performance } from 'node:perf_hooks';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ANALYZER_PATH = resolve(__dirname, '../../shared/detection-library/analyzer.js');
const OUT_DIR = resolve(__dirname, 'out');

// Load the extension analyzer verbatim into a Node VM context so we exercise
// the SAME code path the content-script uses. We do NOT modify shared/.
// The shipped analyzer declares `const ToxicityAnalyzer = {...}` (lexical, not
// attached to the sandbox). We wrap it in a small shim that re-exposes the
// binding on the sandbox object without altering shared/ source.
const analyzerSource = readFileSync(ANALYZER_PATH, 'utf8');
const sandbox = { ToxicityAnalyzer: undefined };
vm.createContext(sandbox);
vm.runInContext(analyzerSource + '\nthis.ToxicityAnalyzer = ToxicityAnalyzer;', sandbox, { filename: 'analyzer.js' });
const analyzer = sandbox.ToxicityAnalyzer;
if (!analyzer || typeof analyzer.analyze !== 'function') {
  console.error('Failed to load ToxicityAnalyzer from shared/detection-library/analyzer.js');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Synthetic corpus: 200 short strings, mix of benign / borderline / toxic-ish.
// No real personal data. Deliberately generic.
// ---------------------------------------------------------------------------
const BENIGN = [
  'hey want to grab coffee after class',
  'the lecture notes are on the shared drive',
  'thanks for the help with the assignment',
  'meeting at 3pm in the library',
  'can you send me the reading list',
  'great work on the presentation today',
  'i think the deadline is next friday',
  'let me know if you need anything',
  'the exam went pretty well i think',
  'see you at practice tomorrow',
  'happy birthday hope you have a great day',
  'the cafeteria closes at 8 tonight',
  'do you want to study together this weekend',
  'i finished the lab report already',
  'the wifi in the dorm is really slow today',
  'congrats on getting the internship',
  'i really enjoyed the guest lecture',
  'lets meet up before the group project meeting',
  'can we push the meeting to next week',
  'i think you did a great job on that essay',
];
const BORDERLINE = [
  'that was kind of a weird thing to say',
  'i disagree with your take on this',
  'that presentation was rough not gonna lie',
  'this class is honestly a joke',
  'thats a dumb rule',
  'the professor is being unreasonable',
  'this exam is insane',
  'i cannot deal with this group project',
  'that answer was so wrong',
  'you always show up late',
];
const TOXIC_ISH = [
  'you are so stupid nobody likes you',
  'kill yourself already',
  'everyone hates you',
  'you are pathetic and worthless',
  'go die in a hole',
  'you are such a loser',
  'ugly freak stop talking',
  'youre a psycho weirdo',
  'i hate you so much',
  'you are disgusting and gross',
  'watch your back after class',
  'im going to hurt you',
  'im going to kill you',
  'youre dead when i see you',
  'send nudes',
  'send pics right now',
  'shut up you idiot',
  'crazy freak get lost',
  'nobody wants you here',
  'bring a knife to school',
];

const CORPUS = [];
while (CORPUS.length < 200) {
  CORPUS.push(BENIGN[CORPUS.length % BENIGN.length]);
  if (CORPUS.length < 200) CORPUS.push(BORDERLINE[CORPUS.length % BORDERLINE.length]);
  if (CORPUS.length < 200) CORPUS.push(TOXIC_ISH[CORPUS.length % TOXIC_ISH.length]);
}
CORPUS.length = 200;

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor((p / 100) * sortedArr.length));
  return sortedArr[idx];
}

function rssMb() {
  return +(process.memoryUsage().rss / (1024 * 1024)).toFixed(2);
}

// ---------- run ----------
const rss_mb_before = rssMb();

// Cold-start: first classify call after fresh load.
const coldStart = performance.now();
analyzer.analyze(CORPUS[0], 0.5);
const cold_start_ms = +(performance.now() - coldStart).toFixed(3);

// Warm-up: two throwaway passes so JIT is settled.
for (let i = 0; i < 2; i++) {
  for (const s of CORPUS) analyzer.analyze(s, 0.5);
}

// Measured run: one pass over the 200-string corpus.
const per_call_ms = [];
for (const s of CORPUS) {
  const t0 = performance.now();
  analyzer.analyze(s, 0.5);
  per_call_ms.push(+(performance.now() - t0).toFixed(4));
}

const sorted = [...per_call_ms].sort((a, b) => a - b);
const rss_mb_after = rssMb();

const result = {
  banner: 'Academic prototype benchmark — synthetic corpus. See docs/BENCHMARKS.md.',
  timestamp: new Date().toISOString(),
  node_version: process.version,
  corpus_size: CORPUS.length,
  cold_start_ms,
  warm_p50_ms: percentile(sorted, 50),
  warm_p95_ms: percentile(sorted, 95),
  warm_p99_ms: percentile(sorted, 99),
  warm_max_ms: sorted[sorted.length - 1],
  warm_mean_ms: +(per_call_ms.reduce((a, b) => a + b, 0) / per_call_ms.length).toFixed(4),
  rss_mb_before,
  rss_mb_after,
  per_call_ms_hist: per_call_ms,
};

mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = resolve(OUT_DIR, `extension-perf-${stamp}.json`);
writeFileSync(outPath, JSON.stringify(result, null, 2));

console.log(`[extension-perf] wrote ${outPath}`);
console.log(`  cold_start=${result.cold_start_ms}ms  p50=${result.warm_p50_ms}ms  p95=${result.warm_p95_ms}ms  p99=${result.warm_p99_ms}ms`);
console.log(`  rss ${rss_mb_before}MB -> ${rss_mb_after}MB  node=${result.node_version}`);
