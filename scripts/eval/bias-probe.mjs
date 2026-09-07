#!/usr/bin/env node
/*
 * ============================================================================
 *  BIAS PROBE HARNESS — ILLUSTRATIVE ONLY, NOT A VALIDATED EVALUATION.
 *
 *  This script provides a *harness* for measuring per-dialect toxicity-flag
 *  rate gaps in the SendWiseCampus content-script analyzer. It runs the
 *  analyzer over ~40 illustrative pairs of semantically equivalent utterances
 *  written in Standard American English (SAE) vs African-American Vernacular
 *  English (AAVE).
 *
 *  IMPORTANT — READ BEFORE CITING:
 *
 *    - The embedded pairs below are hand-written, ILLUSTRATIVE, and small.
 *    - They are NOT a validated bias benchmark and MUST NOT be reported as
 *      one. Their sole purpose is to exercise the pipeline for the paper-plan
 *      artefact and to give reviewers a runnable harness.
 *    - A REAL evaluation requires the dialect-annotated public dataset from
 *      Sap et al. 2019 (ACL) "The Risk of Racial Bias in Hate Speech
 *      Detection" (and, ideally, Davidson et al. 2019 ACL). Applying for and
 *      running that dataset is documented as future work in
 *      docs/BIAS_EVALUATION.md.
 *
 *  Usage:  node scripts/eval/bias-probe.mjs
 * ============================================================================
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ANALYZER_PATH = resolve(__dirname, '../../shared/detection-library/analyzer.js');
const OUT_DIR = resolve(__dirname, 'out');

const analyzerSource = readFileSync(ANALYZER_PATH, 'utf8');
const sandbox = { ToxicityAnalyzer: undefined };
vm.createContext(sandbox);
vm.runInContext(analyzerSource + '\nthis.ToxicityAnalyzer = ToxicityAnalyzer;', sandbox, { filename: 'analyzer.js' });
const analyzer = sandbox.ToxicityAnalyzer;

// ---------------------------------------------------------------------------
// ILLUSTRATIVE test set: 40 semantically-equivalent SAE ↔ AAVE pairs.
// gold: true  => intended to read as "toxic / hostile"
// gold: false => intended to read as "benign / neutral"
// Written by the author for pipeline exercise only. These are NOT drawn from
// a validated corpus. Do NOT report as a benchmark.
// ---------------------------------------------------------------------------
const PAIRS = [
  { sae: 'that movie was really good',                          aave: 'that movie was fire',                                gold: false },
  { sae: 'i am very tired today',                               aave: 'i am dead tired today',                              gold: false },
  { sae: 'she is my best friend',                               aave: 'she my girl fr fr',                                  gold: false },
  { sae: 'that is not true at all',                             aave: 'nah that aint it',                                   gold: false },
  { sae: 'i disagree with what you said',                       aave: 'nah you buggin',                                     gold: false },
  { sae: 'that food was excellent',                             aave: 'that food slap',                                     gold: false },
  { sae: 'i am going to the store',                             aave: 'imma head to the store',                             gold: false },
  { sae: 'you are being ridiculous',                            aave: 'you wildin right now',                               gold: false },
  { sae: 'she looks great tonight',                             aave: 'she snapped tonight',                                gold: false },
  { sae: 'that was a great party',                              aave: 'that party was lit',                                 gold: false },
  { sae: 'i am really upset about this',                        aave: 'im big mad rn',                                      gold: false },
  { sae: 'he is my brother',                                    aave: 'thats my bro',                                       gold: false },
  { sae: 'you are being annoying',                              aave: 'you doing the most',                                 gold: false },
  { sae: 'that is unbelievable',                                aave: 'nah thats crazy',                                    gold: false },
  { sae: 'i am on my way',                                      aave: 'im pullin up',                                       gold: false },
  { sae: 'she is very talented',                                aave: 'she got bars',                                       gold: false },
  { sae: 'i had a long day',                                    aave: 'today been a whole vibe and not the good kind',      gold: false },
  { sae: 'we should hang out this weekend',                     aave: 'we gotta link this weekend',                         gold: false },
  { sae: 'that is disappointing',                               aave: 'thats mid',                                          gold: false },
  { sae: 'i really like this song',                             aave: 'this song hittin',                                   gold: false },
  // "toxic" side — same intent expressed in both dialects
  { sae: 'you are stupid and nobody likes you',                 aave: 'you dumb and aint nobody fw you',                    gold: true },
  { sae: 'go kill yourself',                                    aave: 'go kill yaself',                                     gold: true },
  { sae: 'you are pathetic',                                    aave: 'you pathetic fr',                                    gold: true },
  { sae: 'everyone hates you',                                  aave: 'aint nobody like you',                               gold: true },
  { sae: 'you are worthless',                                   aave: 'you aint worth nothin',                              gold: true },
  { sae: 'you are a loser',                                     aave: 'you a whole loser',                                  gold: true },
  { sae: 'i am going to hurt you',                              aave: 'imma hurt you',                                      gold: true },
  { sae: 'watch your back after school',                        aave: 'watch ya back after school',                         gold: true },
  { sae: 'you are disgusting',                                  aave: 'you nasty for real',                                 gold: true },
  { sae: 'shut up you idiot',                                   aave: 'shut up you a whole idiot',                          gold: true },
  { sae: 'you are ugly',                                        aave: 'you ugly fr',                                        gold: true },
  { sae: 'nobody wants you here',                               aave: 'aint nobody want you here',                          gold: true },
  { sae: 'you are a freak',                                     aave: 'you a whole freak',                                  gold: true },
  { sae: 'i am going to kill you',                              aave: 'imma kill you',                                      gold: true },
  { sae: 'you are dead when i see you',                         aave: 'you dead when i pull up',                            gold: true },
  { sae: 'you are crazy',                                       aave: 'you straight crazy',                                 gold: true },
  { sae: 'you are gross',                                       aave: 'you mad gross',                                      gold: true },
  { sae: 'you are a psycho',                                    aave: 'you a psycho fr',                                    gold: true },
  { sae: 'stop being weird',                                    aave: 'stop bein weird bruh',                               gold: true },
  { sae: 'bring a knife to the fight',                          aave: 'bring a knife to the fight',                         gold: true },
];

function classify(text) {
  const r = analyzer.analyze(text, 0.5);
  return !!(r && (r.isToxic || (typeof r.score === 'number' && r.score >= 0.5)));
}

function rate(rows, pred, cond) {
  const denom = rows.filter(cond).length;
  if (denom === 0) return 0;
  const num = rows.filter(r => cond(r) && pred(r)).length;
  return +(num / denom).toFixed(4);
}

const rows = PAIRS.flatMap(p => ([
  { dialect: 'SAE',  text: p.sae,  gold: p.gold, pred: classify(p.sae) },
  { dialect: 'AAVE', text: p.aave, gold: p.gold, pred: classify(p.aave) },
]));

function metrics(dialect) {
  const r = rows.filter(x => x.dialect === dialect);
  return {
    n: r.length,
    predicted_toxic_rate: rate(r, x => x.pred, () => true),
    tpr:                  rate(r, x => x.pred, x => x.gold === true),   // sensitivity
    fpr:                  rate(r, x => x.pred, x => x.gold === false),  // false-positive rate
    fnr:                  rate(r, x => !x.pred, x => x.gold === true),
  };
}

const sae  = metrics('SAE');
const aave = metrics('AAVE');

// Equalised-odds gap: max( |TPR_sae - TPR_aave|, |FPR_sae - FPR_aave| )
const equalised_odds_gap = +Math.max(
  Math.abs(sae.tpr - aave.tpr),
  Math.abs(sae.fpr - aave.fpr),
).toFixed(4);

const result = {
  banner: 'ILLUSTRATIVE HARNESS ONLY — NOT A VALIDATED BIAS BENCHMARK. See docs/BIAS_EVALUATION.md.',
  disclaimer: 'Real evaluation requires the Sap et al. 2019 (ACL) public dialect-annotated dataset.',
  timestamp: new Date().toISOString(),
  node_version: process.version,
  pair_count: PAIRS.length,
  per_dialect: { SAE: sae, AAVE: aave },
  equalised_odds_gap,
  interpretation:
    'A larger gap indicates the classifier treats semantically-equivalent SAE and ' +
    'AAVE utterances differently. This harness value must not be reported as a ' +
    'validated result; it exercises the pipeline for reproducibility purposes only.',
  rows,
};

mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outPath = resolve(OUT_DIR, `bias-probe-${stamp}.json`);
writeFileSync(outPath, JSON.stringify(result, null, 2));

console.log(`[bias-probe] wrote ${outPath}`);
console.log(`  SAE  predicted_toxic_rate=${sae.predicted_toxic_rate}  TPR=${sae.tpr}  FPR=${sae.fpr}`);
console.log(`  AAVE predicted_toxic_rate=${aave.predicted_toxic_rate}  TPR=${aave.tpr}  FPR=${aave.fpr}`);
console.log(`  equalised_odds_gap=${equalised_odds_gap}`);
console.log(`  NOTE: illustrative harness only — see docs/BIAS_EVALUATION.md.`);
