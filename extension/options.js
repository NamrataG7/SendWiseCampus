const DEFAULTS = { dashboardUrl: '', campusCode: 'UNSET' };

async function load() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById('dashboardUrl').value = cfg.dashboardUrl || '';
  document.getElementById('campusCode').value = cfg.campusCode || '';
}

async function save() {
  const dashboardUrl = document.getElementById('dashboardUrl').value.trim();
  const campusCode = document.getElementById('campusCode').value.trim() || 'UNSET';
  await chrome.storage.sync.set({ dashboardUrl, campusCode });
  const s = document.getElementById('status');
  s.textContent = 'Saved.';
  setTimeout(() => (s.textContent = ''), 1500);
}

document.getElementById('save').addEventListener('click', save);
load();
