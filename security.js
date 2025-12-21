/**
 * SECURITY HELPERS
 *
 * Small shared helpers to avoid XSS when rendering dynamic strings into HTML.
 */

(function() {
    'use strict';

    function escapeHTML(value) {
        const temp = document.createElement('div');
        temp.textContent = value == null ? '' : String(value);
        return temp.innerHTML;
    }

    function isPlainObject(value) {
        if (!value || typeof value !== 'object') return false;
        const proto = Object.getPrototypeOf(value);
        return proto === Object.prototype || proto === null;
    }

    window.escapeHTML = window.escapeHTML || escapeHTML;
    window.Security = window.Security || {};
    window.Security.escapeHTML = window.Security.escapeHTML || escapeHTML;
    window.Security.isPlainObject = window.Security.isPlainObject || isPlainObject;
})();

