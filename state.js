/**
 * STATE MANAGEMENT MODULE
 *
 * Purpose: Manage application state and localStorage persistence
 *
 * Responsibilities:
 * - Track user progress (jokes read, activities completed, quiz scores)
 * - Manage current state (current joke, filters, etc.)
 * - Handle localStorage operations (save/load/reset)
 * - Manage theme and preferences
 *
 * Dependencies: None
 * Used by: All modules that need to track or modify state
 */

(function() {
    'use strict';

    // ========================================
    // STATE OBJECT
    // ========================================
    const State = {
        // Current viewing state
        currentJokeIndex: 0,
        currentQuizLevel: 'all',
        currentQuizAnswers: [],
        currentStep: 1,
        teacherModeEnabled: false,

        // Filters
        filters: {
            level: 'all',
            difficulty: 'all',
            search: '',
            jokeType: 'all'
        },

        // User progress tracking
        userProgress: {
            jokesRead: [],
            activitiesCompleted: [],
            quizScores: [],
            favoriteJokes: [],
            jokeNotes: {},
            activityNotes: {},
            learningPath: null,
            onboardingComplete: false,
            hasVisitedBefore: false,
            placementCompleted: false
        },

        // Module mastery tracking (for learning system)
        moduleMastery: {
            placementTest: {
                completed: false,
                score: null,
                recommendedModule: null,
                dateTaken: null
            },
            modules: {}
        },

        /**
         * Initialize module mastery for all modules
         */
        initModuleMastery: function() {
            if (window.LEARNING_SYSTEM && window.LEARNING_SYSTEM.modules) {
                window.LEARNING_SYSTEM.modules.forEach(module => {
                    if (!this.moduleMastery.modules[module.id]) {
                        this.moduleMastery.modules[module.id] = {
                            unlocked: module.id === 'module-1', // First module always unlocked
                            started: false,
                            completed: false,
                            preTest: { completed: false, score: null, answers: [] },
                            theory: { completed: false, sectionsRead: [] },
                            jokes: { analyzed: [], notes: {} },
                            activities: { completed: [], notes: {} },
                            postTest: { completed: false, score: null, answers: [] },
                            reflection: { completed: false, responses: {} },
                            masteryScore: 0,
                            masteryAchieved: false,
                            timeSpent: 0,
                            lastAccessed: null,
                            completionDate: null
                        };
                    }
                });
            }
        }
    };

    // ========================================
    // STORAGE MODULE
    // ========================================
    const Storage = {
        STORAGE_KEY: 'pragmaticsProgress',
        MASTERY_KEY: 'pragmaticsMastery',
        lastSaveToast: 0,
        IMPORT_MAX_BYTES: 50 * 1024,
        IMPORT_MAX_ARRAY_ITEMS: 5000,
        IMPORT_MAX_NOTE_KEYS: 5000,
        IMPORT_MAX_NOTE_LENGTH: 2000,
        IMPORT_MAX_KEY_LENGTH: 200,
        SUPPORTED_IMPORT_VERSIONS: new Set(['1', '1.0']),

        isPlainObject: function(value) {
            if (!value || typeof value !== 'object') return false;
            const proto = Object.getPrototypeOf(value);
            return proto === Object.prototype || proto === null;
        },

        safeToast: function(message, type = 'info') {
            if (window.UI && typeof window.UI.toast === 'function') {
                window.UI.toast(message, type);
                return;
            }
            if (type === 'error') {
                console.error(message);
            } else {
                console.log(message);
            }
        },

        validateUserProgress: function(raw) {
            const safe = {
                jokesRead: [],
                activitiesCompleted: [],
                quizScores: [],
                favoriteJokes: [],
                jokeNotes: {},
                activityNotes: {},
                learningPath: null,
                onboardingComplete: false,
                hasVisitedBefore: false,
                placementCompleted: false
            };

            if (!this.isPlainObject(raw)) return safe;

            const clampArray = (arr, max) => Array.isArray(arr) ? arr.slice(0, max) : [];
            const clampString = (value, maxLen) => {
                if (typeof value !== 'string') return null;
                return value.length <= maxLen ? value : value.slice(0, maxLen);
            };

            const numbers = clampArray(raw.jokesRead, this.IMPORT_MAX_ARRAY_ITEMS)
                .filter(n => Number.isFinite(n) && Number.isInteger(n) && n >= 0 && n <= 100000);
            safe.jokesRead = numbers;

            safe.activitiesCompleted = clampArray(raw.activitiesCompleted, this.IMPORT_MAX_ARRAY_ITEMS)
                .filter(v => typeof v === 'string')
                .map(v => v.slice(0, this.IMPORT_MAX_KEY_LENGTH));

            safe.quizScores = clampArray(raw.quizScores, this.IMPORT_MAX_ARRAY_ITEMS)
                .filter(n => Number.isFinite(n))
                .map(n => Math.max(0, Math.min(100, Math.round(n))));

            safe.favoriteJokes = clampArray(raw.favoriteJokes, this.IMPORT_MAX_ARRAY_ITEMS)
                .filter(n => Number.isFinite(n) && Number.isInteger(n) && n >= 0 && n <= 100000);

            const copyNotes = (source) => {
                const notes = {};
                if (!this.isPlainObject(source)) return notes;
                const entries = Object.entries(source).slice(0, this.IMPORT_MAX_NOTE_KEYS);
                for (const [key, value] of entries) {
                    if (typeof key !== 'string') continue;
                    if (key.length > this.IMPORT_MAX_KEY_LENGTH) continue;
                    if (typeof value !== 'string') continue;
                    notes[key] = value.length <= this.IMPORT_MAX_NOTE_LENGTH
                        ? value
                        : value.slice(0, this.IMPORT_MAX_NOTE_LENGTH);
                }
                return notes;
            };

            safe.jokeNotes = copyNotes(raw.jokeNotes);
            safe.activityNotes = copyNotes(raw.activityNotes);

            const learningPath = clampString(raw.learningPath, 64);
            safe.learningPath = learningPath == null ? null : learningPath;

            safe.onboardingComplete = raw.onboardingComplete === true;
            safe.hasVisitedBefore = raw.hasVisitedBefore === true;
            safe.placementCompleted = raw.placementCompleted === true;

            return safe;
        },

        buildDefaultModuleMastery: function() {
            const defaults = {
                placementTest: {
                    completed: false,
                    score: null,
                    recommendedModule: null,
                    dateTaken: null
                },
                modules: {}
            };

            const moduleIds = Array.isArray(window.LEARNING_SYSTEM && window.LEARNING_SYSTEM.modules)
                ? window.LEARNING_SYSTEM.modules.map(module => module.id)
                : Object.keys(State.moduleMastery && State.moduleMastery.modules ? State.moduleMastery.modules : {});

            moduleIds.forEach((moduleId) => {
                defaults.modules[moduleId] = {
                    unlocked: moduleId === 'module-1',
                    started: false,
                    completed: false,
                    preTest: { completed: false, score: null, answers: [] },
                    theory: { completed: false, sectionsRead: [] },
                    jokes: { analyzed: [], notes: {} },
                    activities: { completed: [], notes: {} },
                    postTest: { completed: false, score: null, answers: [] },
                    reflection: { completed: false, responses: {} },
                    masteryScore: 0,
                    masteryAchieved: false,
                    timeSpent: 0,
                    lastAccessed: null,
                    completionDate: null
                };
            });

            return defaults;
        },

        validateModuleMastery: function(raw) {
            const safe = this.buildDefaultModuleMastery();
            if (!this.isPlainObject(raw)) return safe;

            if (this.isPlainObject(raw.placementTest)) {
                const placement = raw.placementTest;
                safe.placementTest.completed = placement.completed === true;
                safe.placementTest.score = Number.isFinite(placement.score)
                    ? Math.max(0, Math.min(100, Math.round(placement.score)))
                    : null;
                safe.placementTest.recommendedModule = typeof placement.recommendedModule === 'string'
                    ? placement.recommendedModule.slice(0, this.IMPORT_MAX_KEY_LENGTH)
                    : null;
                safe.placementTest.dateTaken = Number.isFinite(placement.dateTaken)
                    ? placement.dateTaken
                    : null;
            }

            if (!this.isPlainObject(raw.modules)) return safe;

            const clampArray = (arr, max) => Array.isArray(arr) ? arr.slice(0, max) : [];
            const clampScore = (value) => Number.isFinite(value)
                ? Math.max(0, Math.min(100, Math.round(value)))
                : null;

            Object.keys(safe.modules).forEach((moduleId) => {
                const source = raw.modules[moduleId];
                if (!this.isPlainObject(source)) return;

                const target = safe.modules[moduleId];
                target.unlocked = source.unlocked === true || moduleId === 'module-1';
                target.started = source.started === true;
                target.completed = source.completed === true;

                const masteryScore = clampScore(source.masteryScore);
                if (masteryScore !== null) {
                    target.masteryScore = masteryScore;
                }
                target.masteryAchieved = source.masteryAchieved === true;
                target.timeSpent = Number.isFinite(source.timeSpent) ? Math.max(0, source.timeSpent) : target.timeSpent;
                target.lastAccessed = typeof source.lastAccessed === 'string'
                    ? source.lastAccessed.slice(0, 64)
                    : target.lastAccessed;
                target.completionDate = Number.isFinite(source.completionDate) ? source.completionDate : target.completionDate;

                if (this.isPlainObject(source.preTest)) {
                    target.preTest.completed = source.preTest.completed === true;
                    target.preTest.score = clampScore(source.preTest.score);
                    target.preTest.answers = clampArray(source.preTest.answers, this.IMPORT_MAX_ARRAY_ITEMS)
                        .filter(n => Number.isFinite(n) && n >= 0 && n <= 100);
                }

                if (this.isPlainObject(source.theory)) {
                    target.theory.completed = source.theory.completed === true;
                    target.theory.sectionsRead = clampArray(source.theory.sectionsRead, this.IMPORT_MAX_ARRAY_ITEMS)
                        .filter(v => typeof v === 'string')
                        .map(v => v.slice(0, this.IMPORT_MAX_KEY_LENGTH));
                }

                if (this.isPlainObject(source.jokes)) {
                    target.jokes.analyzed = clampArray(source.jokes.analyzed, this.IMPORT_MAX_ARRAY_ITEMS)
                        .filter(v => typeof v === 'string')
                        .map(v => v.slice(0, this.IMPORT_MAX_KEY_LENGTH));
                    target.jokes.notes = this.isPlainObject(source.jokes.notes) ? source.jokes.notes : target.jokes.notes;
                }

                if (this.isPlainObject(source.activities)) {
                    target.activities.completed = clampArray(source.activities.completed, this.IMPORT_MAX_ARRAY_ITEMS)
                        .filter(v => typeof v === 'string')
                        .map(v => v.slice(0, this.IMPORT_MAX_KEY_LENGTH));
                    target.activities.notes = this.isPlainObject(source.activities.notes) ? source.activities.notes : target.activities.notes;
                    target.activities.completedFlag = source.activities.completedFlag === true;
                }

                if (this.isPlainObject(source.postTest)) {
                    target.postTest.completed = source.postTest.completed === true;
                    target.postTest.score = clampScore(source.postTest.score);
                    target.postTest.answers = clampArray(source.postTest.answers, this.IMPORT_MAX_ARRAY_ITEMS)
                        .filter(n => Number.isFinite(n) && n >= 0 && n <= 100);
                    target.postTest.completedAt = Number.isFinite(source.postTest.completedAt) ? source.postTest.completedAt : target.postTest.completedAt;
                }

                if (this.isPlainObject(source.reflection)) {
                    target.reflection.completed = source.reflection.completed === true;
                    if (this.isPlainObject(source.reflection.responses) || Array.isArray(source.reflection.responses)) {
                        target.reflection.responses = source.reflection.responses;
                    }
                }

                if (Array.isArray(source.reflectionData)) {
                    target.reflectionData = source.reflectionData.slice(0, 200);
                }
            });

            return safe;
        },

        validateProgressImport: function(parsed) {
            if (!this.isPlainObject(parsed)) {
                return { ok: false, error: 'Invalid file: expected a JSON object.' };
            }

            const version = typeof parsed.version === 'string' ? parsed.version : null;
            if (!version || !this.SUPPORTED_IMPORT_VERSIONS.has(version)) {
                return { ok: false, error: 'Unsupported backup version. Please export a new backup from this site.' };
            }

            if (!Object.prototype.hasOwnProperty.call(parsed, 'userProgress')) {
                return { ok: false, error: 'Invalid backup: missing userProgress.' };
            }

            const userProgress = this.validateUserProgress(parsed.userProgress);
            const moduleMastery = this.validateModuleMastery(parsed.moduleMastery || parsed.mastery);
            return { ok: true, value: { version, userProgress, moduleMastery } };
        },

        /**
         * Save user progress to localStorage
         * @returns {boolean} Success status
         */
        save: function() {
            try {
                const data = JSON.stringify(State.userProgress);
                localStorage.setItem(this.STORAGE_KEY, data);
                this.saveTeacherMode();

                // Lightweight toast for saves (throttled)
                const now = Date.now();
                if (window.UI && window.UI.toast && now - this.lastSaveToast > 20000) {
                    window.UI.toast('Progress saved', 'success');
                    this.lastSaveToast = now;
                }
                return true;
            } catch (e) {
                if (e.name === 'QuotaExceededError') {
                    console.error('Storage quota exceeded. Some progress may not be saved.');
                    alert('Storage is full. Your recent progress might not be saved. Consider clearing browser data or using browser sync.');
                } else {
                    console.error('Save failed:', e);
                }
                return false;
            }
        },

        /**
         * Load user progress from localStorage
         * @returns {boolean} Success status
         */
        load: function() {
            try {
                const saved = localStorage.getItem(this.STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);

                    // Validate and merge data structure
                    State.userProgress.jokesRead = Array.isArray(parsed.jokesRead) ? parsed.jokesRead : [];
                    State.userProgress.activitiesCompleted = Array.isArray(parsed.activitiesCompleted) ? parsed.activitiesCompleted : [];
                    State.userProgress.quizScores = Array.isArray(parsed.quizScores) ? parsed.quizScores : [];
                    State.userProgress.favoriteJokes = Array.isArray(parsed.favoriteJokes) ? parsed.favoriteJokes : [];
                    State.userProgress.jokeNotes = (parsed.jokeNotes && typeof parsed.jokeNotes === 'object') ? parsed.jokeNotes : {};
                    State.userProgress.activityNotes = (parsed.activityNotes && typeof parsed.activityNotes === 'object') ? parsed.activityNotes : {};
                    State.userProgress.learningPath = parsed.learningPath || null;
                    State.userProgress.onboardingComplete = parsed.onboardingComplete === true;
                    State.userProgress.hasVisitedBefore = parsed.hasVisitedBefore === true;
                    State.userProgress.placementCompleted = parsed.placementCompleted === true;

                    this.loadTeacherMode();
                    console.log('✓ Progress loaded successfully');
                    return true;
                }
            } catch (e) {
                console.error('Load failed:', e);
                alert('Failed to load saved progress. Starting fresh. Your old data may be corrupted.');
                this.resetToDefaults();
                return false;
            }
            return true;
        },

        /**
         * Save module mastery data
         */
        saveMastery: function() {
            try {
                const data = JSON.stringify(State.moduleMastery);
                localStorage.setItem(this.MASTERY_KEY, data);
                return true;
            } catch (e) {
                console.error('Failed to save mastery data:', e);
                return false;
            }
        },

        /**
         * Load module mastery data
         */
        loadMastery: function() {
            try {
                const saved = localStorage.getItem(this.MASTERY_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    State.moduleMastery = parsed;
                    console.log('✓ Module mastery loaded');
                    return true;
                }
            } catch (e) {
                console.error('Failed to load mastery data:', e);
            }
            return false;
        },

        /**
         * Load teacher mode preference
         */
        loadTeacherMode: function() {
            try {
                const stored = localStorage.getItem('teacherMode');
                const legacy = localStorage.getItem('teacherModeEnabled');
                if (stored !== null || legacy !== null) {
                    const value = stored !== null ? stored : legacy;
                    State.teacherModeEnabled = value === 'true';
                }
                return State.teacherModeEnabled;
            } catch (e) {
                State.teacherModeEnabled = false;
                return false;
            }
        },

        /**
         * Save teacher mode preference
         * @param {boolean} enabled - Current teacher mode value
         */
        saveTeacherMode: function(enabled = State.teacherModeEnabled) {
            try {
                const value = enabled ? 'true' : 'false';
                localStorage.setItem('teacherMode', value);
                localStorage.setItem('teacherModeEnabled', value); // legacy compatibility
                return true;
            } catch (e) {
                console.error('Failed to save teacher mode:', e);
                return false;
            }
        },

        /**
         * Reset progress to defaults
         */
        resetToDefaults: function() {
            State.userProgress = {
                jokesRead: [],
                activitiesCompleted: [],
                quizScores: [],
                favoriteJokes: [],
                jokeNotes: {},
                activityNotes: {},
                learningPath: null,
                onboardingComplete: false,
                hasVisitedBefore: false,
                placementCompleted: false
            };
            State.teacherModeEnabled = false;
            this.saveTeacherMode(false);
        },

        /**
         * Reset all progress (with confirmation)
         */
        reset: function() {
            if (confirm('Reset all progress? This cannot be undone.')) {
                try {
                    localStorage.removeItem(this.STORAGE_KEY);
                    localStorage.removeItem(this.MASTERY_KEY);
                    location.reload();
                } catch (e) {
                    console.error('Reset failed:', e);
                    alert('Failed to reset progress. Please clear your browser data manually.');
                }
            }
        },

        /**
         * Import progress from JSON file
         * @param {File} file - The file to import
         */
        importProgress: function(file) {
            // If no file provided, prompt for one
            if (!file) {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,application/json';
                input.addEventListener('change', (e) => {
                    const selected = e.target.files && e.target.files[0];
                    if (selected) {
                        this.importProgress(selected);
                    }
                });
                input.click();
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const rawText = typeof e.target.result === 'string' ? e.target.result : '';
                    if (rawText.length > this.IMPORT_MAX_BYTES * 2) {
                        throw new Error('Backup is too large. Please export a smaller backup.');
                    }

                    const imported = JSON.parse(rawText);
                    const validated = this.validateProgressImport(imported);
                    if (!validated.ok) {
                        throw new Error(validated.error);
                    }

                    State.userProgress = validated.value.userProgress;
                    State.userProgress.hasVisitedBefore = true;
                    State.moduleMastery = validated.value.moduleMastery;
                    State.initModuleMastery();

                    this.save();
                    this.saveMastery();
                    this.safeToast('Progress imported successfully', 'success');

                    if (window.ProgressModule && typeof window.ProgressModule.update === 'function') {
                        window.ProgressModule.update();
                    }
                    if (window.ActivitiesModule && typeof window.ActivitiesModule.ensureRendered === 'function') {
                        window.ActivitiesModule.ensureRendered();
                    }
                    if (window.JokeModule && typeof window.JokeModule.ensureLoaded === 'function') {
                        window.JokeModule.ensureLoaded();
                    }
                    if (typeof updateModuleProgressUI === 'function') {
                        updateModuleProgressUI();
                    }
                } catch (e) {
                    console.error('Import failed:', e);
                    this.safeToast(e && e.message ? e.message : 'Failed to import progress.', 'error');
                }
            };
            try {
                if (file && typeof file.size === 'number' && file.size > this.IMPORT_MAX_BYTES) {
                    this.safeToast('Backup file is too large to import (max 50 KB). Export a smaller backup and try again.', 'error');
                    return;
                }
            } catch (e) {
                // Ignore file size check errors
            }
            reader.readAsText(file);
        }
    };

    // ========================================
    // THEME MANAGEMENT
    // ========================================
    const ThemeManager = {
        currentTheme: 'light',

        /**
         * Initialize theme from localStorage
         */
        init: function() {
            let savedTheme = 'light';
            try {
                savedTheme = localStorage.getItem('theme') || 'light';
            } catch (e) {
                savedTheme = 'light';
            }
            this.setTheme(savedTheme, false);
        },

        /**
         * Set theme
         * @param {string} theme - 'light' or 'dark'
         * @param {boolean} save - Whether to save to localStorage
         */
        setTheme: function(theme, save = true) {
            this.currentTheme = theme;
            document.documentElement.setAttribute('data-theme', theme);

            if (save) {
                try {
                    localStorage.setItem('theme', theme);
                } catch (e) {
                    // Ignore storage errors (private mode, quota, etc.)
                }
            }

            // Update toggle button if it exists
            const toggleBtn = document.getElementById('theme-toggle');
            if (toggleBtn) {
                toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
            }
        },

        /**
         * Toggle between light and dark themes
         */
        toggle: function() {
            const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
            this.setTheme(newTheme);
        }
    };

    // ========================================
    // PROGRESS UPDATE HELPER
    // ========================================
    const ProgressHelper = {
        /**
         * Mark a joke as read
         * @param {number} jokeIndex - Index of the joke
         */
        markJokeRead: function(jokeIndex) {
            if (!State.userProgress.jokesRead.includes(jokeIndex)) {
                State.userProgress.jokesRead.push(jokeIndex);
                Storage.save();
            }
        },

        /**
         * Toggle joke favorite status
         * @param {number} jokeIndex - Index of the joke
         */
        toggleFavorite: function(jokeIndex) {
            const idx = State.userProgress.favoriteJokes.indexOf(jokeIndex);
            if (idx === -1) {
                State.userProgress.favoriteJokes.push(jokeIndex);
            } else {
                State.userProgress.favoriteJokes.splice(idx, 1);
            }
            Storage.save();
            return idx === -1; // Returns true if now favorited
        },

        /**
         * Mark activity as completed
         * @param {string} activityId - ID of the activity
         */
        markActivityCompleted: function(activityId) {
            if (!State.userProgress.activitiesCompleted.includes(activityId)) {
                State.userProgress.activitiesCompleted.push(activityId);
                Storage.save();
            }
        },

        /**
         * Add quiz score
         * @param {number} score - Quiz score (0-100)
         */
        addQuizScore: function(score) {
            State.userProgress.quizScores.push(score);
            Storage.save();
        }
    };

    // ========================================
    // EXPOSE GLOBALLY
    // ========================================
    window.State = State;
    window.Storage = Storage;
    window.ThemeManager = ThemeManager;
    window.ProgressHelper = ProgressHelper;

    // Unit-like import validation self-test (run in console)
    window.__progressImportSelfTest = function() {
        const good = { version: '1', createdAt: new Date().toISOString(), userProgress: { jokesRead: [1, 2], quizScores: [90] } };
        const badVersion = { version: '999', userProgress: {} };
        const badTypes = { version: '1', userProgress: { jokesRead: ['x'], quizScores: ['100'] } };
        const tooLongNote = { version: '1', userProgress: { jokeNotes: { a: 'x'.repeat(Storage.IMPORT_MAX_NOTE_LENGTH + 10) } } };

        const cases = [
            ['good', true, good],
            ['badVersion', false, badVersion],
            ['badTypes', true, badTypes],
            ['tooLongNote', true, tooLongNote]
        ];

        let passed = 0;
        for (const [name, shouldOk, value] of cases) {
            const result = Storage.validateProgressImport(value);
            const ok = !!result.ok;
            if (ok === shouldOk) {
                passed++;
                console.log('[PASS]', name, ok ? result.value : result.error);
            } else {
                console.error('[FAIL]', name, { expected: shouldOk, got: ok, result });
            }
        }
        console.log(`Self-test complete: ${passed}/${cases.length} cases matched expected outcomes.`);
    };

    // Auto-load on initialization
    document.addEventListener('DOMContentLoaded', () => {
        Storage.load();
        Storage.loadMastery();
        Storage.loadTeacherMode();
        ThemeManager.init();
        State.initModuleMastery();
    });

})();
