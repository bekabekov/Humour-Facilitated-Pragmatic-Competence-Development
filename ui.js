/**
 * UI RENDERING MODULE
 *
 * Purpose: Handle all DOM manipulation and UI rendering
 *
 * Responsibilities:
 * - Render jokes with analysis
 * - Render activities list
 * - Render quizzes
 * - Update progress displays
 * - Handle modals (onboarding, module details, etc.)
 * - Manage notifications
 * - Render learning path elements
 *
 * Dependencies: State, DataLoader
 * Used by: App module and event handlers
 */

(function() {
    'use strict';

    // ========================================
    // DOM CACHE
    // ========================================
    const DOM = {};
    let toastContainer = null;

    function ensureToastContainer() {
        if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
        return toastContainer;
    }

    function toast(message, type = 'info') {
        const container = ensureToastContainer();

        // Limit stack to 3
        while (container.children.length >= 3) {
            container.removeChild(container.firstChild);
        }

        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        const icon = type === 'success' ? '✔' : type === 'error' ? '⚠' : 'ℹ';

        const iconEl = document.createElement('span');
        iconEl.className = 'toast-icon';
        iconEl.textContent = icon;

        const messageEl = document.createElement('span');
        messageEl.className = 'toast-message';
        messageEl.textContent = message == null ? '' : String(message);

        el.appendChild(iconEl);
        el.appendChild(messageEl);

        container.appendChild(el);

        setTimeout(() => {
            el.classList.add('hide');
            setTimeout(() => el.remove(), 300);
        }, 2500);

        return el;
    }
    function cacheDOM() {
        try {
            DOM.jokeText = document.getElementById('joke-text');
            DOM.jokeAnalysis = document.getElementById('joke-analysis');
            DOM.jokeNotes = document.getElementById('joke-notes');
            DOM.jokeCheckbox = document.getElementById('joke-checkbox');
            DOM.jokeFavoriteBtn = document.getElementById('joke-favorite-btn');
            DOM.jokeCategoryTag = document.getElementById('joke-category-tag');
            DOM.jokeLevelTag = document.getElementById('joke-level-tag');
            DOM.jokeLearningPoints = document.getElementById('joke-learning-points');
            DOM.activitiesContainer = document.getElementById('activities-container');
            DOM.quizContainer = document.getElementById('quiz-container');
            DOM.activitySearch = document.getElementById('activity-search');
            DOM.checkQuizBtn = document.getElementById('check-quiz-btn');
            DOM.retryQuizBtn = document.getElementById('retry-quiz-btn');
            DOM.levelProgressContainer = document.getElementById('level-progress-container');
            DOM.achievementContainer = document.getElementById('achievement-container');
            DOM.learningInsights = document.getElementById('learning-insights');
            DOM.onboardingModal = document.getElementById('onboarding-modal');

            console.log('✓ DOM elements cached');
        } catch (e) {
            console.error('Failed to cache DOM elements:', e);
        }
    }

    // ========================================
    // UTILITIES
    // ========================================
    function sanitizeHTML(str) {
        const temp = document.createElement('div');
        temp.textContent = str == null ? '' : String(str);
        return temp.innerHTML;
    }

    function showLoading(target, message = 'Loading...') {
        if (target) {
            const loading = document.createElement('div');
            loading.className = 'loading-state';
            loading.textContent = message == null ? 'Loading...' : String(message);
            target.replaceChildren(loading);
        }
    }

    function arrayIncludes(arr, item) {
        return arr.indexOf(item) !== -1;
    }

    // ========================================
    // TEACHER MODE SUPPORT DATA
    // ========================================
    const TEACHER_GUIDES = {
        'Clarification requests': {
            answerKey: 'Model answers include softeners plus a clear request for meaning: "Sorry, I\'m not following. When you say __, do you mean...?" or "Could you clarify what you want me to do with...?"',
            prompts: [
                'Ask: Which part is unclear? Have students underline the ambiguous word and paraphrase it.',
                'Ask: How can you signal confusion politely to a teacher vs. to a friend?',
                'Have students rank options from most direct to most face-saving.'
            ],
            pitfalls: [
                '"What?" or "Huh?" with no mitigation.',
                'Repeating words louder (literal interpretation) instead of checking intent.',
                'Transferring L1 apologies or silence norms that hide misunderstanding.'
            ]
        },
        'Politeness markers': {
            answerKey: 'Expected responses layer a modal + softener + please: "Could I please...?", "Would you mind if I...?", "I was wondering if you could...".',
            prompts: [
                'Ask: Which version fits a teacher, a boss, and a close friend? Why?',
                'Ask: What non-verbal cues (tone, pacing) keep the request polite?',
                'Have students rewrite a direct command with two levels of softening.'
            ],
            pitfalls: [
                'Literal translation without modals/please.',
                'Mixing informal slang with high power distance situations.',
                'Over-apologizing before the request, which can sound unsure.'
            ]
        },
        'Register variation': {
            answerKey: 'Strong answers adapt lexis and framing to power/distance: formal openings ("Would it be possible...") for teachers/bosses and casual phrasing for peers.',
            prompts: [
                'Ask: How would this line change for a professor vs. a sibling?',
                'Ask: Which parts of the sentence signal respect? Which can stay casual?',
                'Role-switch and have students justify their register choices.'
            ],
            pitfalls: [
                'Using the same template for every audience.',
                'Assuming literal content matters more than relationship signals.',
                'Copying L1 formalities (titles/honorifics) without English equivalents.'
            ]
        },
        'Lexical ambiguity': {
            answerKey: 'Look for two viable readings of the trigger word/phrase and a short explanation of how the joke flips between them.',
            prompts: [
                'Ask: What are the two scripts/meanings competing here?',
                'Ask: Which clues in the sentence push us toward the intended meaning?',
                'Have students supply a second sentence that forces the alternate meaning.'
            ],
            pitfalls: [
                'Treating the line literally and missing the alternate script.',
                'Listing vocabulary definitions without connecting to context.',
                'Assuming the first meaning they know is the only option (transfer).'
            ]
        },
        'Indirect speech acts': {
            answerKey: 'Answers should restate the intended action behind the indirect form: hint → request, question → refusal, compliment → warning, etc.',
            prompts: [
                'Ask: What is the speaker REALLY trying to do? Request? Refuse? Warn?',
                'Ask: How would this sound if we said it directly? What changes?',
                'Have students identify politeness or face-saving moves in the indirect form.'
            ],
            pitfalls: [
                'Interpreting only the literal question.',
                'Missing contextual cues (time, relationship) that reveal the intent.',
                'Transferring L1 norms about directness and perceiving rudeness where none is intended.'
            ]
        },
        'Turn-taking': {
            answerKey: 'Look for prefaces that manage the floor: "Could I jump in?", "Sorry to interrupt...", "May I add something?" plus a quick rationale.',
            prompts: [
                'Ask: Which options protect the other speaker\'s face the most?',
                'Ask: How do you signal urgency vs. low-stakes contributions?',
                'Role-play with and without interruption language and compare reactions.'
            ],
            pitfalls: [
                'Interrupting without any preface or mitigation.',
                'Waiting too long and losing the turn entirely.',
                'Using commands ("Wait!") that sound abrupt in English.'
            ]
        },
        'Pragmatic transfer': {
            answerKey: 'A strong response names the English norm and contrasts it with an L1 habit (e.g., refusing offers directly vs. ritual refusals).',
            prompts: [
                'Ask: What would someone from your culture do here? How might it be misread?',
                'Ask: Which cues show the expected English norm (please/intonation/indirectness)?',
                'Have learners script an L1 version and an English version and compare.'
            ],
            pitfalls: [
                'Assuming direct translations keep the same politeness value.',
                'Ignoring power/distance shifts when moving between languages.',
                'Focusing on grammar accuracy and missing pragmatic fit.'
            ]
        },
        'Cross-cultural navigation': {
            answerKey: 'Good answers explain how to adjust wording + tone to meet the target culture\'s expectation and name at least one concrete linguistic change.',
            prompts: [
                'Ask: What would sound too direct/too vague to this audience?',
                'Ask: Which cultural value is being protected (harmony, clarity, efficiency)?',
                'Have students predict a misfire and rewrite to prevent it.'
            ],
            pitfalls: [
                'Projecting home-culture norms onto English interactions.',
                'Ignoring non-verbal cues (pace, eye contact, pauses) that carry pragmatic meaning.',
                'Assuming one-size-fits-all politeness strategies.'
            ]
        }
    };

    function buildTeacherSupport(activity) {
        const focus = activity.pragmaticFocus || 'pragmatic target';
        const taskText = activity.task || activity.title || 'this task';
        const description = activity.description || 'this scenario';
        const guide = TEACHER_GUIDES[focus] || {
            answerKey: `Model answers should demonstrate ${focus.toLowerCase()} using the task prompt. A complete response names the intention, fits the audience, and uses language from the task: "${taskText}".`,
            prompts: [
                `Ask: What did the speaker really mean? How do you know from context in "${description}"?`,
                'Ask: Which words soften or intensify the message? What would you remove/add for a teacher vs. a peer?',
                'Have students suggest one alternative phrasing and explain where it fits.'
            ],
            pitfalls: [
                'Literal interpretation without considering relationship or power.',
                'Pragmalinguistic transfer: translating L1 politeness formulas directly.',
                'One-word answers with no audience or goal awareness.'
            ]
        };

        return guide;
    }

    // ========================================
    // JOKE MODULE
    // ========================================
    const JokeModule = {
        currentIndex: 0,
        filteredJokes: [],

        init: function() {
            this.filteredJokes = window.DATA ? window.DATA.jokes || [] : [];
            if (!this.filteredJokes.length) {
                const container = document.getElementById('joke-text');
                showLoading(container, 'Loading examples...');
                return;
            }
            this.renderJoke(0);
        },

        ensureLoaded: function() {
            if (!this.filteredJokes || this.filteredJokes.length === 0) {
                this.init();
            } else {
                this.renderJoke(window.State ? window.State.currentJokeIndex : 0);
            }
        },

        renderJoke: function(index) {
            if (!window.DATA || !window.DATA.jokes) {
                console.warn('Data not loaded yet');
                return;
            }

            const jokes = window.DATA.jokes;
            if (index < 0 || index >= jokes.length) {
                console.warn('Invalid joke index:', index);
                return;
            }

            this.currentIndex = index;
            if (window.State) {
                window.State.currentJokeIndex = index;
            }

            const joke = jokes[index];

            // Update text
            if (DOM.jokeText) {
                DOM.jokeText.innerHTML = `
                    <div class="joke-number">Example ${index + 1} of ${jokes.length}</div>
                    <div class="joke-content">${sanitizeHTML(joke.text)}</div>
                `;
            }

            // Update analysis
            if (DOM.jokeAnalysis) {
                DOM.jokeAnalysis.innerHTML = `
                    <h4>📚 Analysis</h4>
                    <p>${sanitizeHTML(joke.analysis)}</p>
                `;
            }

            // Update tags
            if (DOM.jokeLevelTag) {
                DOM.jokeLevelTag.textContent = joke.level || 'N/A';
                DOM.jokeLevelTag.className = `tag tag-${(joke.level || 'A1').toLowerCase()}`;
            }

            if (DOM.jokeCategoryTag) {
                DOM.jokeCategoryTag.textContent = joke.type || 'General';
            }

            // Update learning points
            if (DOM.jokeLearningPoints && joke.learningPoints) {
                DOM.jokeLearningPoints.innerHTML = joke.learningPoints
                    .map(point => `<li>${sanitizeHTML(point)}</li>`)
                    .join('');
            }

            // Render Pragmatics Scaffold (research-grade analysis)
            const scaffoldContainer = document.getElementById('joke-scaffold-container');
            if (scaffoldContainer && window.PragmaticsScaffold) {
                const scaffoldData = window.PragmaticsScaffold.extractFromJoke(joke);
                scaffoldContainer.innerHTML = window.PragmaticsScaffold.render(
                    scaffoldData,
                    { expanded: false, cardId: `joke-scaffold-${index}` }
                );
            }

            // Update favorite button
            if (DOM.jokeFavoriteBtn && window.State) {
                const isFavorite = window.State.userProgress.favoriteJokes.includes(index);
                DOM.jokeFavoriteBtn.textContent = isFavorite ? '★' : '☆';
                DOM.jokeFavoriteBtn.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
            }

            // Mark as read
            if (window.ProgressHelper) {
                window.ProgressHelper.markJokeRead(index);
            }
        },

        nextJoke: function() {
            const totalJokes = window.DATA ? window.DATA.jokes.length : 0;
            const nextIndex = (this.currentIndex + 1) % totalJokes;
            this.renderJoke(nextIndex);
            // Scroll to top of joke section for better UX
            const jokeSection = document.getElementById('joke');
            if (jokeSection) {
                jokeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        },

        previousJoke: function() {
            const totalJokes = window.DATA ? window.DATA.jokes.length : 0;
            const prevIndex = (this.currentIndex - 1 + totalJokes) % totalJokes;
            this.renderJoke(prevIndex);
            // Scroll to top of joke section for better UX
            const jokeSection = document.getElementById('joke');
            if (jokeSection) {
                jokeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        },

        randomJoke: function() {
            const totalJokes = window.DATA ? window.DATA.jokes.length : 0;
            const randomIndex = Math.floor(Math.random() * totalJokes);
            this.renderJoke(randomIndex);
            // Scroll to top of joke section for better UX
            const jokeSection = document.getElementById('joke');
            if (jokeSection) {
                jokeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        },

        toggleFavorite: function() {
            if (!window.ProgressHelper) return;

            const isFavorite = window.ProgressHelper.toggleFavorite(this.currentIndex);
            if (DOM.jokeFavoriteBtn) {
                DOM.jokeFavoriteBtn.textContent = isFavorite ? '★' : '☆';
                DOM.jokeFavoriteBtn.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
            }

            toast(isFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
        },

        filterByType: function(jokeType) {
            if (!window.DATA || !window.DATA.jokes) return;

            // Filter jokes by type
            if (jokeType === 'all') {
                this.filteredJokes = window.DATA.jokes;
            } else {
                this.filteredJokes = window.DATA.jokes.filter(joke => joke.type === jokeType);
            }

            // Reset to first joke in filtered list
            if (this.filteredJokes.length > 0) {
                this.currentIndex = 0;
                // Find the actual index in the full jokes array
                const firstJoke = this.filteredJokes[0];
                const actualIndex = window.DATA.jokes.findIndex(j => j.id === firstJoke.id);
                if (actualIndex !== -1) {
                    this.renderJoke(actualIndex);
                }
                toast(`Showing ${this.filteredJokes.length} ${jokeType === 'all' ? 'jokes' : jokeType + 's'}`, 'info');

                // Scroll to top of joke section for better UX
                const jokeSection = document.getElementById('joke');
                if (jokeSection) {
                    jokeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } else {
                toast(`No ${jokeType}s found`, 'info');
            }
        }
    };

    // ========================================
    // ACTIVITIES MODULE
    // ========================================
    const ActivitiesModule = {
        rendered: false,

        renderTeacherSupport: function(activity) {
            const guide = buildTeacherSupport(activity);
            const prompts = (guide.prompts || []).map(item => `<li>${sanitizeHTML(item)}</li>`).join('');
            const pitfalls = (guide.pitfalls || []).map(item => `<li>${sanitizeHTML(item)}</li>`).join('');

            return `
                <div class="teacher-mode-block" aria-label="Teacher guidance for this activity">
                    <div class="teacher-mode-chip">Teacher Mode</div>
                    <div class="teacher-mode-grid">
                        <div class="teacher-mode-item">
                            <h5>Answer Key</h5>
                            <p>${sanitizeHTML(guide.answerKey || 'Use the prompt to elicit a full, audience-aware response.')}</p>
                        </div>
                        <div class="teacher-mode-item">
                            <h5>Facilitation Prompts</h5>
                            <ul>${prompts}</ul>
                        </div>
                        <div class="teacher-mode-item">
                            <h5>Anticipated Learner Errors</h5>
                            <ul>${pitfalls}</ul>
                        </div>
                    </div>
                </div>
            `;
        },

        ensureRendered: function() {
            if (!this.rendered) {
                this.render();
            }
        },

        render: function() {
            if (!DOM.activitiesContainer) return;
            if (!window.DATA || !window.DATA.activities) {
                showLoading(DOM.activitiesContainer, 'Loading activities...');
                return;
            }

            const activities = window.DATA.activities;
            const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

            let html = '';
            levels.forEach(level => {
                const levelActivities = activities.filter(a => a.level === level);
                if (levelActivities.length === 0) return;

                html += `<h3>${level} Level Activities</h3>`;
                html += '<div class="activities-grid">';

                levelActivities.forEach((activity, idx) => {
                    const activityId = `${level}-activity-${idx}`;
                    const isCompleted = window.State &&
                        window.State.userProgress.activitiesCompleted.includes(activityId);
                    const difficultyRaw = (activity && activity.difficulty) ? String(activity.difficulty).toLowerCase() : '';
                    const difficulty = (difficultyRaw === 'easy' || difficultyRaw === 'medium' || difficultyRaw === 'hard')
                        ? difficultyRaw
                        : 'medium';

                    // Generate scaffold HTML if PragmaticsScaffold available
                    let scaffoldHTML = '';
                    if (window.PragmaticsScaffold) {
                        const scaffoldData = window.PragmaticsScaffold.extractFromActivity(activity);
                        scaffoldHTML = window.PragmaticsScaffold.render(
                            scaffoldData,
                            { expanded: false, cardId: `activity-scaffold-${activityId}` }
                        );
                    }

                    const teacherSupport = this.renderTeacherSupport(activity);

                    html += `
                        <div class="activity-card ${isCompleted ? 'completed' : ''}">
                            <div class="activity-header">
                                <h4>${sanitizeHTML(activity.title)}</h4>
                                <span class="activity-difficulty difficulty-${difficulty}">
                                    ${difficulty}
                                </span>
                            </div>
                            <p class="activity-description">${sanitizeHTML(activity.description)}</p>
                            <div class="activity-task">
                                <strong>Task:</strong>
                                <p>${sanitizeHTML(activity.task)}</p>
                            </div>
                            ${scaffoldHTML}
                            ${teacherSupport}
                            <div class="activity-meta">
                                <span class="activity-focus">Focus: ${sanitizeHTML(activity.pragmaticFocus)}</span>
                            </div>
                            <button class="btn btn-small ${isCompleted ? 'btn-success' : 'btn-primary'}"
                                     type="button" data-action="activities-toggle-complete" data-activity-id="${sanitizeHTML(activityId)}">
                                ${isCompleted ? '✓ Completed' : 'Mark Complete'}
                            </button>
                        </div>
                    `;
                });

                html += '</div>';
            });

            DOM.activitiesContainer.innerHTML = html;
            this.rendered = true;
        },

        toggleComplete: function(activityId) {
            if (!window.State) return;

            const activities = window.State.userProgress.activitiesCompleted;
            const index = activities.indexOf(activityId);

            if (index === -1) {
                activities.push(activityId);
                toast('Activity marked as complete', 'success');
            } else {
                activities.splice(index, 1);
                toast('Activity unmarked', 'info');
            }

            if (window.Storage) {
                window.Storage.save();
            }

            this.render(); // Re-render to update UI
        }
    };

    // ========================================
    // PROGRESS MODULE
    // ========================================
    const ProgressModule = {
        update: function() {
            this.updateStats();
            this.updateLevelProgress();
            this.updateAchievements();
            this.updateInsights();
        },

        updateStats: function() {
            if (!window.State) return;

            const statJokesRead = document.getElementById('stat-jokes-read');
            const statActivities = document.getElementById('stat-activities-completed');
            const statQuizzes = document.getElementById('stat-quizzes-taken');
            const statAvgScore = document.getElementById('stat-avg-score');

            if (statJokesRead) statJokesRead.textContent = window.State.userProgress.jokesRead.length;

            // Count completed modules instead of activities
            let completedModules = 0;
            if (window.State.moduleMastery && window.State.moduleMastery.modules) {
                completedModules = Object.values(window.State.moduleMastery.modules).filter(module => module.completed === true).length;
            }
            if (statActivities) statActivities.textContent = completedModules;

            // Count completed post-tests
            let completedQuizzes = 0;
            if (window.State.moduleMastery && window.State.moduleMastery.modules) {
                completedQuizzes = Object.values(window.State.moduleMastery.modules).filter(module => module.postTest && module.postTest.completed === true).length;
            }
            if (statQuizzes) statQuizzes.textContent = completedQuizzes;

            // Calculate average post-test score
            let avgScore = 0;
            if (window.State.moduleMastery && window.State.moduleMastery.modules) {
                const scores = Object.values(window.State.moduleMastery.modules)
                    .filter(module => module.postTest && typeof module.postTest.score === 'number')
                    .map(module => module.postTest.score);
                if (scores.length > 0) {
                    const sum = scores.reduce((a, b) => a + b, 0);
                    avgScore = Math.round(sum / scores.length);
                }
            }
            if (statAvgScore) statAvgScore.textContent = `${avgScore}%`;
        },

        updateLevelProgress: function() {
            if (!DOM.levelProgressContainer || !window.DATA) return;

            const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
            let html = '';

            levels.forEach(level => {
                const total = window.DATA.activities.filter(a => a.level === level).length;
                let completed = 0;

                if (window.State) {
                    window.State.userProgress.activitiesCompleted.forEach(id => {
                        if (id.startsWith(level)) completed++;
                    });
                }

                completed = Math.min(completed, total);
                const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

                html += `
                    <h4>${level} Activities</h4>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(100, Math.max(0, percentage))}%;">${Math.min(100, Math.max(0, percentage))}%</div>
                    </div>
                `;
            });

            DOM.levelProgressContainer.innerHTML = html;
        },

        updateAchievements: function() {
            if (!DOM.achievementContainer || !window.State) return;

            const badges = [];
            const progress = window.State.userProgress;

            if (progress.jokesRead.length >= 5) badges.push('Joke Explorer');
            if (progress.jokesRead.length >= 20) badges.push('Humor Master');
            if (progress.activitiesCompleted.length >= 5) badges.push('Active Learner');
            if (progress.activitiesCompleted.length >= 15) badges.push('Dedicated Student');
            if (progress.quizScores.length >= 3) badges.push('Quiz Taker');
            if (progress.quizScores.some(score => score === 100)) badges.push('Perfect Score');
            if (progress.favoriteJokes.length >= 10) badges.push('Humor Collector');

            DOM.achievementContainer.innerHTML = badges.length > 0
                ? badges.map(b => `<span class="achievement-badge">${b}</span>`).join('')
                : '<p style="color: #666;">Complete activities to earn achievement badges!</p>';
        },

        updateInsights: function() {
            if (!DOM.learningInsights || !window.State) return;

            const insights = [];
            const progress = window.State.userProgress;

            if (progress.jokesRead.length > 0) {
                const avgScore = progress.quizScores.length > 0
                    ? Math.round(progress.quizScores.reduce((a, b) => a + b, 0) / progress.quizScores.length)
                    : 0;

                if (avgScore >= 80) {
                    insights.push(`🎉 <strong>Excellent work!</strong> Your average quiz score of ${avgScore}% shows strong pragmatic competence.`);
                } else if (avgScore >= 60) {
                    insights.push(`📈 <strong>Good progress!</strong> Your ${avgScore}% average shows you're developing pragmatic awareness.`);
                } else if (progress.quizScores.length > 0) {
                    insights.push('💪 <strong>Keep going!</strong> Review the theory section and analyze more examples.');
                }

                if (progress.jokesRead.length >= 10 && progress.activitiesCompleted.length < 5) {
                    insights.push('🎯 <strong>Ready for more practice!</strong> Apply what you\'ve learned in activities!');
                }

                if (progress.activitiesCompleted.length >= 10) {
                    insights.push(`🌟 <strong>Impressive dedication!</strong> You've completed ${progress.activitiesCompleted.length} activities.`);
                }
            }

            if (insights.length === 0) {
                insights.push('👋 <strong>Welcome!</strong> Start your learning journey by exploring jokes and completing activities.');
            }

            DOM.learningInsights.innerHTML = insights.map(i => `<p style="margin-bottom: 15px;">${i}</p>`).join('');
        }
    };

    // ========================================
    // NOTIFICATION SYSTEM
    // ========================================
    function showNotification(message, type = 'success') {
        toast(message, type === 'error' ? 'error' : 'success');
    }

    // ========================================
    // ONBOARDING MODULE
    // ========================================
    const OnboardingModule = {
        show: function() {
            if (DOM.onboardingModal) {
                DOM.onboardingModal.style.display = 'flex';
            }
        },

        hide: function() {
            if (DOM.onboardingModal) {
                DOM.onboardingModal.style.display = 'none';
            }
            if (window.State) {
                window.State.userProgress.onboardingComplete = true;
                window.Storage && window.Storage.save();
            }
        },

        selectPath: function(pathType) {
            if (window.State) {
                window.State.userProgress.learningPath = pathType;
                window.Storage && window.Storage.save();
            }
            this.hide();
            showNotification('Learning path selected!');
        }
    };

    // ========================================
    // EXPOSE GLOBALLY
    // ========================================
    window.JokeModule = JokeModule;
    window.ActivitiesModule = ActivitiesModule;
    window.ProgressModule = ProgressModule;
    window.OnboardingModule = OnboardingModule;
    window.showNotification = showNotification;
    window.DOM = DOM;
    window.UI = window.UI || {};
    window.UI.toast = toast;

    // Initialize DOM cache when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cacheDOM);
    } else {
        cacheDOM();
    }

    // ========================================
    // ACCORDION TOGGLE FUNCTIONALITY
    // ========================================
    // Initialize accordion states
    document.querySelectorAll('.accordion-body').forEach(body => {
        const header = document.querySelector(`.accordion-header[data-target="${body.id}"]`);
        if (header) {
            const isExpanded = header.getAttribute('aria-expanded') === 'true';
            body.style.display = isExpanded ? 'block' : 'none';
        }
    });

    document.addEventListener('click', function(e) {
        const header = e.target.closest('.accordion-header');
        if (header) {
            const targetId = header.getAttribute('data-target');
            if (targetId) {
                const body = document.getElementById(targetId);
                if (body) {
                    const isExpanded = header.getAttribute('aria-expanded') === 'true';
                    const newExpanded = !isExpanded;
                    header.setAttribute('aria-expanded', newExpanded);
                    body.style.display = newExpanded ? 'block' : 'none';
                    const chevron = header.querySelector('span:last-child');
                    if (chevron) {
                        chevron.textContent = newExpanded ? '▲' : '▼';
                    }
                }
            }
        }
    });

})();
