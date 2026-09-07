// SendWise Campus - background service worker
// Metadata-only violation reporting. Strictly rejects any payload containing message text.
// Respects: enabled toggle, MDM-managed config (dashboardUrl, campusCode, optOutAllowed),
// stable per-profile anonymous user_id_hash, per-session session_id, live counter.

const FORBIDDEN_FIELDS = ['text', 'content', 'message', 'body', 'raw', 'transcript'];
// Canonical category label set — must match campus-dashboard/lib/schema.ts
// (IncidentCategoryEnum). Used by the local-DP randomised-response mechanism
// below (Erlingsson, Pihur, Korolova 2014, "RAPPOR: Randomized Aggregatable
// Privacy-Preserving Ordinal Response", ACM CCS).
const CATEGORY_LABELS = Object.freeze([
  'harassment',
  'threats',
  'hate_speech',
  'sexual_content',
  'self_harm'
]);
const DEFAULTS = {
  dashboardUrl: '',
  campusCode: 'UNSET',
  collegePolicyUrl: '',
  enabled: true,
  eventsSent: 0,
  userIdHash: '',
  optOutAllowed: true,
  // Local differential-privacy epsilon. 0 (or undefined) disables the
  // randomised-response perturbation entirely — backward compatible.
  dpEpsilon: 1.0
};

// Per-service-worker-lifetime session id. Rotates when the worker restarts.
const SESSION_ID = (() => {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
})();

function isMetadataOnly(payload) {
  if (!payload || typeof payload !== 'object') return false;
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_FIELDS.includes(key.toLowerCase())) return false;
    const v = payload[key];
    if (v && typeof v === 'object' && !isMetadataOnly(v)) return false;
  }
  return true;
}

async function getManaged() {
  try {
    if (chrome.storage && chrome.storage.managed) {
      return await chrome.storage.managed.get(null);
    }
  } catch (_) {}
  return {};
}

async function getConfig() {
  const [cfg, managed] = await Promise.all([
    chrome.storage.sync.get(DEFAULTS),
    getManaged()
  ]);
  // MDM-managed values win over user sync values.
  return { ...DEFAULTS, ...cfg, ...managed };
}

async function ensureUserHash(cfg) {
  if (cfg.userIdHash) return cfg.userIdHash;
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  await chrome.storage.sync.set({ userIdHash: hex });
  return hex;
}

async function incrementCounter() {
  const { eventsSent = 0 } = await chrome.storage.sync.get({ eventsSent: 0 });
  await chrome.storage.sync.set({ eventsSent: eventsSent + 1 });
}

// ---------------------------------------------------------------------------
// Local differential privacy — randomised response for categorical labels.
//
// Erlingsson, Pihur, Korolova (2014) "RAPPOR: Randomized Aggregatable
// Privacy-Preserving Ordinal Response" (ACM CCS 2014) generalises Warner's
// (1965) randomised-response survey technique to give each client an
// epsilon-local-DP guarantee: an adversary who observes the reported
// category cannot distinguish, with confidence exceeding e^epsilon,
// whether the true category was c or c'.
//
// We use the two-outcome flip probability p = 1 / (1 + e^epsilon):
// with probability (1 - p) keep the true category; otherwise emit a
// uniformly random *other* category from CATEGORY_LABELS.
//
// A single crypto.getRandomValues() sample gives us the uniform draw.
// Epsilon <= 0 (or undefined / non-finite) disables the mechanism —
// this preserves backward compatibility with pre-DP deployments.
// ---------------------------------------------------------------------------
function uniform01Crypto() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] + 1) / (0xffffffff + 2);
}

function randomisedResponseCategory(category, epsilon) {
  if (!(epsilon > 0) || !Number.isFinite(epsilon)) return category;
  if (!CATEGORY_LABELS.includes(category)) return category;
  const flipProb = 1 / (1 + Math.exp(epsilon));
  if (uniform01Crypto() >= flipProb) return category;
  const others = CATEGORY_LABELS.filter(c => c !== category);
  if (others.length === 0) return category;
  const idx = Math.floor(uniform01Crypto() * others.length);
  return others[Math.min(idx, others.length - 1)];
}

async function postViolation(payload) {
  const cfg = await getConfig();

  // Respect the on/off toggle (unless campus policy disallows opt-out).
  if (cfg.enabled === false && cfg.optOutAllowed !== false) {
    return { ok: false, reason: 'telemetry-disabled' };
  }

  if (!cfg.dashboardUrl) {
    console.warn('[SendWise] dashboardUrl not configured; dropping violation');
    return { ok: false, reason: 'no-dashboard-url' };
  }

  const userIdHash = await ensureUserHash(cfg);

  // Apply local DP (RAPPOR-style randomised response) to the category
  // label before egress, if configured. epsilon <= 0 disables it.
  const rawCategory = payload.category || 'unknown';
  const epsilon = Number(cfg.dpEpsilon);
  const dpEnabled = Number.isFinite(epsilon) && epsilon > 0;
  const emittedCategory = dpEnabled
    ? randomisedResponseCategory(rawCategory, epsilon)
    : rawCategory;

  const body = {
    // Metadata schema per docs/EXTENSION_SPEC.md §Reuse:
    // category, severity, action, timestamp, user_id_hash, session_id
    category: emittedCategory,
    severity: payload.severity || 'medium',
    action: payload.action || 'unknown', // edit | send_anyway | cancel
    score: payload.score ?? null,
    host: payload.host || null,
    timestamp: new Date().toISOString(),
    user_id_hash: userIdHash,
    session_id: SESSION_ID,
    campus_code: cfg.campusCode,
    ext_version: chrome.runtime.getManifest().version
  };

  if (dpEnabled) {
    body.dp_applied = true;
    body.dp_epsilon = epsilon;
  }

  if (!isMetadataOnly(body)) {
    console.error('[SendWise] Rejected non-metadata payload (contains text-like field).');
    return { ok: false, reason: 'contains-forbidden-field' };
  }

  try {
    const resp = await fetch(cfg.dashboardUrl.replace(/\/+$/, '') + '/api/violations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (resp.ok) await incrementCounter();
    return { ok: resp.ok, status: resp.status };
  } catch (e) {
    console.warn('[SendWise] POST failed:', e.message);
    return { ok: false, reason: 'network', error: e.message };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'violation') {
    postViolation(msg.payload || {}).then(sendResponse);
    return true; // async
  }
  if (msg && msg.type === 'is-enabled') {
    getConfig().then(cfg => sendResponse({
      enabled: cfg.enabled !== false || cfg.optOutAllowed === false
    }));
    return true;
  }
});
