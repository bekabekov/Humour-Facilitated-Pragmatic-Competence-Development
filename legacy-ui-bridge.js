// js/legacy-ui-bridge.js
// Safe, order-tolerant bridge: provides queue/state without overriding the real ModuleModal.

(function () {
    console.log('[legacy-ui-bridge] loaded');

    // Always keep a global queue for early calls
    window.__moduleModalQueue = window.__moduleModalQueue || [];

    // Ensure ModuleModal object and state exist
    window.ModuleModal = window.ModuleModal || {};
    window.ModuleModal.state = window.ModuleModal.state || { currentModule: null };

    // Do NOT override ModuleModal.show; module-learning.js owns the real implementation and will flush the queue.
})();
