/**
 * PRAGMATICS SCAFFOLD COMPONENT
 *
 * Purpose: Research-grade structured pragmatic analysis component
 *
 * Provides 6-element scaffold for analyzing humor and pragmatic competence:
 * 1. Pragmatic Target - What linguistic feature is being used
 * 2. Trigger/Cue - What to notice in the utterance
 * 3. Inference - What is meant but not said
 * 4. Social Variables - Power, Distance, Imposition (P/D/I)
 * 5. Appropriacy - Where it works/fails
 * 6. Repair Option - What to say instead
 *
 * Used in: Jokes, Examples, Activities, Reflection
 */

(function() {
    'use strict';

    console.log('📊 Loading Pragmatics Scaffold Component...');

    // ========================================
    // PRAGMATICS SCAFFOLD CARD COMPONENT
    // ========================================

    const PragmaticsScaffold = {

        sanitizeHTML: function(value) {
            const temp = document.createElement('div');
            temp.textContent = value == null ? '' : String(value);
            return temp.innerHTML;
        },

        sanitizeId: function(value) {
            const str = value == null ? '' : String(value);
            const cleaned = str.replace(/[^a-zA-Z0-9_-]/g, '');
            return cleaned || ('scaffold-' + Math.random().toString(36).slice(2));
        },

        /**
         * Default scaffold template structure
         */
        defaultScaffold: {
            target: '',
            trigger: '',
            inference: '',
            socialVariables: { power: '', distance: '', imposition: '' },
            appropriacy: { works: '', fails: '' },
            repair: ''
        },

        /**
         * Render a complete scaffold card
         * @param {Object} scaffoldData - Scaffold data object
         * @param {Object} options - Rendering options
         * @returns {string} HTML string
         */
        render: function(scaffoldData, options = {}) {
            const data = { ...this.defaultScaffold, ...scaffoldData };
            const {
                showToggle = true,
                expanded = false,
                cardId = 'scaffold-' + Math.random().toString(36).substr(2, 9)
            } = options;

            const safeCardId = this.sanitizeId(cardId);
            const expandedClass = expanded ? 'expanded' : '';
            const expandedAttr = expanded ? 'true' : 'false';

            return `
                <div class="pragmatics-scaffold-card ${expandedClass}" id="${safeCardId}">
                    ${showToggle ? this.renderToggleButton(safeCardId, expanded) : ''}

                    <div class="scaffold-content" data-scaffold-id="${safeCardId}">
                        <div class="scaffold-header">
                            <h4>📊 Pragmatic Analysis Scaffold</h4>
                            <p class="scaffold-description">
                                Research-grade structured analysis of pragmatic competence
                            </p>
                        </div>

                        <div class="scaffold-grid">
                            ${this.renderTarget(data.target)}
                            ${this.renderTrigger(data.trigger)}
                            ${this.renderInference(data.inference)}
                            ${this.renderSocialVariables(data.socialVariables)}
                            ${this.renderAppropriacyData(data.appropriacy)}
                            ${this.renderRepair(data.repair)}
                        </div>

                        ${this.renderResearchNote()}
                    </div>
                </div>
            `;
        },

        renderToggleButton: function(cardId, expanded) {
            return `
                <button class="scaffold-toggle"
                        data-action="scaffold-toggle"
                        data-card-id="${cardId}"
                        aria-expanded="${expanded}"
                        aria-controls="${cardId}">
                    <span class="toggle-icon">${expanded ? '▼' : '▶'}</span>
                    <span class="toggle-text">${expanded ? 'Hide' : 'Show'} Pragmatic Scaffold</span>
                </button>
            `;
        },

        renderTarget: function(target) {
            const safeTarget = target ? this.sanitizeHTML(target) : '';
            return `
                <div class="scaffold-item scaffold-target">
                    <div class="scaffold-item-header">
                        <span class="scaffold-icon">🎯</span>
                        <h5>Pragmatic Target</h5>
                    </div>
                    <div class="scaffold-item-content">
                        <p class="scaffold-label">What linguistic/pragmatic feature?</p>
                        <div class="scaffold-value">${safeTarget || '<em>Not specified</em>'}</div>
                    </div>
                </div>
            `;
        },

        renderTrigger: function(trigger) {
            const safeTrigger = trigger ? this.sanitizeHTML(trigger) : '';
            return `
                <div class="scaffold-item scaffold-trigger">
                    <div class="scaffold-item-header">
                        <span class="scaffold-icon">👁️</span>
                        <h5>Trigger/Cue</h5>
                    </div>
                    <div class="scaffold-item-content">
                        <p class="scaffold-label">What to notice in the utterance?</p>
                        <div class="scaffold-value">${safeTrigger || '<em>Not specified</em>'}</div>
                    </div>
                </div>
            `;
        },

        renderInference: function(inference) {
            const safeInference = inference ? this.sanitizeHTML(inference) : '';
            return `
                <div class="scaffold-item scaffold-inference">
                    <div class="scaffold-item-header">
                        <span class="scaffold-icon">💭</span>
                        <h5>Inference</h5>
                    </div>
                    <div class="scaffold-item-content">
                        <p class="scaffold-label">What is meant but not said?</p>
                        <div class="scaffold-value highlight-inference">${safeInference || '<em>Not specified</em>'}</div>
                    </div>
                </div>
            `;
        },

        renderSocialVariables: function(social) {
            const safeSocial = social && typeof social === 'object' ? social : {};
            const safePower = safeSocial.power ? this.sanitizeHTML(safeSocial.power) : '';
            const safeDistance = safeSocial.distance ? this.sanitizeHTML(safeSocial.distance) : '';
            const safeImposition = safeSocial.imposition ? this.sanitizeHTML(safeSocial.imposition) : '';
            return `
                <div class="scaffold-item scaffold-social">
                    <div class="scaffold-item-header">
                        <span class="scaffold-icon">👥</span>
                        <h5>Social Variables (P/D/I)</h5>
                    </div>
                    <div class="scaffold-item-content">
                        <p class="scaffold-label">Brown & Levinson's face-threat dimensions:</p>
                        <div class="social-grid">
                            <div class="social-var">
                                <strong>Power (P):</strong>
                                <span>${safePower || '<em>Not specified</em>'}</span>
                            </div>
                            <div class="social-var">
                                <strong>Distance (D):</strong>
                                <span>${safeDistance || '<em>Not specified</em>'}</span>
                            </div>
                            <div class="social-var">
                                <strong>Imposition (I):</strong>
                                <span>${safeImposition || '<em>Not specified</em>'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        renderAppropriacyData: function(appropriacyData) {
            const safeApp = appropriacyData && typeof appropriacyData === 'object' ? appropriacyData : {};
            const safeWorks = safeApp.works ? this.sanitizeHTML(safeApp.works) : '';
            const safeFails = safeApp.fails ? this.sanitizeHTML(safeApp.fails) : '';
            return `
                <div class="scaffold-item scaffold-appropriacy">
                    <div class="scaffold-item-header">
                        <span class="scaffold-icon">✓</span>
                        <h5>Appropriacy</h5>
                    </div>
                    <div class="scaffold-item-content">
                        <div class="appropriacy-section works">
                            <strong>✅ Works well when:</strong>
                            <p>${safeWorks || '<em>Not specified</em>'}</p>
                        </div>
                        <div class="appropriacy-section fails">
                            <strong>❌ Fails/Inappropriate when:</strong>
                            <p>${safeFails || '<em>Not specified</em>'}</p>
                        </div>
                    </div>
                </div>
            `;
        },

        renderRepair: function(repair) {
            const safeRepair = repair ? this.sanitizeHTML(repair) : '';
            return `
                <div class="scaffold-item scaffold-repair">
                    <div class="scaffold-item-header">
                        <span class="scaffold-icon">🔧</span>
                        <h5>Repair Option</h5>
                    </div>
                    <div class="scaffold-item-content">
                        <p class="scaffold-label">Alternative pragmatically appropriate form:</p>
                        <div class="scaffold-value repair-value">"${safeRepair || '<em>Not specified</em>'}"</div>
                    </div>
                </div>
            `;
        },

        renderResearchNote: function() {
            return `
                <div class="scaffold-research-note">
                    <details>
                        <summary>📚 Theoretical Framework</summary>
                        <div class="research-content">
                            <p>This scaffold integrates:</p>
                            <ul>
                                <li><strong>Speech Act Theory</strong> (Austin, Searle) - Pragmatic function</li>
                                <li><strong>Gricean Maxims</strong> - Conversational implicature</li>
                                <li><strong>Politeness Theory</strong> (Brown & Levinson) - P/D/I variables</li>
                                <li><strong>Relevance Theory</strong> (Sperber & Wilson) - Inferential communication</li>
                            </ul>
                        </div>
                    </details>
                </div>
            `;
        },

        /**
         * Toggle scaffold visibility
         * @param {string} cardId - Scaffold card ID
         */
        toggle: function(cardId) {
            const card = document.getElementById(cardId);
            if (!card) return;

            const isExpanded = card.classList.toggle('expanded');
            const button = card.querySelector('.scaffold-toggle');

            if (button) {
                button.setAttribute('aria-expanded', isExpanded);
                const icon = button.querySelector('.toggle-icon');
                const text = button.querySelector('.toggle-text');
                if (icon) icon.textContent = isExpanded ? '▼' : '▶';
                if (text) text.textContent = (isExpanded ? 'Hide' : 'Show') + ' Pragmatic Scaffold';
            }
        },

        /**
         * Extract scaffold data from joke object
         * @param {Object} joke - Joke data with analysis
         * @returns {Object} Scaffold data
         */
        extractFromJoke: function(joke) {
            if (joke.scaffold) {
                return joke.scaffold;
            }

            // Auto-generate basic scaffold from existing joke data
            return {
                target: joke.type || 'Humor analysis',
                trigger: joke.text,
                inference: joke.analysis || '',
                socialVariables: {
                    power: 'Equal',
                    distance: 'Varies by context',
                    imposition: 'Low (social humor)'
                },
                appropriacy: {
                    works: 'Casual social contexts, language learning',
                    fails: 'Formal settings, without cultural context'
                },
                repair: joke.learningPoints?.[0] || 'Consider cultural appropriateness'
            };
        },

        /**
         * Create scaffold for activity
         * @param {Object} activity - Activity data
         * @returns {Object} Scaffold data
         */
        extractFromActivity: function(activity) {
            return activity.scaffold || {
                target: activity.pragmaticFocus || 'Pragmatic competence',
                trigger: activity.task || activity.description,
                inference: 'Practice applying pragmatic rules in context',
                socialVariables: {
                    power: 'Context-dependent',
                    distance: 'Varies',
                    imposition: 'Moderate (learning task)'
                },
                appropriacy: {
                    works: 'Structured learning environments',
                    fails: 'Without guidance or feedback'
                },
                repair: 'Seek clarification if uncertain about pragmatic norms'
            };
        }
    };

    // ========================================
    // TEACHER MODE TOGGLE
    // ========================================

    const ScaffoldSettings = {
        teacherModeEnabled: false,
        scaffoldVisible: true,

        init: function() {
            // Load from localStorage
            try {
                this.teacherModeEnabled = localStorage.getItem('teacherMode') === 'true';
                this.scaffoldVisible = localStorage.getItem('scaffoldVisible') !== 'false';
            } catch (e) {
                this.teacherModeEnabled = false;
                this.scaffoldVisible = true;
            }
        },

        toggleTeacherMode: function() {
            this.teacherModeEnabled = !this.teacherModeEnabled;
            localStorage.setItem('teacherMode', this.teacherModeEnabled);

            // Update UI
            this.updateTeacherModeUI();

            return this.teacherModeEnabled;
        },

        toggleScaffoldVisibility: function() {
            this.scaffoldVisible = !this.scaffoldVisible;
            localStorage.setItem('scaffoldVisible', this.scaffoldVisible);

            // Toggle all scaffolds
            const scaffolds = document.querySelectorAll('.pragmatics-scaffold-card');
            scaffolds.forEach(scaffold => {
                if (this.scaffoldVisible) {
                    scaffold.classList.remove('scaffold-hidden');
                } else {
                    scaffold.classList.add('scaffold-hidden');
                }
            });

            return this.scaffoldVisible;
        },

        updateTeacherModeUI: function() {
            const teacherButtons = document.querySelectorAll('.teacher-controls');
            teacherButtons.forEach(btn => {
                btn.style.display = this.teacherModeEnabled ? 'block' : 'none';
            });
        }
    };

    // ========================================
    // EXPOSE GLOBALLY
    // ========================================

    window.PragmaticsScaffold = PragmaticsScaffold;
    window.ScaffoldSettings = ScaffoldSettings;

    // Initialize settings
    ScaffoldSettings.init();

    console.log('✓ Pragmatics Scaffold Component loaded');

})();
