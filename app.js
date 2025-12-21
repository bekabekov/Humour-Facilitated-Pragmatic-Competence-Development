/**
 * APPLICATION INITIALIZATION MODULE
 *
 * Purpose: Initialize and coordinate all modules
 *
 * Responsibilities:
 * - Initialize all modules in correct order
 * - Set up global event listeners
 * - Handle DOMContentLoaded
 * - Coordinate between modules
 * - Set up navigation event handlers
 * - Initialize UI components
 *
 * Dependencies: All other modules (data, state, router, ui, assessment)
 * This is the main entry point of the application
 */

(function() {
    'use strict';

    // Global readiness gate for delegated actions (module cards, placement test, etc.).
    // Set to `true` only after the app finishes initializing without errors.
    window.APP_READY = false;
    window.APP_INIT_FAILED = false;

    // ========================================
    // TEACHER MODE CONTROLLER
    // ========================================
    const TeacherMode = {
        /**
         * Apply teacher mode preference to the UI and storage
         * @param {boolean} enabled - teacher mode state
         * @param {Object} options - control side effects
         */
        apply(enabled, options = {}) {
            const isOn = !!enabled;

            if (window.State) {
                window.State.teacherModeEnabled = isOn;
            }

            document.body.classList.toggle('teacher-mode', isOn);

            // If teacher content is hidden while active, return user to home
            if (!isOn) {
                const activeSection = document.querySelector('.content-section.active');
                if (activeSection && activeSection.id === 'teacherResources' && window.Navigation) {
                    window.Navigation.showSection('home');
                }
            }

            if (!options.skipToggleSync) {
                const toggle = document.getElementById('teacher-mode-toggle');
                if (toggle) {
                    toggle.checked = isOn;
                }
            }

            if (!options.skipActivityRender && window.ActivitiesModule && window.ActivitiesModule.rendered) {
                window.ActivitiesModule.render();
            }

            if (window.ScaffoldSettings) {
                window.ScaffoldSettings.teacherModeEnabled = isOn;
                window.ScaffoldSettings.updateTeacherModeUI();
            }

            if (!options.skipSave && window.Storage && window.Storage.saveTeacherMode) {
                window.Storage.saveTeacherMode(isOn);
            }

            return isOn;
        },

        /**
         * Initialize teacher mode UI controls
         */
        init() {
            const isEnabled = !!(window.State && window.State.teacherModeEnabled);
            this.apply(isEnabled, { skipSave: true });

            const toggle = document.getElementById('teacher-mode-toggle');
            if (toggle && !toggle.dataset.teacherModeBound) {
                toggle.checked = isEnabled;
                if (!toggle.getAttribute('onchange')) {
                    toggle.addEventListener('change', (e) => {
                        this.apply(e.target.checked);
                    });
                }
                toggle.dataset.teacherModeBound = 'true';
            }
        },

        /**
         * Toggle teacher mode and persist
         */
        toggle() {
            const nextValue = !(window.State && window.State.teacherModeEnabled);
            return this.apply(nextValue);
        }
    };

    // ========================================
    // APPLICATION INITIALIZATION
    // ========================================
    const App = {
        initialized: false,

        /**
         * Main initialization function
         */
        async init() {
            if (this.initialized) {
                console.warn('App already initialized');
                return;
            }

            console.log('🚀 Initializing application...');

            try {
                // Wait for data to load
                await this.waitForData();

                // Apply saved teacher mode before rendering modules
                TeacherMode.apply(window.State && window.State.teacherModeEnabled, {
                    skipActivityRender: true,
                    skipSave: true
                });

                // Initialize modules
                this.initializeModules();

                // Set up event listeners
                this.setupEventListeners();

                // Handle initial navigation
                this.handleInitialNavigation();

                // Show onboarding if needed
                // this.checkOnboarding(); // Disabled - users can manually trigger via "Restart Tutorial" button

                this.initialized = true;
                console.log('✓ Application initialized successfully');

                window.APP_READY = true;
                console.log('✅ APP_READY = true');

            } catch (error) {
                window.APP_INIT_FAILED = true;
                console.error('❌ Failed to initialize application:', error);
                this.handleInitializationError(error);
            }
        },

        /**
         * Wait for data to load
         */
        async waitForData() {
            if (!window.DataLoader || !window.DataLoader.loadAll) {
                throw new Error('DataLoader not available');
            }
            if (window.DataLoader.isLoaded) return window.DATA;
            if (window.DataLoader.isLoading) return window.DataLoader.loadAll();
            return window.DataLoader.loadAll();
        },

        /**
         * Initialize all modules
         */
        initializeModules() {
            console.log('Initializing modules...');

            // Initialize UI modules
            if (window.JokeModule) {
                window.JokeModule.init();
            }

            if (window.QuizModule) {
                window.QuizModule.init();
            }

            if (window.ProgressModule) {
                window.ProgressModule.update();
            }

            // Initialize navigation banner
            if (window.NavigationBanner) {
                window.NavigationBanner.update();
            }
        },

        /**
         * Set up all event listeners
         */
        setupEventListeners() {
            console.log('Setting up event listeners...');

            // Navigation buttons
            this.setupNavigationButtons();

            // Joke navigation
            this.setupJokeControls();

            // Quiz controls
            this.setupQuizControls();

            // Activity controls
            this.setupActivityControls();

            // Theme toggle
            this.setupThemeToggle();

            // Teacher mode toggle
            this.setupTeacherModeToggle();

            // Progress export/import
            this.setupProgressControls();
        },

        /**
         * Set up navigation buttons
         */
        setupNavigationButtons() {
            const navButtons = document.querySelectorAll('[data-section]');
            navButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const section = button.getAttribute('data-section');
                    if (window.Navigation && typeof window.Navigation.showSection === 'function') {
                        window.Navigation.showSection.call(window.Navigation, section);
                    }
                });
            });
        },

        /**
         * Set up joke navigation controls
         */
        setupJokeControls() {
            const nextBtn = document.getElementById('next-joke-btn');
            const prevBtn = document.getElementById('prev-joke-btn');
            const randomBtn = document.getElementById('random-joke-btn');
            const favoriteBtn = document.getElementById('joke-favorite-btn');

            console.log('[setupJokeControls] Buttons found:', {
                next: !!nextBtn,
                prev: !!prevBtn,
                random: !!randomBtn,
                favorite: !!favoriteBtn
            });

            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    console.log('[JOKE] Next button clicked');
                    if (window.JokeModule && typeof window.JokeModule.nextJoke === 'function') {
                        window.JokeModule.nextJoke.call(window.JokeModule);
                    } else {
                        console.error('[JOKE] JokeModule.nextJoke not available');
                    }
                });
            } else {
                console.warn('[setupJokeControls] next-joke-btn not found');
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    console.log('[JOKE] Previous button clicked');
                    if (window.JokeModule && typeof window.JokeModule.previousJoke === 'function') {
                        window.JokeModule.previousJoke.call(window.JokeModule);
                    }
                });
            }

            if (randomBtn) {
                randomBtn.addEventListener('click', () => {
                    console.log('[JOKE] Random button clicked');
                    if (window.JokeModule && typeof window.JokeModule.randomJoke === 'function') {
                        window.JokeModule.randomJoke.call(window.JokeModule);
                    }
                });
            }

            if (favoriteBtn) {
                favoriteBtn.addEventListener('click', () => {
                    console.log('[JOKE] Favorite button clicked');
                    if (window.JokeModule && typeof window.JokeModule.toggleFavorite === 'function') {
                        window.JokeModule.toggleFavorite.call(window.JokeModule);
                    }
                });
            }

            // Filter buttons for joke types
            const filterButtons = document.querySelectorAll('.filter-btn[data-joke-type]');
            console.log('[setupJokeControls] Filter buttons found:', filterButtons.length);

            filterButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const jokeType = btn.getAttribute('data-joke-type');
                    console.log('[JOKE] Filter button clicked:', jokeType);

                    // Update active state
                    filterButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Filter jokes by type
                    if (window.JokeModule && typeof window.JokeModule.filterByType === 'function') {
                        window.JokeModule.filterByType.call(window.JokeModule, jokeType);
                    }
                });
            });

            // Keyboard navigation for jokes
            document.addEventListener('keydown', (e) => {
                const activeSection = document.querySelector('.content-section.active');
                if (activeSection && activeSection.id === 'joke') {
                    if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
                        if (window.JokeModule && typeof window.JokeModule.nextJoke === 'function') {
                            window.JokeModule.nextJoke.call(window.JokeModule);
                        }
                    } else if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
                        if (window.JokeModule && typeof window.JokeModule.previousJoke === 'function') {
                            window.JokeModule.previousJoke.call(window.JokeModule);
                        }
                    }
                }
            });
        },

        /**
         * Set up quiz controls
         */
        setupQuizControls() {
            // Quiz controls are handled by onclick attributes in assessment.js
            // for simplicity, but could be refactored to event listeners here
        },

        /**
         * Set up activity controls
         */
        setupActivityControls() {
            const searchInput = document.getElementById('activity-search');
            if (searchInput) {
                const debounced = this.debounce((value) => {
                    this.filterActivities(value);
                }, 200);
                searchInput.addEventListener('input', (e) => {
                    debounced(e.target.value);
                });
            }
        },

        /**
         * Filter activities based on search term
         */
        filterActivities(searchTerm) {
            const cards = document.querySelectorAll('.activity-card');
            const term = searchTerm.toLowerCase();

            cards.forEach(card => {
                const titleEl = card.querySelector('h4');
                const descEl = card.querySelector('.activity-description');
                const taskEl = card.querySelector('.activity-task');

                const title = titleEl ? titleEl.textContent.toLowerCase() : '';
                const description = descEl ? descEl.textContent.toLowerCase() : '';
                const task = taskEl ? taskEl.textContent.toLowerCase() : '';

                if (title.includes(term) || description.includes(term) || task.includes(term)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        },

        /**
         * Simple debounce helper
         */
        debounce(fn, delay) {
            let timer = null;
            return function(...args) {
                clearTimeout(timer);
                timer = setTimeout(() => fn.apply(this, args), delay);
            };
        },

        /**
         * Set up theme toggle
         */
        setupThemeToggle() {
            const toggleBtn = document.getElementById('theme-toggle');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    window.ThemeManager && window.ThemeManager.toggle();
                });
            }
        },

        /**
         * Set up teacher mode toggle
         */
        setupTeacherModeToggle() {
            TeacherMode.init();
        },

        /**
         * Set up progress controls
         */
        setupProgressControls() {
            // Import progress
            const importBtn = document.getElementById('import-progress-btn');
            const importInput = document.getElementById('import-progress-input');

            if (importBtn && importInput) {
                importBtn.addEventListener('click', () => {
                    importInput.click();
                });

                importInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        window.Storage && window.Storage.importProgress(file);
                    }
                });
            }

            // Reset progress
            const resetBtn = document.getElementById('reset-progress-btn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    window.Storage && window.Storage.reset();
                });
            }
        },

        /**
         * Handle initial navigation
         */
        handleInitialNavigation() {
            // Check URL hash
            if (window.location.hash) {
                window.Navigation && window.Navigation.handleHashNavigation();
            } else {
                // Try to restore last view or show home
                const restored = window.Navigation && window.Navigation.restoreLastView();
                if (!restored) {
                    window.Navigation && window.Navigation.showSection('home');
                }
            }
        },

        /**
         * Check if onboarding should be shown
         */
        checkOnboarding() {
            if (window.State && !window.State.userProgress.onboardingComplete) {
                // Show onboarding after a short delay
                setTimeout(() => {
                    window.OnboardingModule && window.OnboardingModule.show();
                }, 500);
            }
        },

        /**
         * Handle initialization errors
         */
        handleInitializationError(error) {
            const errorDiv = document.createElement('div');
            const escapeHTML = (value) => {
                const temp = document.createElement('div');
                temp.textContent = value == null ? '' : String(value);
                return temp.innerHTML;
            };
            errorDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #fee;
                color: #c33;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                z-index: 10000;
                max-width: 500px;
                text-align: center;
            `;
            errorDiv.innerHTML = `
                <h2>⚠ Initialization Error</h2>
                <p>Failed to initialize the application. Please refresh the page.</p>
                <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    Error: ${escapeHTML(error && error.message)}
                </p>
                <button type="button" data-action="page-reload"
                        style="margin-top: 15px; padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Reload Page
                </button>
            `;
            document.body.appendChild(errorDiv);
        }
    };

    // ========================================
    // GLOBAL UTILITY FUNCTIONS
    // ========================================

    /**
     * Show a section (global function for backward compatibility)
     */
    window.showSection = function(sectionId) {
        if (window.Navigation) {
            window.Navigation.showSection(sectionId);
        }
    };

    /**
     * Go to next joke (global function)
     */
    window.nextJoke = function() {
        if (window.JokeModule) {
            window.JokeModule.nextJoke();
        }
    };

    /**
     * Go to previous joke (global function)
     */
    window.previousJoke = function() {
        if (window.JokeModule) {
            window.JokeModule.previousJoke();
        }
    };

    /**
     * Go to random joke (global function)
     */
    window.randomJoke = function() {
        if (window.JokeModule) {
            window.JokeModule.randomJoke();
        }
    };

    /**
     * Toggle joke favorite (global function)
     */
    window.toggleFavorite = function() {
        if (window.JokeModule) {
            window.JokeModule.toggleFavorite();
        }
    };

    /**
     * Select learning path (global function)
     */
    window.selectPath = function(pathType) {
        if (window.OnboardingModule) {
            window.OnboardingModule.selectPath(pathType);
        }
    };

    /**
     * Close onboarding (global function)
     */
    window.closeOnboarding = function() {
        if (window.OnboardingModule) {
            window.OnboardingModule.hide();
        }
    };

    /**
     * Onboarding navigation - next step
     */
    window.nextStep = function() {
        if (window.OnboardingModule) {
            window.OnboardingModule.nextStep();
        }
    };

    /**
     * Onboarding navigation - previous step
     */
    window.prevStep = function() {
        if (window.OnboardingModule) {
            window.OnboardingModule.prevStep();
        }
    };

    /**
     * Complete onboarding
     */
    window.completeOnboarding = function() {
        if (window.OnboardingModule) {
            window.OnboardingModule.complete();
        }
    };

    /**
     * Show onboarding modal
     */
    window.showOnboarding = function() {
        if (window.State) {
            window.State.userProgress.onboardingComplete = false;
            window.State.currentStep = 1;
        }
        document.querySelectorAll('.modal-step').forEach(function(step) {
            step.classList.remove('active');
        });
        const step1 = document.getElementById('step1');
        if (step1) step1.classList.add('active');
        if (window.OnboardingModule) {
            window.OnboardingModule.updateDots();
            window.OnboardingModule.show();
        }
    };

    /**
     * Start placement test from onboarding
     */
    window.startPlacementFromOnboarding = function() {
        if (window.OnboardingModule) {
            window.OnboardingModule.hide();
        }
        if (window.Navigation) {
            window.Navigation.showSection('placement');
        }
        if (window.PlacementModule) {
            window.PlacementModule.start();
        }
        if (window.State) {
            window.State.placementFromOnboarding = true;
        }
    };

    /**
     * Skip placement test
     */
    window.skipPlacementTest = function() {
        if (window.State) {
            window.State.userProgress.placementSkipped = true;
        }
        const summaryEl = document.getElementById('placement-result-summary');
        if (summaryEl) {
            summaryEl.textContent = 'Start exploring at your own pace';
        }
        const pathBox = document.getElementById('path-recommendations');
        if (pathBox) {
            const p = document.createElement('p');
            p.textContent = 'Explore all modules and find your level as you go!';
            pathBox.replaceChildren(p);
        }
        if (window.OnboardingModule) {
            window.OnboardingModule.showStep(4);
        }
    };

    /**
     * Skip welcome section
     */
    window.skipWelcome = function() {
        const homeSection = document.getElementById('home');
        const dashboardSection = document.getElementById('progress-dashboard');
        if (homeSection) {
            const heroSection = homeSection.querySelector('.home-hero');
            if (heroSection) heroSection.style.display = 'none';
        }
        if (dashboardSection) {
            dashboardSection.style.display = 'block';
        }
        if (window.State) {
            window.State.userProgress.welcomeSkipped = true;
            window.Storage.save();
        }
        if (window.ProgressDashboard && window.ProgressDashboard.render) {
            window.ProgressDashboard.render();
        }
    };

    /**
     * Continue learning from dashboard
     */
    window.continueLearning = function() {
        if (!window.State) return;

        const progress = window.State.userProgress;
        if (progress.lastViewedJoke) {
            window.Navigation && window.Navigation.showSection('joke');
        } else if (progress.lastViewedActivity) {
            window.Navigation && window.Navigation.showSection('activities');
        } else if (progress.currentModule) {
            window.Navigation && window.Navigation.showSection('guide');
        } else {
            window.Navigation && window.Navigation.showSection('guide');
        }
    };

    /**
     * Download certificate (placeholder)
     */
    window.downloadCertificate = function() {
        alert('Certificate download feature coming soon!');
    };

    /**
     * Share certificate (placeholder)
     */
    window.shareCertificate = function() {
        alert('Certificate sharing feature coming soon!');
    };

    /**
     * Show feedback form (placeholder)
     */
    window.showFeedbackForm = function() {
        alert('Feedback form coming soon!');
    };

    /**
     * Toggle teacher mode from inline UI
     */
    window.toggleTeacherMode = function() {
        return TeacherMode.toggle();
    };

    // Expose for debugging
    window.TeacherMode = TeacherMode;

    // ========================================
    // INITIALIZATION
    // ========================================

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOM loaded, initializing app...');
            App.init();
        });
    } else {
        // DOM already loaded
        console.log('DOM already loaded, initializing app immediately...');
        App.init();
    }

    // Expose App globally for debugging
    window.App = App;

})();
