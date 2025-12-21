/**
 * ROUTER MODULE
 *
 * Purpose: Handle navigation and routing between sections
 *
 * Responsibilities:
 * - Manage section navigation (showSection)
 * - Handle URL hash navigation
 * - Update breadcrumb navigation
 * - Manage navigation state
 * - Prevent race conditions during navigation
 *
 * Dependencies: State (for lastView persistence)
 * Used by: All navigation triggers (buttons, links, etc.)
 */

(function() {
    'use strict';

    // Shared navigation state so delegated actions can safely check/avoid race conditions
    // without depending on object construction order.
    const RouterState = window.RouterState = window.RouterState || { isNavigating: false };

    // ========================================
    // BREADCRUMB MODULE
    // ========================================
    const Breadcrumb = {
        sectionNames: {
            'home': 'Home',
            'guide': 'Learning Path',
            'placement': 'Placement Test',
            'progress': 'My Progress',
            'resources': 'Resources',
            'joke': 'Joke Library',
            'theory': 'Theory Reference',
            'activities': 'Activities',
            'quiz': 'Quizzes',
            'about': 'Settings',
            'teacherResources': 'Teacher Resources',
            'graduation': 'Graduation'
        },

        moduleNames: {
            'module-1': 'Module 1: First Steps in Pragmatics',
            'module-2': 'Module 2: Building Pragmatic Skills',
            'module-3': 'Module 3: Sharpening Your Pragmatic Edge',
            'module-4': 'Module 4: Pragmatic Mastery',
            'module-5': 'Module 5: Bridging Cultures',
            'module-6': 'Module 6: Analysing Humour: GTVH'
        },

        stepNames: ['Theory', 'Examples', 'Practice', 'Post-Test', 'Reflection'],

        currentModule: null,
        currentStep: null,

        /**
         * Update breadcrumb for module navigation
         * @param {string} moduleId - Module ID (e.g., 'module-1')
         * @param {number} stepIndex - Step index (0-4)
         */
        updateForModule: function(moduleId, stepIndex, options = {}) {
            this.currentModule = moduleId;
            this.currentStep = stepIndex;
            const nextStep = options.nextStep || null;
            const nextTime = options.nextTime || null;

            const container = document.getElementById('breadcrumb-nav');
            const content = document.getElementById('breadcrumb-content');
            const progressArea = document.getElementById('nav-progress-area');
            const progressDots = document.getElementById('progress-dots-content');

            if (!container || !content) return;

            // Show unified nav
            container.classList.remove('hidden');

            // Build module context
            const moduleName = this.moduleNames[moduleId] || moduleId;
            const stepName = this.stepNames[stepIndex] || `Step ${stepIndex + 1}`;

            content.replaceChildren();

            const moduleBadge = document.createElement('span');
            moduleBadge.className = 'module-badge';
            moduleBadge.textContent = moduleName;

            const stepIndicator = document.createElement('span');
            stepIndicator.className = 'step-indicator-text';
            stepIndicator.textContent = `Step ${stepIndex + 1} of ${this.stepNames.length}: ${stepName}`;

            content.appendChild(moduleBadge);
            content.appendChild(stepIndicator);

            if (nextStep) {
                const pill = document.createElement('span');
                pill.className = 'next-step-pill';
                const timePart = nextTime ? ` (~${nextTime})` : '';
                pill.textContent = `Next: ${nextStep}${timePart}`;
                content.appendChild(pill);
            }

            // Build progress dots
            if (progressArea && progressDots) {
                progressDots.replaceChildren();
                for (let i = 0; i < this.stepNames.length; i++) {
                    let className = '';
                    let symbol = '○';

                    if (i < stepIndex) {
                        className = 'step-completed';
                        symbol = '✓';
                    } else if (i === stepIndex) {
                        className = 'step-current';
                        symbol = '●';
                    } else {
                        className = 'step-pending';
                        symbol = '○';
                    }

                    const dot = document.createElement('span');
                    dot.className = className;
                    dot.textContent = `${symbol} ${this.stepNames[i]}`;
                    progressDots.appendChild(dot);
                    if (i !== this.stepNames.length - 1) {
                        progressDots.appendChild(document.createTextNode(' | '));
                    }
                }
                progressArea.style.display = 'flex';
            }
        },

        /**
         * Update breadcrumb for regular section navigation
         * @param {string} sectionId - Section ID (e.g., 'joke', 'quiz')
         */
        update: function(sectionId) {
            const container = document.getElementById('breadcrumb-nav');
            const content = document.getElementById('breadcrumb-content');
            const progressArea = document.getElementById('nav-progress-area');

            if (!container || !content) return;

            // Reset module context
            this.currentModule = null;
            this.currentStep = null;

            // Hide on home page
            if (sectionId === 'home') {
                container.classList.add('hidden');
                return;
            }

            // Show for other pages
            container.classList.remove('hidden');

            // Hide progress dots for non-module pages
            if (progressArea) {
                progressArea.style.display = 'none';
            }

            // Build breadcrumb
            const sectionName = this.sectionNames[sectionId] || sectionId;
            content.replaceChildren();

            const homeLink = document.createElement('a');
            homeLink.href = '#home';
            homeLink.className = 'breadcrumb-link';
            homeLink.textContent = 'Home';

            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '›';

            const current = document.createElement('span');
            current.className = 'breadcrumb-current';
            current.textContent = sectionName;

            content.appendChild(homeLink);
            content.appendChild(separator);
            content.appendChild(current);
        },

        /**
         * Clear breadcrumb
         */
        clear: function() {
            const container = document.getElementById('breadcrumb-nav');
            if (container) {
                container.classList.add('hidden');
            }
        }
    };

    // ========================================
    // NAVIGATION MODULE
    // ========================================
    const Navigation = {
        /**
         * Show a specific section
         * @param {string} sectionId - ID of the section to show
         * @param {Object} options - Navigation options
         * @param {boolean} options.skipHash - Skip updating URL hash
         */
        showSection: function(sectionId, options = {}) {
            // Prevent race condition on rapid navigation
            if (RouterState.isNavigating) {
                console.log('Navigation already in progress, skipping:', sectionId);
                return;
            }

            RouterState.isNavigating = true;
            console.log('Navigating to section:', sectionId);

            // Hide all sections and deactivate all nav buttons
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            document.querySelectorAll('#main-nav .nav-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            // Show target section
            const section = document.getElementById(sectionId);
            const button = document.querySelector(`[data-section="${sectionId}"]`);

            if (section) {
                section.classList.add('active');
                console.log('Section activated:', sectionId);

                if (button) {
                    button.classList.add('active');
                }

                // Update URL hash unless skipped
                if (!options.skipHash) {
                    history.replaceState(null, '', `#${sectionId}`);
                }

                // Update breadcrumb navigation
                Breadcrumb.update(sectionId);

                // Trigger section-specific initialization
                this.initializeSection(sectionId);

                // Save current view for session restoration
                try {
                    localStorage.setItem('lastView', sectionId);
                } catch (e) {
                    console.warn('Failed to save last view:', e);
                }
            } else {
                console.error('Section not found:', sectionId);
            }

            // Release navigation lock
            RouterState.isNavigating = false;
        },

        /**
         * Initialize section-specific features
         * @param {string} sectionId - Section ID
         */
        initializeSection: function(sectionId) {
            // Lazy-load and initialize sections as needed
            switch(sectionId) {
                case 'placement':
                    if (window.PlacementModule && typeof window.PlacementModule.init === 'function') {
                        window.PlacementModule.init();
                    }
                    break;
                case 'joke':
                    if (typeof JokeModule !== 'undefined' && JokeModule.ensureLoaded) {
                        JokeModule.ensureLoaded();
                    }
                    break;
                case 'activities':
                    if (typeof ActivitiesModule !== 'undefined' && ActivitiesModule.ensureRendered) {
                        ActivitiesModule.ensureRendered();
                    }
                    break;
                case 'progress':
                    if (typeof ProgressModule !== 'undefined' && ProgressModule.update) {
                        ProgressModule.update();
                    }
                    break;
                case 'guide':
                    if (typeof NavigationBanner !== 'undefined' && NavigationBanner.update) {
                        NavigationBanner.update();
                    }
                    if (typeof ModuleLearning !== 'undefined' && ModuleLearning.updateReviewReminders) {
                        ModuleLearning.updateReviewReminders();
                    }
                    break;
                case 'quiz':
                    if (typeof QuizModule !== 'undefined' && QuizModule.init) {
                        QuizModule.init();
                    }
                    break;
            }
        },

        /**
         * Handle hash-based navigation
         */
        handleHashNavigation: function() {
            const raw = window.location.hash || '';
            const hash = raw.replace('#', '');
            console.log('Handling hash navigation:', hash);

            if (!hash) {
                // Default to home
                this.showSection('home', { skipHash: true });
                return;
            }

            if (hash === 'module-learning') {
                this.showSection('module-learning', { skipHash: true });
                return;
            }

            // Check if it's a module hash
            const moduleIds = Array.isArray(window.LEARNING_SYSTEM?.modules)
                ? window.LEARNING_SYSTEM.modules.map(m => m.id)
                : [];
            const modulesLoaded = moduleIds.length > 0;

            if (hash.startsWith('module-')) {
                const isKnownModule = moduleIds.indexOf(hash) !== -1;

                if (!modulesLoaded || isKnownModule) {
                    this.showSection('guide', { skipHash: true });
                    if (typeof ModuleModal !== 'undefined') {
                        ModuleModal.show(hash);
                    } else {
                        console.warn('ModuleModal is not ready to open module hash', hash);
                    }
                } else {
                    console.warn('Hash module id not recognized:', hash, 'available modules:', moduleIds);
                    if (window.UI && window.UI.toast) {
                        window.UI.toast('That module is not available. Redirecting to the learning path.', 'warning');
                    }
                    this.showSection('guide', { skipHash: true });
                }
                return;
            }

            // Check if section exists
            const section = document.getElementById(hash);
            if (section && section.classList.contains('content-section')) {
                this.showSection(hash, { skipHash: true });
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                console.warn('Invalid hash, redirecting to home:', hash);
                this.showSection('home', { skipHash: false });
            }
        },

        /**
         * Restore last viewed section
         */
        restoreLastView: function() {
            try {
                const lastView = localStorage.getItem('lastView');
                if (lastView && lastView !== 'home') {
                    this.showSection(lastView);
                    return true;
                }
            } catch (e) {
                console.warn('Failed to restore last view:', e);
            }
            return false;
        }
    };

    // ========================================
    // NAVIGATION BANNER MODULE
    // ========================================
    const NavigationBanner = {
        currentRecommendation: null,

        /**
         * Get module name by ID
         * @param {string} moduleId - Module ID
         * @returns {string} Module name
         */
        getModuleName: function(moduleId) {
            return Breadcrumb.moduleNames[moduleId] || moduleId;
        },

        /**
         * Calculate module completion percentage
         * @param {string} moduleId - Module ID
         * @returns {number} Percentage (0-100)
         */
        calculateModuleProgress: function(moduleId) {
            if (!window.State || !window.State.moduleMastery) return 0;

            const moduleData = window.State.moduleMastery.modules[moduleId];
            if (!moduleData) return 0;

            const totalSections = 5;
            let completedSections = 0;

            if (moduleData.theory && moduleData.theory.completed) completedSections++;
            if (moduleData.jokes && moduleData.jokes.analyzed && moduleData.jokes.analyzed.length > 0) completedSections++;
            if (moduleData.activities && moduleData.activities.completed && moduleData.activities.completed.length > 0) completedSections++;
            if (moduleData.postTest && moduleData.postTest.completed) completedSections++;
            if (moduleData.reflection && moduleData.reflection.completed) completedSections++;

            return Math.round((completedSections / totalSections) * 100);
        },

        /**
         * Find last incomplete module
         * @returns {string|null} Module ID or null
         */
        findLastIncompleteModule: function() {
            if (!window.State || !window.State.moduleMastery) return null;

            const moduleOrder = ['module-1', 'module-2', 'module-3', 'module-4', 'module-5', 'module-6'];

            for (const moduleId of moduleOrder) {
                const moduleData = window.State.moduleMastery.modules[moduleId];

                if (moduleData && moduleData.unlocked && !moduleData.completed) {
                    return moduleId;
                }
            }

            return null;
        },

        /**
         * Check if all modules are complete
         * @returns {boolean} True if all complete
         */
        checkAllModulesComplete: function() {
            if (!window.State || !window.State.moduleMastery) return false;

            const moduleOrder = ['module-1', 'module-2', 'module-3', 'module-4', 'module-5', 'module-6'];

            return moduleOrder.every(moduleId => {
                const moduleData = window.State.moduleMastery.modules[moduleId];
                return moduleData && moduleData.completed;
            });
        },

        /**
         * Update navigation banner with recommendations
         */
        update: function() {
            const bannerContainer = document.getElementById('nav-recommendation-banner');
            if (!bannerContainer) return;

            const recommendation = this.generateRecommendation();
            if (recommendation) {
                const banner = document.createElement('div');
                banner.className = 'recommendation-banner';

                const content = document.createElement('div');
                content.className = 'recommendation-content';

                const icon = document.createElement('span');
                icon.className = 'recommendation-icon';
                icon.textContent = '→';

                const text = document.createElement('span');
                text.className = 'recommendation-text';
                text.textContent = recommendation.message;

                content.appendChild(icon);
                content.appendChild(text);

                const button = document.createElement('button');
                button.className = 'btn btn-primary';
                button.type = 'button';
                button.textContent = 'Continue Learning';
                button.addEventListener('click', () => Navigation.showSection('guide'));

                banner.appendChild(content);
                banner.appendChild(button);

                bannerContainer.replaceChildren(banner);
                bannerContainer.style.display = 'block';
            } else {
                bannerContainer.style.display = 'none';
            }
        },

        /**
         * Generate navigation recommendation
         * @returns {Object|null} Recommendation object
         */
        generateRecommendation: function() {
            const moduleId = this.findLastIncompleteModule();
            if (!moduleId) return null;

            const progress = this.calculateModuleProgress(moduleId);
            const moduleName = this.getModuleName(moduleId);

            return {
                type: 'continue-module',
                moduleId: moduleId,
                moduleName: moduleName,
                progress: progress,
                message: `Continue ${moduleName} (${progress}% complete)`
            };
        },


    };

    // ========================================
    // EXPOSE GLOBALLY
    // ========================================
    window.Navigation = Navigation;
    window.Breadcrumb = Breadcrumb;
    window.NavigationBanner = NavigationBanner;

    // Initialize hash navigation on load and hash change
    window.addEventListener('hashchange', () => Navigation.handleHashNavigation());

})();
