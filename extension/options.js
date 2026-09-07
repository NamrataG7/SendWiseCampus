// SendWise Campus - options page
// Reads user (sync) + managed (MDM) config, shows telemetry toggle, live counter,
// model version, stable per-profile anonymous user hash, and college policy link.

const DEFAULTS = {
  dashboardUrl: '',
  campusCode: 'UNSET',
  collegePolicyUrl: '',
  enabled: true,
  eventsSent: 0,
  userIdHash: '',
  optOutAllowed: true,
  dpEpsilon: 1.0
};

async function getManaged() {
  try {
    if (chrome.storage && chrome.storage.managed) {
      return await chrome.storage.managed.get(null);
    }
  } catch (_) {}
  return {};
}

async function load() {
  const [cfg, managed] = await Promise.all([
    chrome.storage.sync.get(DEFAULTS),
    getManaged()
  ]);
  // Managed values override sync values (MDM wins).
  const merged = { ...DEFAULTS, ...cfg, ...managed };

  const managedBadge = document.getElementById('managedBadge');
  if (managed && Object.keys(managed).length > 0) managedBadge.style.display = 'inline-block';

  document.getElementById('dashboardUrl').value = merged.dashboardUrl || '';
  document.getElementById('campusCode').value = merged.campusCode || '';
  document.getElementById('collegePolicyUrl').value = merged.collegePolicyUrl || '';
  const epsField = document.getElementById('dpEpsilon');
  if (epsField) {
    epsField.value = merged.dpEpsilon != null ? String(merged.dpEpsilon) : '1.0';
    // MDM-managed epsilon locks the field so campus policy is enforced.
    if (managed && managed.dpEpsilon != null) epsField.disabled = true;
  }

  const enabledBox = document.getElementById('enabled');
  enabledBox.checked = merged.enabled !== false;
  document.getElementById('enabledLabel').textContent = enabledBox.checked ? 'Enabled' : 'Disabled';

  const optOutAllowed = merged.optOutAllowed !== false;
  if (!optOutAllowed) {
    enabledBox.disabled = true;
    document.getElementById('optOutNote').style.display = 'inline';
  }

  document.getElementById('counter').textContent = String(merged.eventsSent || 0);

  const policyLink = document.getElementById('policyLink');
  if (merged.collegePolicyUrl) {
    policyLink.href = merged.collegePolicyUrl;
  } else {
    policyLink.textContent = '(no policy URL configured)';
  }

  document.getElementById('extVersion').textContent = chrome.runtime.getManifest().version;

  // Model version — read the shipped model card if present.
  try {
    const url = chrome.runtime.getURL('vendor/models/MODEL_CARD.json');
    const resp = await fetch(url);
    if (resp.ok) {
      const card = await resp.json();
      document.getElementById('modelVersion').textContent = card.version || card.model_version || 'unknown';
    }
  } catch (_) {
    document.getElementById('modelVersion').textContent = 'unavailable';
  }

  // Stable per-profile anonymous user hash. Generated once, kept in sync storage.
  let userIdHash = merged.userIdHash;
  if (!userIdHash) {
    userIdHash = await generateStableHash();
    await chrome.storage.sync.set({ userIdHash });
  }
  document.getElementById('userHash').textContent = userIdHash.slice(0, 16) + '…';
}

async function generateStableHash() {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function save() {
  const enabled = document.getElementById('enabled').checked;
  const dashboardUrl = document.getElementById('dashboardUrl').value.trim();
  const campusCode = document.getElementById('campusCode').value.trim() || 'UNSET';
  const collegePolicyUrl = document.getElementById('collegePolicyUrl').value.trim();
  const epsRaw = document.getElementById('dpEpsilon')?.value;
  const parsedEps = epsRaw === '' || epsRaw == null ? 1.0 : Number(epsRaw);
  const dpEpsilon = Number.isFinite(parsedEps) && parsedEps >= 0 && parsedEps <= 10
    ? parsedEps
    : 1.0;
  await chrome.storage.sync.set({
    dashboardUrl,
    campusCode,
    collegePolicyUrl,
    enabled,
    dpEpsilon
  });
  const s = document.getElementById('status');
  s.textContent = 'Saved.';
  setTimeout(() => (s.textContent = ''), 1500);
  document.getElementById('enabledLabel').textContent = enabled ? 'Enabled' : 'Disabled';
}

document.getElementById('save').addEventListener('click', save);
document.getElementById('resetCounter').addEventListener('click', async (e) => {
  e.preventDefault();
  await chrome.storage.sync.set({ eventsSent: 0 });
  document.getElementById('counter').textContent = '0';
});

// Live-refresh the counter when the background worker increments it.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.eventsSent) {
    document.getElementById('counter').textContent = String(changes.eventsSent.newValue || 0);
  }
});

load();
