/**
 * ASSESSMENT MODULE
 *
 * Purpose: Handle all testing and quiz functionality
 *
 * Responsibilities:
 * - Render quizzes (beginner, intermediate, advanced)
 * - Handle quiz submissions and grading
 * - Render placement test
 * - Score and analyze test results
 * - Update progress based on quiz scores
 * - Provide feedback on answers
 *
 * Dependencies: State, DataLoader, UI
 * Used by: App module and quiz event handlers
 */

(function() {
    'use strict';

    // Ensure these globals always exist, even if init order changes.
    window.PlacementModule = window.PlacementModule || {};
    if (!window.PlacementModule.state) {
        window.PlacementModule.state = { currentQuestion: 0, answers: [], score: 0 };
    }

    // ========================================
    // QUIZ MODULE
    // ========================================
    const QuizModule = {
        currentLevel: 'all',
        currentAnswers: [],

        init: function() {
            this.renderQuizOptions();
        },

        renderQuizOptions: function() {
            const container = document.getElementById('quiz-level-selector');
            if (!container) return;

            const levels = [
                { value: 'all', label: 'All Levels', description: 'Mixed difficulty' },
                { value: 'beginner', label: 'Beginner (A1-A2)', description: 'Basic pragmatics' },
                { value: 'intermediate', label: 'Intermediate (B1)', description: 'Implicature & speech acts' },
                { value: 'advanced', label: 'Advanced (B2-C1)', description: 'Complex pragmatic analysis' }
            ];

            let html = '<div class="quiz-level-options">';
            levels.forEach(level => {
                html += `
                    <button class="quiz-level-btn ${this.currentLevel === level.value ? 'active' : ''}"
                            type="button" data-action="quiz-select-level" data-level="${level.value}">
                        <div class="level-label">${level.label}</div>
                        <div class="level-description">${level.description}</div>
                    </button>
                `;
            });
            html += '</div>';

            container.innerHTML = html;
        },

        selectLevel: function(level) {
            this.currentLevel = level;
            this.renderQuizOptions();
            this.renderQuiz(level);
        },

        renderQuiz: function(level) {
            if (!window.DATA || !window.DATA.quizzes) {
                console.warn('Quiz data not loaded');
                return;
            }

            const container = document.getElementById('quiz-container');
            if (!container) return;

            let questions = [];

            // Get questions based on level
            if (level === 'all') {
                questions = [
                    ...window.DATA.quizzes.beginner.slice(0, 2),
                    ...window.DATA.quizzes.intermediate.slice(0, 2),
                    ...window.DATA.quizzes.advanced.slice(0, 2)
                ];
            } else {
                questions = window.DATA.quizzes[level] || [];
            }

            // Reset answers
            this.currentAnswers = questions.map(() => ({ selected: null, correct: null }));

            // Build quiz HTML
            let html = '<div class="quiz-questions">';

            questions.forEach((q, index) => {
                html += `
                    <div class="quiz-question" data-question-index="${index}">
                        <h4>Question ${index + 1}</h4>
                        <p class="question-stem">${this.sanitizeHTML(q.question)}</p>
                        <div class="quiz-options">
                            ${q.options.map((option, optIndex) => `
                                <label class="quiz-option">
                                    <input type="radio"
                                           name="question-${index}"
                                           value="${optIndex}"
                                           data-question-index="${index}"
                                           data-option-index="${optIndex}">
                                    <span>${this.sanitizeHTML(option)}</span>
                                </label>
                            `).join('')}
                        </div>
                        <div class="quiz-feedback" id="feedback-${index}"></div>
                    </div>
                `;

                // Store correct answer
                this.currentAnswers[index].correct = q.correct;
                this.currentAnswers[index].explanation = q.explanation || '';
            });

            html += '</div>';

            html += `
                <div class="quiz-actions">
                    <button id="check-quiz-btn" class="btn btn-primary" type="button" data-action="quiz-check">
                        Check Answers
                    </button>
                    <button id="retry-quiz-btn" class="btn btn-secondary" type="button" data-action="quiz-retry" style="display:none;">
                        Try Again
                    </button>
                </div>
            `;

            container.innerHTML = html;

            // Bind selection handling (replaces inline onchange handlers for CSP compatibility)
            if (!this._quizChangeBound) {
                this._quizChangeBound = true;
                container.addEventListener('change', (event) => {
                    const input = event.target;
                    if (!input || input.tagName !== 'INPUT' || input.type !== 'radio') return;
                    const qIndex = input.getAttribute('data-question-index');
                    const optIndex = input.getAttribute('data-option-index');
                    if (qIndex == null || optIndex == null) return;
                    const qi = Number(qIndex);
                    const oi = Number(optIndex);
                    if (!Number.isFinite(qi) || !Number.isFinite(oi)) return;
                    this.selectAnswer(qi, oi);
                });
            }
        },

        selectAnswer: function(questionIndex, optionIndex) {
            this.currentAnswers[questionIndex].selected = optionIndex;
        },

        checkAnswers: function() {
            let correct = 0;
            const total = this.currentAnswers.length;

            this.currentAnswers.forEach((ans, index) => {
                const feedback = document.getElementById(`feedback-${index}`);
                const questionDiv = document.querySelector(`[data-question-index="${index}"]`);
                const options = questionDiv.querySelectorAll('.quiz-option');

                if (ans.selected === null) {
                    if (feedback) {
                        feedback.className = 'quiz-feedback show warning';
                        feedback.textContent = '⚠ Please select an answer';
                    }
                    return;
                }

                const isCorrect = ans.selected === ans.correct;
                if (isCorrect) correct++;

                // Mark correct/incorrect options
                options.forEach((opt, idx) => {
                    opt.classList.remove('correct', 'incorrect');
                    if (idx === ans.correct) {
                        opt.classList.add('correct');
                    } else if (idx === ans.selected && !isCorrect) {
                        opt.classList.add('incorrect');
                    }
                });

                // Show feedback
                if (feedback) {
                    feedback.className = `quiz-feedback show ${isCorrect ? 'correct' : 'incorrect'}`;
                    feedback.textContent = isCorrect
                        ? `✓ Correct! ${ans.explanation}`
                        : `✗ Incorrect. ${ans.explanation}`;
                }
            });

            // Calculate score
            const score = Math.round((correct / total) * 100);

            // Save score
            if (window.ProgressHelper) {
                window.ProgressHelper.addQuizScore(score);
            }

            // Show results
            const resultBox = document.createElement('div');
            resultBox.className = 'quiz-result-box';
            const heading = document.createElement('h3');
            heading.textContent = 'Quiz Results';
            const scoreP = document.createElement('p');
            scoreP.className = 'score';
            scoreP.textContent = `Your score: ${correct}/${total} (${score}%)`;
            const feedbackP = document.createElement('p');
            feedbackP.className = 'feedback';
            feedbackP.textContent = this.getScoreFeedback(score);
            resultBox.appendChild(heading);
            resultBox.appendChild(scoreP);
            resultBox.appendChild(feedbackP);

            const container = document.getElementById('quiz-container');
            container.insertBefore(resultBox, container.firstChild);

            // Toggle buttons
            document.getElementById('check-quiz-btn').style.display = 'none';
            document.getElementById('retry-quiz-btn').style.display = 'inline-block';

            // Toast feedback
            if (window.UI && window.UI.toast) {
                window.UI.toast('Quiz submitted', 'success');
            }

            // Update progress
            if (window.ProgressModule) {
                window.ProgressModule.update();
            }

            // Show notification
            window.showNotification && window.showNotification(`Quiz completed! Score: ${score}%`);
        },

        getScoreFeedback: function(score) {
            if (score === 100) {
                return '🌟 Perfect score! Excellent pragmatic competence!';
            } else if (score >= 80) {
                return '🎉 Great job! You have strong understanding of pragmatics.';
            } else if (score >= 60) {
                return '👍 Good work! Keep practicing to improve further.';
            } else if (score >= 40) {
                return '📚 You\'re making progress. Review the theory and try again.';
            } else {
                return '💪 Keep learning! Start with the beginner level and work your way up.';
            }
        },

        retryQuiz: function() {
            this.renderQuiz(this.currentLevel);
            const resultBox = document.querySelector('.quiz-result-box');
            if (resultBox && resultBox.parentNode) {
                resultBox.parentNode.removeChild(resultBox);
            }
        },

        sanitizeHTML: function(str) {
            const temp = document.createElement('div');
            temp.textContent = str;
            return temp.innerHTML;
        }
    };

    // ========================================
    // PLACEMENT TEST (REMOVED - Use PlacementModule instead)
    // ========================================
    // PlacementTest was an alternative all-at-once implementation
    // Removed to prevent confusion - PlacementModule is the single source of truth

    // ========================================
    // PLACEMENT MODULE (Full functionality)
    // ========================================
    const PlacementModule = window.PlacementModule;

    // (Re)define as configurable so hot reload / re-eval doesn't throw.
    try {
        Object.defineProperty(PlacementModule, 'questions', {
            configurable: true,
            get: function() {
                return window.DATA?.placementTest?.questions || [];
            }
        });
    } catch (e) {
        // ignore (older browsers / non-configurable in rare cases)
    }

        PlacementModule.init = function() {
            this.state.currentQuestion = 0;
            this.state.answers = [];
            this.showIntro();
        };

        PlacementModule.showIntro = function() {
            const intro = document.getElementById('placement-intro');
            const quiz = document.getElementById('placement-quiz');
            const results = document.getElementById('placement-results');
            if (intro) intro.style.display = 'block';
            if (quiz) quiz.style.display = 'none';
            if (results) results.style.display = 'none';
        };

        PlacementModule.start = async function() {
            // Ensure placement questions are available (data may still be loading on first click).
            if ((!this.questions || this.questions.length === 0) && window.DataLoader && typeof window.DataLoader.loadAll === 'function') {
                try {
                    if (!window.DataLoader.isLoaded) {
                        await window.DataLoader.loadAll();
                    }
                } catch (e) {
                    if (window.UI && typeof window.UI.toast === 'function') {
                        window.UI.toast('Placement data could not be loaded. Please reload and try again.', 'error');
                    } else {
                        alert('Placement data could not be loaded. Please reload and try again.');
                    }
                    this.showIntro();
                    return;
                }
            }

            if (!this.questions || this.questions.length === 0) {
                if (window.UI && typeof window.UI.toast === 'function') {
                    window.UI.toast('Placement questions are unavailable right now.', 'error');
                } else {
                    alert('Placement questions are unavailable right now.');
                }
                this.showIntro();
                return;
            }

            this.state.currentQuestion = 0;
            this.state.answers = [];
            const intro = document.getElementById('placement-intro');
            const quiz = document.getElementById('placement-quiz');
            const results = document.getElementById('placement-results');
            if (intro) intro.style.display = 'none';
            if (quiz) quiz.style.display = 'block';
            if (results) results.style.display = 'none';
            this.loadQuestion(0);
            if (window.State) {
                window.State.userProgress.placementCompleted = false;
                window.Storage.save();
            }
        };

        PlacementModule.loadQuestion = function(index) {
            const question = this.questions[index];
            if (!question) return;

            // Update progress
            const currentEl = document.getElementById('placement-current');
            if (currentEl) currentEl.textContent = index + 1;

            const progress = ((index + 1) / this.questions.length) * 100;
            const progressBar = document.getElementById('placement-progress-bar');
            if (progressBar) progressBar.style.width = progress + '%';

            // Update level badge
            const badge = document.getElementById('placement-level-badge');
            if (badge) {
                badge.textContent = question.level;
                badge.className = 'level-badge';
                if (question.level === 'A1-A2') badge.classList.add('level-a1');
                else if (question.level === 'B1') badge.classList.add('level-b1');
                else if (question.level === 'B2') badge.classList.add('level-b2');
                else if (question.level === 'C1') badge.classList.add('level-c1');
            }

            // Update question text
            const questionText = document.getElementById('placement-question-text');
            if (questionText) questionText.textContent = question.stem;

            // Create options
            const optionsContainer = document.getElementById('placement-options');
            if (optionsContainer) {
                optionsContainer.replaceChildren();
                optionsContainer.className = 'placement-options';

                // Store reference to PlacementModule for reliable binding
                const self = this;

                question.options.forEach((option, optIndex) => {
                    const letter = String.fromCharCode(65 + optIndex);
                    const optionId = `placement_q${index}_opt${optIndex}`;

                    const label = document.createElement('label');
                    label.className = 'placement-option';
                    label.dataset.q = String(index);
                    label.dataset.opt = String(optIndex);
                    label.setAttribute('for', optionId);

                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.id = optionId;
                    radio.name = `placement_question_${index}`;
                    radio.value = String(optIndex);

                    // Use explicit reference and add fallback
                    radio.addEventListener('change', function() {
                        try {
                            self.selectOption(optIndex);
                        } catch (e) {
                            console.error('selectOption failed, using fallback:', e);
                            // Fallback: just enable the button
                            const nextBtn = document.getElementById('placement-next-btn');
                            if (nextBtn) nextBtn.disabled = false;
                        }
                    });

                    const span = document.createElement('span');
                    const strong = document.createElement('strong');
                    strong.textContent = `${letter}.`;
                    span.appendChild(strong);
                    span.appendChild(document.createTextNode(' ' + String(option)));

                    label.appendChild(radio);
                    label.appendChild(span);

                    optionsContainer.appendChild(label);
                });
            }

            // Disable next button until answer selected
            const nextBtn = document.getElementById('placement-next-btn');
            if (nextBtn) {
                nextBtn.disabled = true;
                // Update button text for last question
                if (index === this.questions.length - 1) {
                    nextBtn.textContent = 'See Results';
                } else {
                    nextBtn.textContent = 'Next';
                }
            }
        },

        PlacementModule.selectOption = function(optIndex) {
            // Store answer
            this.state.answers[this.state.currentQuestion] = optIndex;

            // Update UI - highlight selected option
            const container = document.getElementById('placement-options');
            if (container) {
                const items = container.querySelectorAll('.placement-option');
                items.forEach((item) => item.classList.remove('selected'));
                const selected = container.querySelector(`.placement-option[data-opt="${optIndex}"]`);
                if (selected) selected.classList.add('selected');
            }

            // Enable next button
            const nextBtn = document.getElementById('placement-next-btn');
            if (nextBtn) nextBtn.disabled = false;
        };

        PlacementModule.nextQuestion = function() {
            if (this.state.currentQuestion < this.questions.length - 1) {
                this.state.currentQuestion++;
                this.loadQuestion(this.state.currentQuestion);
            } else {
                this.showResults();
            }
        };

        PlacementModule.showResults = function() {
            const quiz = document.getElementById('placement-quiz');
            const results = document.getElementById('placement-results');
            if (quiz) quiz.style.display = 'none';
            if (results) results.style.display = 'block';

            // Calculate score
            let correct = 0;
            const levelScores = {
                'A1-A2': { correct: 0, total: 0 },
                'B1': { correct: 0, total: 0 },
                'B2': { correct: 0, total: 0 },
                'C1': { correct: 0, total: 0 }
            };

            this.questions.forEach((q, i) => {
                if (levelScores[q.level]) {
                    levelScores[q.level].total++;
                    if (this.state.answers[i] === q.correct) {
                        correct++;
                        levelScores[q.level].correct++;
                    }
                }
            });

            // Display score
            const scoreEl = document.getElementById('placement-score');
            if (scoreEl) scoreEl.textContent = correct;

            // Determine recommended level
            let recommendedModule = 'module-1';
            let recommendedLabel = 'A1-A2 Beginner';
            let recommendedDesc = 'Start with the basics of literal vs figurative meaning';

            const scoring = window.DATA?.placementTest?.scoring || {};
            for (const moduleId in scoring) {
                const range = scoring[moduleId];
                if (correct >= range.min && correct <= range.max) {
                    recommendedModule = moduleId;
                    recommendedLabel = range.label;
                    recommendedDesc = range.description;
                    break;
                }
            }

            const levelResult = document.getElementById('placement-level-result');
            const levelDesc = document.getElementById('placement-level-description');
            if (levelResult) levelResult.textContent = recommendedLabel;
            if (levelDesc) levelDesc.textContent = recommendedDesc;

            // Add encouraging interpretation
            let encouragementText = '';
            let meaningText = '';

            if (recommendedModule === 'module-1') {
                encouragementText = 'Perfect starting point! You\'re at the beginning of an exciting journey into pragmatic competence.';
                meaningText = 'We\'ll start with the fundamentals and build your skills step by step. 🌱';
            } else if (recommendedModule === 'module-2') {
                encouragementText = 'Great! You\'ve got the basics down and you\'re ready to explore deeper concepts.';
                meaningText = 'You can skip Module 1 since you\'ve already mastered those basics! 🎉';
            } else if (recommendedModule === 'module-3' || recommendedModule === 'module-4') {
                encouragementText = 'Excellent work! You have a solid foundation in pragmatic competence.';
                meaningText = 'We recommend starting with Module ' + recommendedModule.split('-')[1] + '. You\'ll skip the basics and jump into intermediate concepts! 🚀';
            } else {
                encouragementText = 'Impressive! You\'re already at an advanced level of pragmatic competence.';
                meaningText = 'You\'ll focus on advanced topics and cultural nuances. Your earlier modules are unlocked if you want to review! 🌟';
            }

            const encouragEl = document.getElementById('encouragement-text');
            const meaningEl = document.getElementById('meaning-text');
            if (encouragEl) encouragEl.textContent = encouragementText;
            if (meaningEl) meaningEl.textContent = meaningText;

            // Show breakdown (DOM APIs to avoid HTML injection)
            const breakdownEl = document.getElementById('placement-breakdown');
            if (breakdownEl) {
                breakdownEl.replaceChildren();
                const heading = document.createElement('h4');
                heading.style.marginBottom = '12px';
                heading.style.color = '#374151';
                heading.textContent = '📊 Score Breakdown:';
                breakdownEl.appendChild(heading);

                for (const level in levelScores) {
                    const data = levelScores[level];
                    const percent = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;

                    const row = document.createElement('div');
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';
                    row.style.padding = '12px 16px';
                    row.style.background = 'white';
                    row.style.borderRadius = '8px';
                    row.style.marginBottom = '8px';

                    const levelSpan = document.createElement('span');
                    levelSpan.style.fontWeight = '600';
                    levelSpan.textContent = String(level);

                    const scoreSpan = document.createElement('span');
                    scoreSpan.style.color = '#6366f1';
                    scoreSpan.style.fontWeight = '600';
                    scoreSpan.textContent = `${data.correct}/${data.total} (${percent}%)`;

                    row.appendChild(levelSpan);
                    row.appendChild(scoreSpan);
                    breakdownEl.appendChild(row);
                }
            }

            // Save results
            if (window.State) {
                window.State.moduleMastery.placementTest = {
                    completed: true,
                    score: correct,
                    recommendedModule: recommendedModule,
                    dateTaken: new Date().toISOString()
                };
                window.State.userProgress.placementCompleted = true;
                window.Storage.save();
            }
            this.state.score = correct;
        };

        PlacementModule.retake = function() {
            this.init();
        };

        PlacementModule.startLearning = function() {
            if (window.Navigation) {
                window.Navigation.showSection('guide');
            }
        };

    // ========================================
    // EXPOSE GLOBALLY
    // ========================================
    window.QuizModule = QuizModule;
    // PlacementTest removed - use PlacementModule only
    window.PlacementModule = PlacementModule;

})();
