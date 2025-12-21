/**
 * DEV BOOTSTRAP
 *
 * Loads dev-only tooling only when the URL includes `?dev=1` (or `&dev=1`).
 * Kept as a separate file to avoid inline scripts (CSP-compatible).
 */

(function() {
    'use strict';

    try {
        const params = new URLSearchParams(window.location.search || '');
        if (params.get('dev') !== '1') return;

        const script = document.createElement('script');
        script.src = 'js/dev-guardrails.js';
        // Do not auto-enable dev mode; guardrails still require window.__DEV__ === true.
        script.async = false;
        document.head.appendChild(script);
    } catch (e) {
        // Dev-only; ignore failures.
        console.warn('[DEV BOOTSTRAP] Failed to load dev guardrails:', e);
    }
})();

