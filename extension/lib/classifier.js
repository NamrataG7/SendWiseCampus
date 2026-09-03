/**
 * SendWise Campus - thin classifier loader.
 *
 * Loads the exported Random Forest weights JSON produced by the SendWise
 * training pipeline. Pure JS - intentionally no TF.js dependency for the
 * academic prototype scope.
 *
 * The training exports are stored gzipped at vendor/models/*.json.gz. The
 * loader tries plain .json first (if provided by build), else .json.gz.
 *
 * For the initial academic build, the JS detection library
 * (SafeKeyboardDetection) is the primary classifier. This loader exposes
 * the RF weights as an optional secondary scorer for evaluation.
 */
(function () {
  'use strict';

  const MODEL_BASE = 'vendor/models/';
  const RF_FILE = 'sendwise_rf_v1.json';
  const RF_FILE_GZ = 'sendwise_rf_v1.json.gz';
  const CAT_FILE = 'sendwise_category_v1.json';
  const CAT_FILE_GZ = 'sendwise_category_v1.json.gz';

  async function fetchJson(path) {
    const url = chrome.runtime.getURL(path);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('load failed: ' + path);
    if (path.endsWith('.gz')) {
      // Use DecompressionStream where available.
      if (typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('gzip');
        const stream = resp.body.pipeThrough(ds);
        const text = await new Response(stream).text();
        return JSON.parse(text);
      }
      throw new Error('gzip decompression unavailable');
    }
    return resp.json();
  }

  const Classifier = {
    _rf: null,
    _cat: null,

    async load() {
      if (this._rf && this._cat) return;
      try { this._rf = await fetchJson(MODEL_BASE + RF_FILE); }
      catch (_) { try { this._rf = await fetchJson(MODEL_BASE + RF_FILE_GZ); } catch (e) { console.warn('[SendWise] RF model not loaded:', e.message); } }
      try { this._cat = await fetchJson(MODEL_BASE + CAT_FILE); }
      catch (_) { try { this._cat = await fetchJson(MODEL_BASE + CAT_FILE_GZ); } catch (e) { console.warn('[SendWise] Category model not loaded:', e.message); } }
    },

    // Placeholder scorer: real feature extraction lives in the training
    // pipeline. For academic scope we only expose the loaded metadata so the
    // detection library remains the primary signal.
    ready() { return !!(this._rf || this._cat); },
    meta() { return { rf: !!this._rf, category: !!this._cat }; }
  };

  (self || window).SendWiseClassifier = Classifier;
})();
