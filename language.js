/**
 * Language Toggle Functionality
 * Handles switching between English and Uzbek languages
 */

(function() {
    'use strict';

    const STORAGE_KEY = 'preferredLanguage';
    const DEFAULT_LANG = 'en';

    // Initialize language on page load
    function initLanguage() {
        const savedLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
        setLanguage(savedLang);
        updateActiveButton(savedLang);
    }

    // Set the active language
    function setLanguage(lang) {
        if (lang === 'en') {
            // Show EN, hide UZ - but EXCLUDE html element
            document.querySelectorAll(':not(html)[lang="en"]').forEach(el => {
                el.style.display = 'block';
            });
            document.querySelectorAll(':not(html)[lang="uz"]').forEach(el => {
                el.style.display = 'none';
            });
        } else if (lang === 'uz') {
            // Show UZ, hide EN - but EXCLUDE html element
            document.querySelectorAll(':not(html)[lang="uz"]').forEach(el => {
                el.style.display = 'block';
            });
            document.querySelectorAll(':not(html)[lang="en"]').forEach(el => {
                el.style.display = 'none';
            });
        }

        // Save preference
        localStorage.setItem(STORAGE_KEY, lang);

        // Update HTML lang attribute (for accessibility)
        document.documentElement.lang = lang;
    }

    // Update active state of language buttons
    function updateActiveButton(lang) {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            if (btn.dataset.lang === lang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Setup event listeners for language buttons
    function setupEventListeners() {
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const selectedLang = this.dataset.lang;
                setLanguage(selectedLang);
                updateActiveButton(selectedLang);
            });
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setupEventListeners();
            initLanguage();
        });
    } else {
        setupEventListeners();
        initLanguage();
    }

})();
