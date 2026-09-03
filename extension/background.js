// SendWise Campus - background service worker
// Metadata-only violation reporting. Strictly rejects any payload containing message text.

const FORBIDDEN_FIELDS = ['text', 'content', 'message', 'body', 'raw', 'transcript'];
const DEFAULTS = { dashboardUrl: '', campusCode: 'UNSET' };

function isMetadataOnly(payload) {
  if (!payload || typeof payload !== 'object') return false;
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN_FIELDS.includes(key.toLowerCase())) return false;
    const v = payload[key];
    if (v && typeof v === 'object' && !isMetadataOnly(v)) return false;
  }
  return true;
}

async function getConfig() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...cfg };
}

async function postViolation(payload) {
  const { dashboardUrl, campusCode } = await getConfig();
  if (!dashboardUrl) {
    console.warn('[SendWise] dashboardUrl not configured; dropping violation');
    return { ok: false, reason: 'no-dashboard-url' };
  }
  const body = {
    ...payload,
    campusCode,
    reportedAt: new Date().toISOString(),
    extVersion: chrome.runtime.getManifest().version
  };
  if (!isMetadataOnly(body)) {
    console.error('[SendWise] Rejected non-metadata payload (contains text-like field).');
    return { ok: false, reason: 'contains-forbidden-field' };
  }
  try {
    const resp = await fetch(dashboardUrl.replace(/\/+$/, '') + '/api/violations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
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
});
