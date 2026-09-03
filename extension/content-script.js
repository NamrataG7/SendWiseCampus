// SendWise Campus - content script
// Attaches to editable fields, intercepts send/submit, runs local analyzer,
// shows shadow-DOM warning modal. Text NEVER leaves the browser.

(function () {
  'use strict';

  const MAX_CHARS = 500;
  const SELECTOR = 'textarea, input[type="text"], [contenteditable="true"], [contenteditable=""]';

  function getText(el) {
    if (!el) return '';
    if (el.isContentEditable) return (el.innerText || '').slice(0, MAX_CHARS);
    return (el.value || '').slice(0, MAX_CHARS);
  }

  function runAnalyzer(text) {
    try {
      const lib = (self.SafeKeyboardDetection || window.SafeKeyboardDetection);
      if (lib && typeof lib.analyze === 'function') {
        return lib.analyze(text, 'medium');
      }
      // Fallback: use ToxicityAnalyzer directly if present
      const TA = self.ToxicityAnalyzer || window.ToxicityAnalyzer;
      if (TA && typeof TA.analyze === 'function') return TA.analyze(text, 'medium');
    } catch (e) {
      console.warn('[SendWise] analyzer error', e);
    }
    return { flagged: false };
  }

  function isFlagged(r) {
    if (!r) return false;
    return !!(r.flagged || r.shouldWarn || (r.severity && r.severity !== 'none' && r.severity !== 'low') || (typeof r.toxicityScore === 'number' && r.toxicityScore >= 0.5));
  }

  let overlayHost = null;
  function closeOverlay() {
    if (overlayHost && overlayHost.parentNode) overlayHost.parentNode.removeChild(overlayHost);
    overlayHost = null;
  }

  function showWarning(result, onEdit, onContinue) {
    closeOverlay();
    overlayHost = document.createElement('div');
    overlayHost.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
    const shadow = overlayHost.attachShadow({ mode: 'closed' });

    const category = (result && (result.category || result.topCategory)) || 'Potentially harmful';
    const severity = (result && result.severity) || 'medium';

    shadow.innerHTML = `
      <style>
        .sw-backdrop { position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
        .sw-modal { background:#fff; max-width:420px; width:90%; border-radius:12px; padding:20px 22px; box-shadow:0 10px 40px rgba(0,0,0,.3); }
        .sw-title { font-size:18px; font-weight:600; margin:0 0 8px; color:#b00020; }
        .sw-msg { font-size:14px; color:#222; margin:0 0 14px; line-height:1.4; }
        .sw-meta { font-size:12px; color:#555; margin:0 0 16px; }
        .sw-row { display:flex; gap:10px; justify-content:flex-end; }
        .sw-btn { border:0; border-radius:8px; padding:8px 14px; font-size:14px; cursor:pointer; }
        .sw-edit { background:#1a73e8; color:#fff; }
        .sw-continue { background:#eee; color:#222; }
      </style>
      <div class="sw-backdrop" part="backdrop">
        <div class="sw-modal" role="dialog" aria-modal="true">
          <p class="sw-title">Think Before You Send</p>
          <p class="sw-msg">Your message may contain content that could be harmful or offensive. Would you like to reconsider?</p>
          <p class="sw-meta">Category: ${String(category)} &middot; Severity: ${String(severity)}</p>
          <div class="sw-row">
            <button class="sw-btn sw-continue" id="sw-continue">Send Anyway</button>
            <button class="sw-btn sw-edit" id="sw-edit">Edit Message</button>
          </div>
        </div>
      </div>
    `;
    document.documentElement.appendChild(overlayHost);
    shadow.getElementById('sw-edit').addEventListener('click', () => { closeOverlay(); onEdit && onEdit(); });
    shadow.getElementById('sw-continue').addEventListener('click', () => { closeOverlay(); onContinue && onContinue(); });
  }

  function reportViolation(result) {
    // METADATA ONLY. Never include text.
    const payload = {
      category: (result && (result.category || result.topCategory)) || 'unknown',
      severity: (result && result.severity) || 'medium',
      score: (result && (result.toxicityScore || result.score)) || null,
      host: location.hostname,
      userChoice: 'send_anyway'
    };
    try { chrome.runtime.sendMessage({ type: 'violation', payload }); } catch (e) {}
  }

  let lastActive = null;

  function handleIntercept(e) {
    const target = e.target;
    // Locate the nearest editable
    const editable = (lastActive && document.activeElement === lastActive) ? lastActive
      : (target && target.closest && target.closest(SELECTOR));
    if (!editable) return;
    const text = getText(editable);
    if (!text || text.trim().length < 2) return;
    const result = runAnalyzer(text);
    if (!isFlagged(result)) return;

    // Block original action
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

    showWarning(result,
      () => { editable.focus && editable.focus(); },
      () => {
        reportViolation(result);
        // Re-dispatch a synthetic submission event on the original target
        if (e.type === 'keydown') {
          // Let user re-press Enter; simplest approach for academic scope
        } else if (target && typeof target.click === 'function') {
          // temporarily disable interceptor by marking
          target.__sendwiseBypass = true;
          target.click();
        }
      }
    );
  }

  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.matches && e.target.matches(SELECTOR)) lastActive = e.target;
  }, true);

  // Enter-to-send interception
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    const el = e.target;
    if (!el || !el.matches || !el.matches(SELECTOR)) return;
    handleIntercept(e);
  }, true);

  // Click-to-send interception (best-effort on submit-like buttons)
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || t.__sendwiseBypass) { if (t) t.__sendwiseBypass = false; return; }
    const btn = t.closest && t.closest('button, [role="button"], input[type="submit"]');
    if (!btn) return;
    const label = ((btn.innerText || btn.value || btn.getAttribute('aria-label') || '') + '').toLowerCase();
    if (!/send|post|tweet|reply|submit/.test(label)) return;
    handleIntercept(e);
  }, true);
})();
