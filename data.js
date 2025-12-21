/**
 * DATA LOADER MODULE
 *
 * Purpose: Load all JSON data files and expose them via window.DATA
 *
 * Responsibilities:
 * - Fetch JSON files asynchronously
 * - Handle loading errors gracefully
 * - Provide loading state indicators
 * - Expose data globally for other modules
 *
 * Dependencies: None (first module to load)
 * Used by: All other modules that need access to jokes, activities, quizzes, modules, etc.
 */

(function() {
    'use strict';

    function stripC1Controls(value) {
        if (typeof value !== 'string') return value;
        return value.replace(/[\u0080-\u009F]/g, '');
    }

    function sanitizeDeep(value) {
        if (typeof value === 'string') return stripC1Controls(value);
        if (Array.isArray(value)) return value.map(sanitizeDeep);
        if (value && typeof value === 'object') {
            for (const [key, childValue] of Object.entries(value)) {
                value[key] = sanitizeDeep(childValue);
            }
            return value;
        }
        return value;
    }

    function escapeHTML(value) {
        const temp = document.createElement('div');
        temp.textContent = value == null ? '' : String(value);
        return temp.innerHTML;
    }

    // Data loader with caching
    const DataLoader = {
        // Cache for loaded data
        cache: {},

        // Loading state
        isLoading: false,
        isLoaded: false,
        loadError: null,

        /**
         * Load a single JSON file
         * @param {string} path - Path to JSON file
         * @returns {Promise} Promise that resolves with the data
         */
        async loadJSON(path) {
            if (this.cache[path]) {
                return this.cache[path];
            }

            try {
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText} - Cannot find ${path}`);
                }
                const data = sanitizeDeep(await response.json());
                this.cache[path] = data;
                console.log(`✓ Loaded: ${path}`);
                return data;
            } catch (error) {
                console.error(`❌ Error loading ${path}:`, error);
                throw new Error(`Failed to load ${path}: ${error.message}`);
            }
        },

        /**
         * Load all data files
         * @returns {Promise} Promise that resolves when all data is loaded
         */
        async loadAll() {
            if (this.isLoaded) {
                return window.DATA;
            }

            if (this.isLoading) {
                // Wait for current loading to complete
                return new Promise((resolve) => {
                    const checkInterval = setInterval(() => {
                        if (!this.isLoading) {
                            clearInterval(checkInterval);
                            resolve(window.DATA);
                        }
                    }, 100);
                });
            }

            this.isLoading = true;
            this.loadError = null;

            try {
                // Load all JSON files in parallel
              const [jokes, activities, quizzes, modules, placementTest] = await Promise.all([
    this.loadJSON('data/jokes.json'),
    this.loadJSON('data/activities.json'),
    this.loadJSON('data/quizzes.json'),
    this.loadJSON('data/modules.json'),
    this.loadJSON('data/placement-test.json')
]);
                // Expose data globally
                window.DATA = {
                    jokes: jokes,
                    activities: activities,
                    quizzes: quizzes,
                    modules: modules,
                    placementTest: placementTest,

                    // Helper methods
                    getJokesByLevel: function(level) {
                        return this.jokes.filter(joke => joke.level === level);
                    },

                    getJokesByType: function(type) {
                        return this.jokes.filter(joke => joke.type === type);
                    },

                    getActivitiesByLevel: function(level) {
                        return this.activities.filter(activity => activity.level === level);
                    },

                    getModuleById: function(id) {
                        return this.modules.find(module => module.id === id);
                    }
                };

                // Also expose LEARNING_SYSTEM for backward compatibility
                window.LEARNING_SYSTEM = {
                    placementTest: placementTest,
                    modules: modules,
                    jokes: jokes,
                    activities: activities
                };

                this.isLoaded = true;
                this.isLoading = false;

                console.log('✓ Data loaded successfully:', {
                    jokes: jokes.length,
                    activities: activities.length,
                    modules: modules.length
                });

                return window.DATA;

            } catch (error) {
                this.loadError = error;
                this.isLoading = false;
                console.error('Failed to load data:', error);

                // Create empty data structure to prevent errors
                window.DATA = {
                    jokes: [],
                    activities: [],
                    quizzes: { beginner: [], intermediate: [], advanced: [] },
                    modules: [],
                    placementTest: { questions: [] }
                };

                throw error;
            }
        },

        /**
         * Reload all data (clears cache)
         * @returns {Promise} Promise that resolves when data is reloaded
         */
        async reload() {
            this.cache = {};
            this.isLoaded = false;
            return this.loadAll();
        }
    };

    // Expose DataLoader globally
    window.DataLoader = DataLoader;

    // Auto-load data when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            DataLoader.loadAll().catch(error => {
                console.error('Failed to initialize data:', error);

                // Show detailed error banner
                const errorBanner = document.createElement('div');
                errorBanner.id = 'data-load-error';
                errorBanner.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                    color: #991b1b;
                    padding: 20px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    z-index: 10000;
                    border-bottom: 3px solid #dc2626;
                    font-family: system-ui, sans-serif;
                `;

                errorBanner.innerHTML = `
                    <div style="max-width: 1200px; margin: 0 auto;">
                        <div style="display: flex; align-items: start; gap: 16px;">
                            <div style="font-size: 2.5rem;">⚠️</div>
                            <div style="flex: 1;">
                                <h2 style="margin: 0 0 8px 0; font-size: 1.5rem; font-weight: 700;">
                                    Data Loading Failed
                                </h2>
                                <p style="margin: 0 0 12px 0; font-size: 1rem; line-height: 1.5;">
                                    <strong>Error:</strong> ${escapeHTML(error.message || 'Unknown error')}
                                </p>
                                <details style="margin: 12px 0; padding: 12px; background: rgba(255,255,255,0.5); border-radius: 6px; cursor: pointer;">
                                    <summary style="font-weight: 600; cursor: pointer;">🔍 Technical Details</summary>
                                    <div style="margin-top: 8px; font-family: monospace; font-size: 0.9rem; color: #7f1d1d;">
                                        <p><strong>File paths expected:</strong></p>
                                        <ul style="margin: 8px 0; padding-left: 20px;">
                                            <li>data/jokes.json</li>
                                            <li>data/activities.json</li>
                                            <li>data/quizzes.json</li>
                                            <li>data/modules.json</li>
                                            <li>data/placement-test.json</li>
                                        </ul>
                                        <p style="margin-top: 8px;"><strong>Error stack:</strong></p>
                                        <pre style="background: #7f1d1d; color: #fecaca; padding: 8px; border-radius: 4px; overflow-x: auto; font-size: 0.85rem;">${escapeHTML(error.stack || error.message)}</pre>
                                    </div>
                                </details>
                                <div style="display: flex; gap: 12px; margin-top: 16px;">
                                    <button type="button" data-action="page-reload" style="
                                        background: #dc2626;
                                        color: white;
                                        border: none;
                                        padding: 10px 20px;
                                        border-radius: 6px;
                                        font-weight: 600;
                                        cursor: pointer;
                                        font-size: 1rem;
                                    ">
                                        🔄 Retry (Reload Page)
                                    </button>
                                    <button type="button" data-action="dismiss-by-id" data-target-id="data-load-error" style="
                                        background: transparent;
                                        color: #991b1b;
                                        border: 2px solid #991b1b;
                                        padding: 10px 20px;
                                        border-radius: 6px;
                                        font-weight: 600;
                                        cursor: pointer;
                                        font-size: 1rem;
                                    ">
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                document.body.appendChild(errorBanner);
            });
        });
    } else {
        DataLoader.loadAll();
    }

})();
