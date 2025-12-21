/**
 * MODULE LEARNING MODULE
 *
 * Purpose: Handle module-based learning flow and module theory content
 *
 * Responsibilities:
 * - Store MODULE_THEORY_CONTENT (theory for all 6 modules)
 * - ModuleModal (show module details and start learning)
 * - ModuleLearning (progress through module steps)
 *
 * Dependencies: State, DataLoader, Router, UI, Assessment
 * Used by: Module cards, navigation, learning path
 */

(function() {
    'use strict';

    console.log('LOADED: js/module-learning.js');

    // These modules are attached to `window` by other script files. Because this file
    // is wrapped in an IIFE, unqualified references like `State`/`Navigation` would
    // otherwise throw ReferenceError at runtime.
    var State = window.State;
    var Storage = window.Storage;
    var Navigation = window.Navigation;
    var Breadcrumb = window.Breadcrumb;

    // Ensure modal globals always exist, even if init order changes.
    window.ModuleModal = window.ModuleModal || {};
    window.ModuleModal.state = window.ModuleModal.state || { currentModule: null };
    window.ModuleModal.__ready = false;

    // Safe fallback celebration (original implementation removed in refactor)
    function showStepCompletionCelebration(stepName) {
        console.debug('[showStepCompletionCelebration skipped]', stepName);
    }

    // Basic HTML sanitizer to prevent unsafe injection in modal rendering
    function sanitizeHTML(str) {
        var temp = document.createElement('div');
        temp.textContent = str == null ? '' : String(str);
        return temp.innerHTML;
    }

    // Safe localStorage utilities
    function safeLocalStorageGet(key, defaultValue) {
        try {
            var value = localStorage.getItem(key);
            return value !== null ? value : defaultValue;
        } catch (e) {
            console.warn('localStorage.getItem failed:', e);
            return defaultValue;
        }
    }

    function safeLocalStorageSet(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn('localStorage.setItem failed:', e);
            return false;
        }
    }

    function safeJSONParse(str, defaultValue) {
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn('JSON.parse failed:', e);
            return defaultValue;
        }
    }

    function countWords(text) {
        var trimmed = String(text || '').trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }

    // Safe UI updater for module progress widgets (shared across modules)
    function updateModuleProgressUI() {
        try {
            var modules = (window.LEARNING_SYSTEM && Array.isArray(window.LEARNING_SYSTEM.modules))
                ? window.LEARNING_SYSTEM.modules
                : [];
            var mastery = State && State.moduleMastery && State.moduleMastery.modules
                ? State.moduleMastery.modules
                : {};

            if (!modules.length) return;

            var completedCount = 0;
            var inProgressCount = 0;

            modules.forEach(function(mod) {
                var progress = mastery[mod.id] || {};
                var isCompleted = !!progress.completed;
                var isInProgress = !isCompleted && (
                    progress.started ||
                    (progress.theory && progress.theory.completed) ||
                    (progress.jokes && progress.jokes.analyzed && progress.jokes.analyzed.length > 0) ||
                    (progress.activities && progress.activities.completed && progress.activities.completed.length > 0) ||
                    (progress.postTest && progress.postTest.completed)
                );

                if (isCompleted) {
                    completedCount++;
                } else if (isInProgress) {
                    inProgressCount++;
                }

                var statusEl = document.querySelector('.module-progress-card[data-module="' + mod.id + '"] .module-progress-status');
                var fillMini = document.querySelector('.module-progress-card[data-module="' + mod.id + '"] .module-progress-fill-mini');
                var pill = document.querySelector('.module-progress[data-module-progress="' + mod.id + '"]');

                var percent = 0;
                if (isCompleted) {
                    percent = 100;
                } else if (typeof progress.masteryScore === 'number') {
                    percent = Math.max(0, Math.min(100, Math.round(progress.masteryScore)));
                } else if (progress.postTest && typeof progress.postTest.score === 'number') {
                    percent = Math.max(0, Math.min(100, Math.round(progress.postTest.score)));
                } else if (isInProgress) {
                    percent = 25;
                }

                var statusLabel = 'Not Started';
                if (!isCompleted && !isInProgress && progress.unlocked === false) {
                    statusLabel = 'Locked';
                } else if (isCompleted) {
                    statusLabel = 'Completed';
                } else if (isInProgress) {
                    statusLabel = 'In Progress';
                }

                if (statusEl) {
                    statusEl.textContent = statusLabel;
                }
                if (fillMini) {
                    fillMini.style.width = percent + '%';
                }
                if (pill) {
                    pill.textContent = statusLabel + (percent ? ' \u2022 ' + percent + '%' : '');
                }
            });

            var totalCount = modules.length || 1;
            var overallPercent = Math.round((completedCount / totalCount) * 100);

            var completedNode = document.getElementById('modules-completed-count');
            var inProgressNode = document.getElementById('modules-in-progress-count');
            var overallPercentNode = document.getElementById('overall-progress-percent');
            var overallProgressText = document.getElementById('overall-progress-text');
            var overallProgressBar = document.getElementById('overall-progress-bar');

            if (completedNode) completedNode.textContent = completedCount;
            if (inProgressNode) inProgressNode.textContent = inProgressCount;
            if (overallPercentNode) overallPercentNode.textContent = overallPercent + '%';
            if (overallProgressText) overallProgressText.textContent = overallPercent + '%';
            if (overallProgressBar) overallProgressBar.style.width = overallPercent + '%';
        } catch (err) {
            console.warn('updateModuleProgressUI failed (non-blocking):', err);
        }
    }
    window.updateModuleProgressUI = updateModuleProgressUI;

    var moduleTheoryAccordionBound = false;

    function ensureModuleTheoryAccordionDelegation() {
        if (moduleTheoryAccordionBound) return;
        moduleTheoryAccordionBound = true;

        document.addEventListener('click', function(e) {
            var btn = e.target.closest('.accordion-header[data-accordion-toggle="module-theory"]');
            if (!btn) return;

            var controlsId = btn.getAttribute('aria-controls') || btn.getAttribute('data-accordion-panel');
            if (!controlsId) return;

            var body = document.getElementById(controlsId);
            if (!body) return;

            var isOpen = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', String(!isOpen));
            body.setAttribute('aria-hidden', String(isOpen));

            body.classList.toggle('is-open', !isOpen);
            body.classList.toggle('open', !isOpen); // keep legacy styling compatibility

            var chevron = btn.querySelector('.accordion-chevron');
            if (chevron) chevron.textContent = isOpen ? '▼' : '▲';
        });
    }

    function setPracticeFeedback(feedbackEl, kind, message) {
        if (!feedbackEl) return;
        feedbackEl.style.display = 'block';
        if (kind === 'success') {
            feedbackEl.style.background = '#d4edda';
            feedbackEl.style.border = '2px solid #28a745';
        } else if (kind === 'warning') {
            feedbackEl.style.background = '#fff3cd';
            feedbackEl.style.border = '2px solid #ffc107';
        } else {
            feedbackEl.style.background = '#f8d7da';
            feedbackEl.style.border = '2px solid #dc3545';
        }
        feedbackEl.textContent = String(message || '');
    }

    // Practice-check functions must be real JS (not embedded <script> in HTML strings) for CSP to work.
    function checkSO1() {
        var inputA = document.getElementById('so-practice-1a');
        var inputB = document.getElementById('so-practice-1b');
        var feedback = document.getElementById('so-feedback-1');
        if (!inputA || !inputB) return;

        var answerA = String(inputA.value || '').toLowerCase();
        var answerB = String(inputB.value || '').toLowerCase();

        var correctKeywordsA = ['career', 'job', 'quit', 'stop', 'banking'];
        var correctKeywordsB = ['interest rate', 'money', 'financial', 'rate', 'bank interest'];

        var hasA = correctKeywordsA.some(function(word) { return answerA.includes(word); });
        var hasB = correctKeywordsB.some(function(word) { return answerB.includes(word); });

        if ((hasA || (answerA.includes('interest') && answerA.includes('enthusiasm'))) &&
            (hasB || (answerB.includes('interest') && answerB.includes('bank')))) {
            setPracticeFeedback(
                feedback,
                'success',
                '🎉 Excellent!\n\n' +
                'Script A: "Lost interest" = lost enthusiasm/motivation for banking career\n' +
                'Script B: "Lost interest" = lost the interest rates/money (banking term)\n\n' +
                'Opposition Type: Literal vs. Figurative (or Professional vs. Financial)\n' +
                'The joke works because "interest" has two completely different meanings!'
            );
            return;
        }

        if (answerA.length > 3 && answerB.length > 3) {
            setPracticeFeedback(
                feedback,
                'warning',
                '💭 Good try! Think More Specifically:\n\n' +
                '💡 Hint: Focus on the word "interest" - it has TWO meanings in this joke.\n' +
                '• What does "interest" mean when talking about your job/motivation?\n' +
                '• What does "interest" mean in banking/finance?\n\n' +
                'Try again!'
            );
            return;
        }

        setPracticeFeedback(
            feedback,
            'error',
            '⚠️ Please write your answers first!\n\n' +
            'Think about what "lost interest" could mean in two different ways.'
        );
    }

    function checkSO2() {
        var inputA = document.getElementById('so-practice-2a');
        var inputB = document.getElementById('so-practice-2b');
        var feedback = document.getElementById('so-feedback-2');
        if (!inputA || !inputB) return;

        var answerA = String(inputA.value || '').toLowerCase();
        var answerB = String(inputB.value || '').toLowerCase();

        var mentionsPhysical = answerA.includes('put down') || answerA.includes('physical') || answerA.includes('gravity') || answerA.includes('float') || answerA.includes('anti-gravity');
        var mentionsInterest = answerB.includes('interesting') || answerB.includes('stop reading') || answerB.includes('engaging') || answerB.includes('captivat');

        var reverse = answerB.includes('put down') || answerB.includes('physical');
        var reverseInt = answerA.includes('interesting') || answerA.includes('stop reading');

        if ((mentionsPhysical && mentionsInterest) || (reverse && reverseInt)) {
            setPracticeFeedback(
                feedback,
                'success',
                '🎉 Perfect Analysis!\n\n' +
                'Script A: "Impossible to put down" = physically cannot put it down (because anti-gravity makes it float)\n' +
                'Script B: "Impossible to put down" = so interesting you cannot stop reading\n\n' +
                'Opposition Type: Literal (physical) vs. Figurative (idiom)\n' +
                'This is a classic example of playing with literal and idiomatic meanings!'
            );
            return;
        }

        if (answerA.length > 3 && answerB.length > 3) {
            setPracticeFeedback(
                feedback,
                'warning',
                '💭 You\'re on the right track!\n\n' +
                '💡 Hint: Think about the phrase "impossible to put down"\n' +
                '• What does it mean LITERALLY if something has anti-gravity?\n' +
                '• What does "can\'t put down a book" mean as an idiom/expression?\n\n' +
                'These are your two opposing scripts!'
            );
            return;
        }

        setPracticeFeedback(
            feedback,
            'error',
            '⚠️ Please provide both answers!\n\n' +
            'Focus on "impossible to put down" - what could this mean in two different ways?'
        );
    }

    function checkLM1() {
        var selected = document.querySelector('input[name="lm1"]:checked');
        var feedback = document.getElementById('lm-feedback-1');

        if (!selected) {
            setPracticeFeedback(feedback, 'error', '⚠️ Please select an answer first!');
            return;
        }

        if (selected.value === 'ambiguity') {
            setPracticeFeedback(
                feedback,
                'success',
                '🎉 Correct! AMBIGUITY\n\n' +
                'The phrase "looked surprised" has TWO meanings:\n' +
                '1. Emotional state: She felt surprised (normal interpretation)\n' +
                '2. Physical appearance: Her face looked like a surprised expression (because eyebrows were too high)\n\n' +
                'The ambiguity of "looked surprised" is what makes the joke work!\n\n' +
                'Full Analysis:\n' +
                '• SO: Emotion vs. Physical appearance\n' +
                '• LM: Ambiguity in "looked surprised"'
            );
            return;
        }

        if (selected.value === 'garden') {
            setPracticeFeedback(
                feedback,
                'warning',
                '💭 Close, but not quite!\n\n' +
                'While the joke does lead you to think about emotion first, the KEY mechanism is that "looked surprised" can mean two different things.\n\n' +
                '💡 Hint: What do we call it when a word or phrase has multiple meanings?'
            );
            return;
        }

        setPracticeFeedback(
            feedback,
            'warning',
            'Not quite.\n\n' +
            '💭 Think about this: The phrase "looked surprised" can be understood in TWO different ways. What mechanism involves words/phrases with multiple meanings?\n\n' +
            'Try again!'
        );
    }

    function checkLM2() {
        var input = document.getElementById('lm-practice-2');
        var feedback = document.getElementById('lm-feedback-2');
        if (!input) return;

        var answer = String(input.value || '').toLowerCase();
        if (answer.length < 10) {
            setPracticeFeedback(feedback, 'error', '⚠️ Please write your explanation!');
            return;
        }

        var mentionsGarden = answer.includes('garden') || answer.includes('mislead') || answer.includes('expect');
        var mentionsReinterpret = answer.includes('reinterpret') || answer.includes('switch') || answer.includes('two ways');
        var mentionsSleep = answer.includes('sleep') && (answer.includes('continuous') || answer.includes('10 days straight'));

        if (mentionsGarden || mentionsReinterpret || mentionsSleep) {
            setPracticeFeedback(
                feedback,
                'success',
                '🎉 Great analysis!\n\n' +
                'Logical Mechanism: GARDEN PATH\n\n' +
                'The joke leads you down a misleading path:\n' +
                '1. First interpretation: "I haven\'t slept for ten days" = I\'ve been awake for 10 days (which sounds alarming!)\n' +
                '2. Punchline reveal: "that would be too long" → Wait, no one sleeps for 10 days STRAIGHT. The person means they sleep every night normally!\n\n' +
                'The mechanism makes you think of continuous sleeplessness first, then forces you to reinterpret.\n\n' +
                'Full Analysis:\n' +
                '• SO: Continuous sleeplessness vs. Normal sleep pattern\n' +
                '• LM: Garden path (misleading interpretation)'
            );
            return;
        }

        setPracticeFeedback(
            feedback,
            'warning',
            '💭 Think about the structure:\n\n' +
            '💡 When you first hear "I haven\'t slept for ten days", what do you think?\n' +
            '💡 Then what does "that would be too long" make you realize?\n\n' +
            'This joke intentionally MISLEADS you, then makes you reinterpret. What mechanism does that?'
        );
    }

    function checkSITA1() {
        var siEl = document.getElementById('si-practice-1');
        var taEl = document.getElementById('ta-practice-1');
        var feedback = document.getElementById('sita-feedback-1');
        if (!siEl || !taEl) return;

        var si = String(siEl.value || '');
        var ta = String(taEl.value || '');
        if (!si || !ta) {
            setPracticeFeedback(feedback, 'error', '⚠️ Please answer both questions!');
            return;
        }

        var siCorrect = si === 'workplace';
        var taCorrect = ta === 'self' || ta === 'work';

        if (siCorrect && taCorrect) {
            var targetLabel = ta === 'self'
                ? 'Self (the employee who doesn\'t want to work)'
                : 'Work culture (the idea that work is unpleasant)';
            setPracticeFeedback(
                feedback,
                'success',
                '🎉 Perfect Analysis!\n\n' +
                'Situation (SI): Workplace/Office - The boss-employee relationship\n' +
                'Target (TA): ' + targetLabel + '\n\n' +
                'Why this matters:\n' +
                '• The joke only works if you understand office culture\n' +
                '• "Have a good day" is a common workplace phrase\n' +
                '• The humor comes from interpreting it literally and escaping work\n\n' +
                'Complete GTVH Analysis:\n' +
                '• SO: Polite workplace phrase vs. Permission to leave\n' +
                '• LM: Deliberate misinterpretation\n' +
                '• SI: Workplace\n' +
                '• TA: Work culture / Self'
            );
            return;
        }

        if (siCorrect) {
            setPracticeFeedback(
                feedback,
                'warning',
                '💭 Situation is correct, but reconsider the target!\n\n' +
                '💡 Hint: Who is portrayed negatively here? The person who doesn\'t want to work, or the work itself?\n' +
                'Both answers (self or work culture) could be valid!'
            );
            return;
        }

        if (taCorrect) {
            setPracticeFeedback(
                feedback,
                'warning',
                '💭 Target is correct, but reconsider the situation!\n\n' +
                '💡 Hint: Where does this interaction happen? Think about the boss-employee relationship.'
            );
            return;
        }

        setPracticeFeedback(
            feedback,
            'warning',
            '💭 Not quite right.\n\n' +
            '💡 For Situation: Who is the boss talking to? Where does this happen?\n' +
            '💡 For Target: Who looks bad in this joke - the boss or the employee?'
        );
    }

    function checkSITA2() {
        var siEl = document.getElementById('si-practice-2');
        var taEl = document.getElementById('ta-practice-2');
        var feedback = document.getElementById('sita-feedback-2');
        if (!siEl || !taEl) return;

        var si = String(siEl.value || '').toLowerCase();
        var ta = String(taEl.value || '').toLowerCase();
        if (si.length < 5 || ta.length < 3) {
            setPracticeFeedback(feedback, 'error', '⚠️ Please write both answers!');
            return;
        }

        var siGood = (si.includes('home') || si.includes('couple') || si.includes('married') || si.includes('domestic') || si.includes('relationship'));
        var taGood = (ta.includes('wife') || ta.includes('spouse') || ta.includes('gentle') || ta.includes('teas'));

        if (siGood && taGood) {
            setPracticeFeedback(
                feedback,
                'success',
                '🎉 Excellent understanding!\n\n' +
                'Situation (SI): Domestic/home setting - married couple having a casual conversation about appearance\n' +
                'Target (TA): The wife (gentle teasing between partners)\n\n' +
                'Cultural Note:\n' +
                '• This type of gentle teasing is common between British couples\n' +
                '• The joke targets the wife BUT in a playful, affectionate way\n' +
                '• In some cultures, criticizing a partner\'s appearance might not be funny - context matters!\n\n' +
                'Why SI matters here: The joke works because of the intimate relationship where gentle teasing is acceptable.'
            );
            return;
        }

        if (siGood) {
            setPracticeFeedback(
                feedback,
                'warning',
                '🎉 Good situation analysis!\n\n' +
                '💡 For the target: Who is being made fun of in this joke? Think about who the criticism is directed at.'
            );
            return;
        }

        if (taGood) {
            setPracticeFeedback(
                feedback,
                'warning',
                '🎉 Good target identification!\n\n' +
                '💡 For the situation: Think about WHERE this conversation happens and WHAT the relationship is between the two people.'
            );
            return;
        }

        setPracticeFeedback(
            feedback,
            'warning',
            '💭 Think More Specifically:\n\n' +
            '💡 Situation: Where are these people? What\'s their relationship?\n' +
            '💡 Target: Whose appearance is being criticized/teased?'
        );
    }

    function checkNS1() {
        var select = document.getElementById('ns-practice-1');
        var feedback = document.getElementById('ns-feedback-1');
        if (!select) return;
        var answer = String(select.value || '');

        if (!answer) {
            setPracticeFeedback(feedback, 'error', '⚠️ Please select an answer!');
            return;
        }

        if (answer === 'qa') {
            setPracticeFeedback(
                feedback,
                'success',
                '🎉 Correct! Question-Answer (Riddle Format)\n\n' +
                'This joke uses the classic riddle structure:\n' +
                '1. Question: "Why don\'t scientists trust atoms?"\n' +
                '2. Answer/Punchline: "Because they make up everything"\n\n' +
                'Why this NS matters:\n' +
                '• The question creates expectation and curiosity\n' +
                '• The listener knows a punchline is coming\n' +
                '• This format is VERY common in English-language jokes\n' +
                '• It\'s easy to remember and retell\n\n' +
                'Tip for learners: When you hear "Why..." or "What..." at the start, prepare for a punchline answer!'
            );
            return;
        }

        if (answer === 'simple') {
            setPracticeFeedback(
                feedback,
                'warning',
                '💭 Close, but be More Specific!\n\n' +
                'Yes, there\'s a setup and punchline, but what\'s the specific FORMAT here?\n' +
                '💡 Hint: It starts with "Why..." - what kind of joke structure uses questions?'
            );
            return;
        }

        setPracticeFeedback(
            feedback,
            'warning',
            '💭 Not quite.\n\n' +
            '💡 Look at the structure: The joke asks a QUESTION ("Why don\'t...?") and then provides an ANSWER. What do we call this format?'
        );
    }

    function checkNS2() {
        var q2 = document.getElementById('ns-practice-2a');
        var q3 = document.getElementById('ns-practice-2b');
        var feedback = document.getElementById('ns-feedback-2');
        if (!q2 || !q3) return;

        var ans2a = String(q2.value || '');
        var ans2b = String(q3.value || '');

        if (!ans2a || !ans2b) {
            setPracticeFeedback(feedback, 'error', '⚠️ Please answer both questions!');
            return;
        }

        var correct2a = ans2a === 'observational';
        var correct2b = ans2b === 'subvert' || ans2b === 'simple';

        if (correct2a && ans2b === 'subvert') {
            setPracticeFeedback(
                feedback,
                'success',
                '🎉 Perfect! Both correct!\n\n' +
                'Joke 2 - Observational:\n' +
                '"I\'m not saying I\'m Batman..." makes an observation/claim about reality. It\'s presented as a statement, not a story or question.\n\n' +
                'Joke 3 - Subverted Story:\n' +
                '"A man walks into a bar" is a CLASSIC joke opening that usually leads to a long story. But this joke subverts expectations by ending immediately with "Ouch" (he walked into a metal bar/pole, not a pub!)\n\n' +
                'NS Insight: This joke plays with narrative expectations - you expect a long bar joke, but get a one-liner instead!'
            );
            return;
        }

        if (correct2a && correct2b) {
            setPracticeFeedback(
                feedback,
                'success',
                '🎉 Good analysis!\n\n' +
                'Joke 2 - Observational: Correct! It\'s a statement/observation about reality.\n\n' +
                'Joke 3 - Simple Narrative: Yes, technically it\'s setup→punchline, but there\'s something special here:\n' +
                '💡 "A man walks into a bar" is a FAMOUS joke opening in English. This joke plays with that expectation - you expect a long story, but get "Ouch" instead. It\'s a subverted story format!'
            );
            return;
        }

        if (correct2a) {
            setPracticeFeedback(
                feedback,
                'warning',
                '🎉 Joke 2 is correct!\n\n' +
                '💡 For Joke 3: Think about the phrase "A man walks into a bar" - this is a VERY famous joke opening in English culture. What does this joke do with that expectation?'
            );
            return;
        }

        if (correct2b) {
            setPracticeFeedback(
                feedback,
                'warning',
                '🎉 Joke 3 is correct!\n\n' +
                '💡 For Joke 2: It\'s not really a story. The person is making a statement/observation about themselves and Batman. What strategy is that?'
            );
            return;
        }

        setPracticeFeedback(
            feedback,
            'warning',
            '💭 Let\'s think about these:\n\n' +
            '💡 Joke 2: "I\'m not saying... I\'m just saying..." - This is making a statement/observation, not telling a story.\n\n' +
            '💡 Joke 3: "A man walks into a bar" is a classic joke opening. How does this joke play with that?'
        );
    }

    function checkLA1() {
        var featureEl = document.getElementById('la-practice-1');
        var wordEl = document.getElementById('la-practice-1-word');
        var feedback = document.getElementById('la-feedback-1');
        if (!featureEl || !wordEl) return;

        var feature = String(featureEl.value || '');
        var word = String(wordEl.value || '').toLowerCase();

        if (!feature || word.length < 2) {
            setPracticeFeedback(feedback, 'error', '⚠️ Please answer both questions!');
            return;
        }

        var correctFeature = feature === 'idiom';
        var correctWord = word.includes('put down') || word.includes('impossible to put down');

        if (correctFeature && correctWord) {
            setPracticeFeedback(
                feedback,
                'success',
                '🎉 Perfect! Idiom Literalization\n\n' +
                'The phrase: "impossible to put down"\n\n' +
                'Two meanings:\n' +
                '1. Literal: Cannot physically put it down (because of anti-gravity)\n' +
                '2. Figurative/Idiom: So interesting you cannot stop reading\n\n' +
                'Language Analysis:\n' +
                '• "Put down" is an idiom meaning "stop reading"\n' +
                '• The joke activates BOTH the literal and idiomatic meaning\n' +
                '• This is a classic example of playing with literal vs. figurative language\n\n' +
                'Full GTVH:\n' +
                '• SO: Physical impossibility vs. Compelling book\n' +
                '• LM: Ambiguity\n' +
                '• LA: Idiom literalization of "put down"'
            );
            return;
        }

        if (correctFeature) {
            setPracticeFeedback(
                feedback,
                'warning',
                '🎉 Correct feature!\n\n' +
                '💡 But which exact phrase has both literal and figurative meanings?\n' +
                '💡 Hint: What does "put down a book" mean idiomatically? What does it mean literally with anti-gravity?'
            );
            return;
        }

        if (correctWord) {
            setPracticeFeedback(
                feedback,
                'warning',
                '🎉 Correct phrase!\n\n' +
                '💡 But what type of language feature is this?\n' +
                '💡 Hint: "Put down" is normally used as an IDIOM (stop reading), but here it\'s also understood LITERALLY. What do we call that?'
            );
            return;
        }

        setPracticeFeedback(
            feedback,
            'warning',
            '💭 Think about this:\n\n' +
            '💡 The phrase "can\'t put down a book" is an idiom in English. What does it usually mean?\n' +
            '💡 How does anti-gravity make you think of this phrase literally?\n' +
            '💡 When an idiom is understood both figuratively AND literally, what language feature is that?'
        );
    }

    function checkLA2() {
        var featureEl = document.getElementById('la-practice-2a');
        var expEl = document.getElementById('la-practice-2b');
        var feedback = document.getElementById('la-feedback-2');
        if (!featureEl || !expEl) return;

        var feature = String(featureEl.value || '');
        var explanation = String(expEl.value || '').toLowerCase();

        if (!feature || explanation.length < 10) {
            setPracticeFeedback(feedback, 'error', '⚠️ Please answer both questions!');
            return;
        }

        var correctFeature = feature === 'syntax';
        var mentionsVerb = explanation.includes('verb') || explanation.includes('move') || explanation.includes('pass');
        var mentionsNoun = explanation.includes('noun') || explanation.includes('insect') || explanation.includes('bug');

        if (correctFeature && mentionsVerb && mentionsNoun) {
            setPracticeFeedback(
                feedback,
                'success',
                '🎉 Brilliant! You understood a complex joke!\n\n' +
                'Language Feature: Syntactic Ambiguity\n\n' +
                'The sentence structure "X flies like Y" can be read two ways:\n\n' +
                'Reading 1 (Time flies like an arrow):\n' +
                '• "flies" = VERB (moves quickly)\n' +
                '• "Time passes quickly like an arrow" (idiom)\n\n' +
                'Reading 2 (Fruit flies like a banana):\n' +
                '• "flies" = NOUN (the insects)\n' +
                '• "Fruit flies enjoy/prefer bananas"\n\n' +
                'Why it\'s syntactic ambiguity:\n' +
                'The same grammatical structure creates two completely different meanings! The second sentence tricks you by using the same structure but forcing a different interpretation.\n\n' +
                'This joke is famous because:\n' +
                '• It shows how English grammar can be ambiguous\n' +
                '• Native speakers often don\'t realize the double meaning at first\n' +
                '• It\'s a perfect example of language-based humour'
            );
            return;
        }

        if (correctFeature) {
            setPracticeFeedback(
                feedback,
                'warning',
                '🎉 Correct! Syntactic Ambiguity\n\n' +
                '💡 Now explain the TWO meanings of "flies" More Clearly:\n' +
                '💡 In sentence 1, "flies" is a ____ (part of speech)?\n' +
                '💡 In sentence 2, "flies" is a ____ (part of speech)?\n' +
                'Try to mention verb vs. noun!'
            );
            return;
        }

        if (mentionsVerb && mentionsNoun) {
            setPracticeFeedback(
                feedback,
                'warning',
                '🎉 Great explanation of the double meaning!\n\n' +
                '💡 But the language feature is not quite right.\n' +
                '💡 The issue here is that the GRAMMAR STRUCTURE "X flies like Y" can be understood in two ways.\n' +
                '💡 When grammar structure creates ambiguity, we call it Syntactic Ambiguity!'
            );
            return;
        }

        setPracticeFeedback(
            feedback,
            'warning',
            '💭 This is a tricky one! Let me help:\n\n' +
            '💡 Look at "flies" in both sentences:\n' +
            '• "Time flies like an arrow" → flies = VERB (to move fast)\n' +
            '• "Fruit flies like a banana" → flies = NOUN (the insects)\n\n' +
            'Same word, same position, different grammatical function!\n' +
            'This is Syntactic Ambiguity - the sentence structure allows multiple interpretations.'
        );
    }

    function checkComplete() {
        var soEl = document.getElementById('complete-so');
        var lmEl = document.getElementById('complete-lm');
        var siEl = document.getElementById('complete-si');
        var taEl = document.getElementById('complete-ta');
        var nsEl = document.getElementById('complete-ns');
        var laEl = document.getElementById('complete-la');
        var feedback = document.getElementById('complete-feedback');
        if (!soEl || !lmEl || !siEl || !taEl || !nsEl || !laEl) return;

        var so = String(soEl.value || '').toLowerCase();
        var lm = String(lmEl.value || '').toLowerCase();
        var si = String(siEl.value || '').toLowerCase();
        var ta = String(taEl.value || '').toLowerCase();
        var ns = String(nsEl.value || '').toLowerCase();
        var la = String(laEl.value || '').toLowerCase();

        if (!so || !lm || !si || !ta || !ns || !la) {
            setPracticeFeedback(feedback, 'error', '⚠️ Please fill in all 6 Knowledge Resources!');
            return;
        }

        var scores = {
            so: ((so.includes('emotion') || so.includes('surprise') || so.includes('feeling')) && (so.includes('appear') || so.includes('physical'))) ? 1 : 0,
            lm: lm.includes('ambig') ? 1 : 0,
            si: (si.includes('home') || si.includes('couple') || si.includes('married') || si.includes('domestic')) ? 1 : 0,
            ta: ta.includes('wife') ? 1 : 0,
            ns: (ns.includes('simple') || ns.includes('setup') || ns.includes('narrative')) ? 1 : 0,
            la: (la.includes('ambig') || la.includes('looked surprised') || la.includes('double meaning') || la.includes('polysemy')) ? 1 : 0
        };

        var total = scores.so + scores.lm + scores.si + scores.ta + scores.ns + scores.la;

        if (total === 6) {
            setPracticeFeedback(
                feedback,
                'success',
                '🎉🎉 PERFECT! Complete GTVH Mastery!\n\n' +
                'Model Answer:\n' +
                '• SO: Emotional state (feeling surprised) vs. Physical appearance (looking surprised due to high eyebrows)\n' +
                '• LM: Ambiguity in "looked surprised"\n' +
                '• SI: Domestic/home setting, married couple\n' +
                '• TA: The wife (gentle teasing)\n' +
                '• NS: Simple narrative (setup → punchline)\n' +
                '• LA: Polysemy/Ambiguity of "looked surprised" (can mean felt surprised OR appeared to have surprised facial expression)\n\n' +
                '🏆 You can now use GTVH to systematically analyze any joke!'
            );
            return;
        }

        if (total >= 4) {
            setPracticeFeedback(
                feedback,
                'success',
                '🎉 Very good! ' + total + '/6 correct\n\n' +
                'Model Answer for comparison:\n' +
                '• SO: Emotional surprise vs. Physical appearance\n' +
                '• LM: Ambiguity\n' +
                '• SI: Married couple at home\n' +
                '• TA: Wife\n' +
                '• NS: Simple narrative\n' +
                '• LA: Polysemy of "looked surprised"\n\n' +
                'Compare your answers - where can you be More Specific?'
            );
            return;
        }

        setPracticeFeedback(
            feedback,
            'warning',
            '💭 Good start! ' + total + '/6\n\n' +
            'Model Answer:\n' +
            '• SO: Emotional state (surprised feeling) vs. Physical appearance (surprised look)\n' +
            '• LM: Ambiguity (the phrase has two meanings)\n' +
            '• SI: Married couple at home discussing appearance\n' +
            '• TA: The wife\n' +
            '• NS: Simple narrative (I did X, she did Y)\n' +
            '• LA: Polysemy/ambiguity of "looked surprised"\n\n' +
            'Review the sections above and try again!'
        );
    }

    // Expose to the action dispatcher (whitelisted by js/actions.js)
    window.checkSO1 = checkSO1;
    window.checkSO2 = checkSO2;
    window.checkLM1 = checkLM1;
    window.checkLM2 = checkLM2;
    window.checkSITA1 = checkSITA1;
    window.checkSITA2 = checkSITA2;
    window.checkNS1 = checkNS1;
    window.checkNS2 = checkNS2;
    window.checkLA1 = checkLA1;
    window.checkLA2 = checkLA2;
    window.checkComplete = checkComplete;

    const MODULE_THEORY_CONTENT = {
      'module-1': {
        theorySections: [
          {
            id: 'what-is-pragmatics',
            title: '💬 What is Pragmatics?',
            content: `
              <div class="simple-explanation">
                <strong>In Simple Words:</strong>
                <p>Pragmatics = Understanding what people REALLY mean, not just what they SAY.
                It's like reading between the lines!</p>
              </div>

              <div class="example-box">
                <strong>📖 Real Life Example:</strong>
                <p>Friend: "Can you pass the salt?"</p>
                <p>You: <em>"Yes, I can"</em> (but you don't move)</p>
                <div class="explanation">
                  ✨ <strong>What went wrong?</strong> Your friend wasn't asking about your ability - they wanted you to actually pass the salt!
                  This is pragmatics: understanding the real request behind the words.
                </div>
              </div>

              <button class="expand-btn" type="button" data-action="module-toggle-expandable">
                📚 Learn More (Optional)
              </button>

              <div class="expandable-detail">
                <h4>The Hidden Rules of Language</h4>
                <p>When you learn English, you learn grammar (how to make correct sentences) and vocabulary (what words mean). But there's a third thing that's just as important: <strong>pragmatics</strong>.</p>

                <div class="theory-box">
                  <p><strong>Pragmatics</strong> = Understanding what people REALLY mean, not just what they SAY.</p>
                </div>

                <h4>Why Pragmatics Matters</h4>
                <p>Without pragmatic competence, you might:</p>
                <ul>
                  <li>Sound rude when you're trying to be polite</li>
                  <li>Miss jokes and feel confused</li>
                  <li>Take things literally when people are being indirect</li>
                  <li>Offend people without knowing why</li>
                </ul>
              </div>
            `
          },
          {
            id: 'literal-vs-figurative',
            title: '🎭 Literal vs. Figurative Meaning',
            content: `
              <div class="simple-explanation">
                <strong>In Simple Words:</strong>
                <p>Sometimes words don't mean exactly what they say!
                When someone says "I'm feeling blue," they don't mean they turned into a color - they mean they're sad.</p>
              </div>

              <div class="example-box">
                <strong>📖 Real Life Example:</strong>
                <p>Coach: "Break a leg at the game today!"</p>
                <p>Player: <em>"What? You want me to get injured?!"</em></p>
                <div class="explanation">
                  ✨ <strong>What it really means:</strong> "Break a leg" is a figurative expression meaning "Good luck!"
                  Nobody actually wants you to break your leg - it's just a common way to wish someone success!
                </div>
              </div>

              <button class="expand-btn" type="button" data-action="module-toggle-expandable">
                📚 Learn More (Optional)
              </button>

              <div class="expandable-detail">
                <h4>Two Ways to Understand Words</h4>
                <p><strong>Literal meaning:</strong> The exact, dictionary definition of words.</p>
                <p><strong>Figurative meaning:</strong> What words mean in context, often different from the literal meaning.</p>

                <h4>More Examples</h4>
                <table class="rubric-table">
                  <thead>
                    <tr><th>Expression</th><th>Literal</th><th>Figurative</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>"I'm feeling blue"</td><td>I am the color blue</td><td>I am sad</td></tr>
                    <tr><td>"Break a leg!"</td><td>Fracture your bone</td><td>Good luck!</td></tr>
                    <tr><td>"It's raining cats and dogs"</td><td>Animals falling</td><td>Heavy rain</td></tr>
                    <tr><td>"Piece of cake"</td><td>Slice of dessert</td><td>Very easy</td></tr>
                  </tbody>
                </table>

                <h4>Practice Tip</h4>
                <p>When you hear an expression that doesn't make sense literally, ask: "Is this figurative?"</p>
              </div>
            `
          },
          {
            id: 'polysemy',
            title: 'Words with Multiple Meanings',
            content: `
              <h4>One Word, Many Meanings (Polysemy)</h4>
              <p><strong>Polysemy</strong> is when one word has several different meanings.</p>
              
              <div class="theory-box">
                <h5>HAND</h5>
                <ul>
                  <li>Body part: "Raise your hand"</li>
                  <li>Help: "Give me a hand"</li>
                  <li>Clock pointer: "The hour hand"</li>
                  <li>Cards: "A good hand"</li>
                </ul>
              </div>
              
              <div class="theory-box">
                <h5>RUN</h5>
                <ul>
                  <li>Move fast: "I run every morning"</li>
                  <li>Operate: "Run a business"</li>
                  <li>Flow: "Water runs"</li>
                  <li>Candidate: "Run for president"</li>
                </ul>
              </div>
              
              <h4>Context is Key</h4>
              <p>We know which meaning is correct from CONTEXT - the situation and surrounding words.</p>
            `
          },
          {
            id: 'basic-politeness',
            title: 'Being Polite in English',
            content: `
              <h4>The Politeness Scale</h4>
              <table class="rubric-table">
                <thead>
                  <tr><th>Level</th><th>Example</th><th>When to Use</th></tr>
                </thead>
                <tbody>
                  <tr><td>Very Direct</td><td>"Give me water."</td><td>Only emergencies</td></tr>
                  <tr><td>Direct</td><td>"I want water."</td><td>Sounds demanding</td></tr>
                  <tr><td>Polite</td><td>"Can I have water?"</td><td>Casual situations</td></tr>
                  <tr><td>More Polite</td><td>"Could I have water, please?"</td><td>Most situations</td></tr>
                  <tr><td>Very Polite</td><td>"Would you mind...?"</td><td>Formal, big requests</td></tr>
                </tbody>
              </table>
              
              <h4>Warning</h4>
              <div class="theory-box" style="background: #fee2e2;">
                <p>"Please" doesn't fix everything!</p>
                <p>? "Shut up, please" - still rude!</p>
                <p>The whole sentence structure matters.</p>
              </div>
            `
          },
          {
            id: 'understanding-context',
            title: '🎯 Understanding Context',
            content: `
              <h4>Context is Everything</h4>
              <p><strong>Context</strong> helps us understand the true meaning of words and sentences.</p>

              <div class="theory-box">
                <p><strong>Example:</strong> "That's cool!"</p>
                <ul>
                  <li>☕ About temperature: "The coffee is cool now"</li>
                  <li>👍 Approval: "Your new shoes are cool!"</li>
                  <li>😐 Dismissive: "Cool..." (not interested)</li>
                </ul>
              </div>

              <h4>Types of Context</h4>
              <table class="rubric-table">
                <thead>
                  <tr><th>Type</th><th>What It Includes</th><th>Example</th></tr>
                </thead>
                <tbody>
                  <tr><td><strong>Situational</strong></td><td>Where you are, who you're with</td><td>"Pass it" at dinner = salt/pepper</td></tr>
                  <tr><td><strong>Linguistic</strong></td><td>Words before and after</td><td>"Bank" → river bank or money bank?</td></tr>
                  <tr><td><strong>Cultural</strong></td><td>Shared background knowledge</td><td>"Bring a plate" (Australian = bring food)</td></tr>
                </tbody>
              </table>

              <h4>Practice Tip</h4>
              <p>Always ask: <em>Where are they? Who are they? What are they doing?</em></p>
            `
          },
          {
            id: 'simple-speech-acts',
            title: '💬 Making Requests and Offers',
            content: `
              <h4>What is a Speech Act?</h4>
              <p>A <strong>speech act</strong> is when you DO something by SAYING something.</p>

              <h4>Common Speech Acts (A1-A2 Level)</h4>

              <div class="theory-box">
                <h5>🙏 REQUESTS</h5>
                <ul>
                  <li>"Can you help me?" (polite)</li>
                  <li>"Could you open the window?" (more polite)</li>
                  <li>"Would you mind...?" (very polite)</li>
                </ul>
              </div>

              <div class="theory-box">
                <h5>🎁 OFFERS</h5>
                <ul>
                  <li>"Would you like some tea?"</li>
                  <li>"Can I help you?"</li>
                  <li>"Let me get that for you"</li>
                </ul>
              </div>

              <div class="theory-box">
                <h5>📋 SUGGESTIONS</h5>
                <ul>
                  <li>"Why don't we...?"</li>
                  <li>"How about...?"</li>
                  <li>"Let's...!"</li>
                </ul>
              </div>

              <h4>⚠️ Common Mistakes</h4>
              <table class="rubric-table">
                <thead><tr><th>Wrong</th><th>Better</th><th>Why</th></tr></thead>
                <tbody>
                  <tr><td>"Give me pen"</td><td>"Can I borrow your pen?"</td><td>Too direct, sounds rude</td></tr>
                  <tr><td>"You must help me"</td><td>"Could you help me?"</td><td>Don't tell people what to do</td></tr>
                  <tr><td>"I want water"</td><td>"Could I have some water?"</td><td>Sounds demanding</td></tr>
                </tbody>
              </table>

              <h4>Golden Rule</h4>
              <p><strong>In English, requests are usually questions, not commands!</strong></p>
            `
          }
        ]
      },

      'module-2': {
        theorySections: [
          {
            id: 'implicature',
            title: '🔍 Reading Between the Lines',
            content: `
              <h4>What is Implicature?</h4>
              <div class="theory-box">
                <p><strong>Implicature</strong> = What is MEANT but not SAID</p>
              </div>
              
              <h4>Example</h4>
              <div class="joke-card">
                <p><strong>You:</strong> "Want to come to the party?"</p>
                <p><strong>Friend:</strong> "I have an exam tomorrow."</p>
              </div>
              <p>Your friend didn't say "no" - but they IMPLIED "no" by giving a reason.</p>
              
              <h4>Grice's Maxims</h4>
              <table class="rubric-table">
                <thead><tr><th>Maxim</th><th>Rule</th><th>Violation Creates Implicature</th></tr></thead>
                <tbody>
                  <tr><td><strong>Quantity</strong></td><td>Say enough</td><td>"How was the movie?" "It had seats."</td></tr>
                  <tr><td><strong>Quality</strong></td><td>Be truthful</td><td>Sarcasm: "Great weather!" (in rain)</td></tr>
                  <tr><td><strong>Relation</strong></td><td>Be relevant</td><td>Changing subject = avoiding topic</td></tr>
                  <tr><td><strong>Manner</strong></td><td>Be clear</td><td>Vagueness often hides something</td></tr>
                </tbody>
              </table>
            `
          },
          {
            id: 'indirect-speech',
            title: '💬 Indirect Speech Acts',
            content: `
              <h4>Direct vs. Indirect</h4>
              <table class="rubric-table">
                <thead><tr><th>What You Say</th><th>Form</th><th>Real Function</th></tr></thead>
                <tbody>
                  <tr><td>"Close the door."</td><td>Command</td><td>Direct request</td></tr>
                  <tr><td>"Can you close the door?"</td><td>Question</td><td>Indirect request</td></tr>
                  <tr><td>"It's cold in here."</td><td>Statement</td><td>Very indirect request</td></tr>
                </tbody>
              </table>
              
              <h4>Why Indirect?</h4>
              <ul>
                <li><strong>Politeness:</strong> Indirect = more polite</li>
                <li><strong>Options:</strong> Gives listener a way to refuse</li>
                <li><strong>Harmony:</strong> Avoids conflict</li>
              </ul>
            `
          },
          {
            id: 'face-politeness',
            title: '😊 Face and Politeness',
            content: `
              <h4>What is "Face"?</h4>
              <div class="theory-box">
                <p><strong>Positive Face:</strong> Desire to be liked and approved</p>
                <p><strong>Negative Face:</strong> Desire to be free, not imposed upon</p>
              </div>
              
              <h4>Face-Threatening Acts</h4>
              <ul>
                <li><strong>Requests</strong> threaten negative face (impose on freedom)</li>
                <li><strong>Criticism</strong> threatens positive face (suggests you're not good)</li>
                <li><strong>Apologies</strong> threaten your own positive face</li>
              </ul>
              
              <h4>Politeness Strategies</h4>
              <ol>
                <li><strong>Bald on-record:</strong> "Close the door." (emergencies, close friends)</li>
                <li><strong>Positive politeness:</strong> "Hey buddy, could you...?" (friendly)</li>
                <li><strong>Negative politeness:</strong> "Sorry to bother you, but..." (respectful)</li>
                <li><strong>Off-record:</strong> "It's cold in here..." (hints)</li>
              </ol>
            `
          },
          {
            id: 'hedging-mitigation',
            title: '🛡️ Softening Your Message',
            content: `
              <h4>What is Hedging?</h4>
              <p><strong>Hedging</strong> = Making your statement less direct or absolute to sound more polite or cautious.</p>

              <div class="theory-box">
                <table class="rubric-table">
                  <thead><tr><th>Direct</th><th>Hedged</th></tr></thead>
                  <tbody>
                    <tr><td>"You're wrong"</td><td>"I'm not sure that's quite right..."</td></tr>
                    <tr><td>"This is bad"</td><td>"This might need some work"</td></tr>
                    <tr><td>"I need this now"</td><td>"I was wondering if you might have time..."</td></tr>
                  </tbody>
                </table>
              </div>

              <h4>Common Hedging Expressions (B1)</h4>
              <ul>
                <li><strong>Modal verbs:</strong> might, could, would, may</li>
                <li><strong>Adverbs:</strong> perhaps, possibly, probably, maybe</li>
                <li><strong>Phrases:</strong> "I think...", "It seems...", "I wonder..."</li>
                <li><strong>Questions:</strong> "Do you think...?", "Would it be possible...?"</li>
              </ul>

              <h4>Why Hedge?</h4>
              <ol>
                <li><strong>Politeness:</strong> Avoid being too blunt</li>
                <li><strong>Face-saving:</strong> Give others room to disagree</li>
                <li><strong>Uncertainty:</strong> Show you're not 100% sure</li>
                <li><strong>Professional tone:</strong> Sound diplomatic</li>
              </ol>

              <div class="theory-box" style="background: #e8f5e9;">
                <p><strong>Practice:</strong> Compare "That's wrong" vs. "I'm not sure that's quite right."</p>
                <p>Both mean the same thing, but the hedged version protects both people's face!</p>
              </div>
            `
          },
          {
            id: 'cultural-directness',
            title: '🌍 Direct vs. Indirect Cultures',
            content: `
              <h4>Communication Styles Vary</h4>
              <p>Different cultures have different expectations about directness.</p>

              <table class="rubric-table">
                <thead>
                  <tr><th>More Direct Cultures</th><th>More Indirect Cultures</th></tr>
                </thead>
                <tbody>
                  <tr><td>Germany, Netherlands, Israel</td><td>Japan, Korea, many Southeast Asian cultures</td></tr>
                  <tr><td>"No, I can't do that"</td><td>"That might be difficult..."</td></tr>
                  <tr><td>Value clarity and honesty</td><td>Value harmony and face-saving</td></tr>
                  <tr><td>Words carry most meaning</td><td>Context carries much meaning</td></tr>
                </tbody>
              </table>

              <h4>Where Does English Fall?</h4>
              <div class="theory-box">
                <p><strong>American English:</strong> Moderately direct (middle of the scale)</p>
                <p><strong>British English:</strong> More indirect (especially in social situations)</p>
              </div>

              <h4>Example: Refusing an Invitation</h4>
              <ul>
                <li><strong>Direct:</strong> "No, I don't want to go"</li>
                <li><strong>Moderately indirect (American):</strong> "Sorry, I'm busy that day"</li>
                <li><strong>Very indirect (British/Asian):</strong> "Oh, that sounds lovely... I'll have to check my schedule..."</li>
              </ul>

              <h4>⚠️ Potential Misunderstandings</h4>
              <div class="theory-box" style="background: #fff3cd;">
                <ul>
                  <li><strong>Direct speakers</strong> may think indirect speakers are unclear or dishonest</li>
                  <li><strong>Indirect speakers</strong> may think direct speakers are rude or aggressive</li>
                  <li><strong>Solution:</strong> Understand both styles and adapt!</li>
                </ul>
              </div>
            `
          }
        ]
      },

      'module-3': {
        theorySections: [
          {
            id: 'sarcasm-irony',
            title: '😏 Sarcasm and Irony',
            content: `
              <h4>Definitions</h4>
              <div class="theory-box">
                <p><strong>Irony:</strong> Saying the opposite of what is true</p>
                <p><strong>Sarcasm:</strong> Irony used to mock or criticize</p>
                <p><em>All sarcasm is ironic, but not all irony is sarcastic.</em></p>
              </div>
              
              <h4>How to Recognize Sarcasm</h4>
              <ol>
                <li><strong>Content-Reality Mismatch:</strong> "I love waiting in traffic" (nobody does)</li>
                <li><strong>Tone:</strong> Flat delivery, extended vowels "Oh, GREAT"</li>
                <li><strong>Context:</strong> Previous complaints, facial expressions</li>
              </ol>
              
              <h4>Cultural Warning</h4>
              <div class="theory-box" style="background: #fff3cd;">
                <p><strong>British:</strong> Very common, often deadpan (no signals)</p>
                <p><strong>American:</strong> Common, usually with clearer signals</p>
                <p><strong>Some cultures:</strong> Sarcasm is rude or confusing</p>
              </div>
            `
          },
          {
            id: 'pragmatic-failure',
            title: '⚠️ Pragmatic Failure',
            content: `
              <h4>Two Types (Thomas, 1983)</h4>
              <div class="theory-box">
                <p><strong>Pragmalinguistic:</strong> Wrong linguistic form</p>
                <p>Example: "I want coffee" instead of "Could I have coffee?"</p>
              </div>
              <div class="theory-box">
                <p><strong>Sociopragmatic:</strong> Wrong social judgment</p>
                <p>Example: "Hey" to your professor (too informal)</p>
              </div>
              
              <h4>Why It Happens</h4>
              <ul>
                <li><strong>L1 Transfer:</strong> Using your language's rules in English</li>
                <li><strong>Overgeneralization:</strong> Thinking "please" fixes everything</li>
                <li><strong>Textbook English:</strong> Not always realistic</li>
              </ul>
            `
          },
          {
            id: 'complaints-criticism',
            title: '😬 Making Complaints Politely',
            content: `
              <h4>Face-Threatening Acts</h4>
              <p>Complaints and criticism are <strong>face-threatening acts</strong> - they threaten the other person's positive face (desire to be liked).</p>

              <h4>The Politeness Ladder for Complaints</h4>
              <table class="rubric-table">
                <thead><tr><th>Directness</th><th>Example</th><th>Risk</th></tr></thead>
                <tbody>
                  <tr><td>🔴 Very Direct</td><td>"This is terrible!"</td><td>Very rude, damages relationship</td></tr>
                  <tr><td>🟠 Direct</td><td>"I'm not happy with this"</td><td>Clear but potentially offensive</td></tr>
                  <tr><td>🟡 Moderate</td><td>"There seems to be a problem..."</td><td>Balanced</td></tr>
                  <tr><td>🟢 Indirect</td><td>"I was wondering if we could improve..."</td><td>Very polite, may be unclear</td></tr>
                </tbody>
              </table>

              <h4>Softening Strategies (B2)</h4>
              <ol>
                <li><strong>Hedge:</strong> "I'm not sure this is quite right..."</li>
                <li><strong>Personalize:</strong> "I find it difficult to..." (not "You did it wrong")</li>
                <li><strong>Frame as question:</strong> "Could we perhaps consider...?"</li>
                <li><strong>Sandwich technique:</strong> Positive + Negative + Positive</li>
                <li><strong>Focus on solution:</strong> "How might we fix this?"</li>
              </ol>

              <div class="theory-box" style="background: #e3f2fd;">
                <h5>Example Transformation</h5>
                <p>❌ "Your report is wrong"</p>
                <p>✅ "I really appreciate the effort on this report. I did notice a couple of areas that might need some adjustment - perhaps we could look at the data in section 3 together? Overall though, great work on the analysis!"</p>
              </div>
            `
          },
          {
            id: 'situational-irony',
            title: '🎭 Types of Irony',
            content: `
              <h4>Beyond Sarcasm</h4>
              <p>Irony isn't just verbal - it appears in situations too!</p>

              <table class="rubric-table">
                <thead><tr><th>Type</th><th>Definition</th><th>Example</th></tr></thead>
                <tbody>
                  <tr>
                    <td><strong>Verbal Irony</strong></td>
                    <td>Saying opposite of what you mean</td>
                    <td>"Lovely weather!" (during storm)</td>
                  </tr>
                  <tr>
                    <td><strong>Situational Irony</strong></td>
                    <td>Outcome opposite of expectation</td>
                    <td>Fire station burns down</td>
                  </tr>
                  <tr>
                    <td><strong>Dramatic Irony</strong></td>
                    <td>Audience knows more than character</td>
                    <td>Horror movie: "I'll be right back!"</td>
                  </tr>
                </tbody>
              </table>

              <h4>Why Irony is Pragmatic</h4>
              <p>Understanding irony requires:</p>
              <ul>
                <li>📚 <strong>Shared knowledge:</strong> What's "expected" vs. what happened</li>
                <li>🎯 <strong>Context awareness:</strong> Recognizing the mismatch</li>
                <li>🧠 <strong>Inference:</strong> Understanding the speaker's intent</li>
              </ul>

              <div class="theory-box">
                <p><strong>British Humor Alert:</strong> British people love situational irony and understatement combined!</p>
                <p>Example: Titanic sinking → "It appears we have a slight problem with the ship."</p>
              </div>
            `
          },
          {
            id: 'detecting-intent',
            title: '🔍 Reading Speaker Intent',
            content: `
              <h4>What Do They REALLY Want?</h4>
              <p>At B2 level, you need to go beyond surface meaning to understand <strong>speaker intent</strong>.</p>

              <h4>Clues to Intent</h4>
              <table class="rubric-table">
                <thead><tr><th>Clue Type</th><th>What to Notice</th><th>Example</th></tr></thead>
                <tbody>
                  <tr><td><strong>Intonation</strong></td><td>Rising/falling tone, stress</td><td>"THAT was brilliant" (sarcasm)</td></tr>
                  <tr><td><strong>Context</strong></td><td>Situation, relationship, topic</td><td>"Cold in here?" (= close window)</td></tr>
                  <tr><td><strong>Violating maxims</strong></td><td>Being unclear = hiding something</td><td>"It was... interesting" (= I didn't like it)</td></tr>
                  <tr><td><strong>Body language</strong></td><td>Eye roll, smile, crossed arms</td><td>"Sure, whatever" + eye roll = not agreeing</td></tr>
                </tbody>
              </table>

              <h4>Practice Questions to Ask Yourself</h4>
              <ol>
                <li><strong>Literal check:</strong> Does the literal meaning make sense here?</li>
                <li><strong>Relationship:</strong> What's their relationship? (formal, casual, close)</li>
                <li><strong>Face needs:</strong> Are they protecting face (theirs or mine)?</li>
                <li><strong>Tone:</strong> Does the tone match the words?</li>
                <li><strong>Context:</strong> What happened just before this?</li>
              </ol>

              <div class="theory-box" style="background: #f3e5f5;">
                <h5>Example Analysis</h5>
                <p><strong>Scene:</strong> You worked all night on a presentation.</p>
                <p><strong>Boss says:</strong> "Well, that's... certainly different."</p>
                <p><strong>Analysis:</strong></p>
                <ul style="margin-top: 8px;">
                  <li>✗ Literal: "It's different" (neutral)</li>
                  <li>✓ Intent: "I don't like it" (hedged criticism)</li>
                  <li>Clues: "Well...", pause, "certainly" (hedging), avoiding "good"</li>
                </ul>
              </div>
            `
          }
        ]
      },

      'module-4': {
        theorySections: [
          {
            id: 'layered-meaning',
            title: '🎭 Layered Meaning',
            content: `
              <h4>Multiple Levels of Communication</h4>
              <p>Advanced communication involves layers operating simultaneously.</p>
              
              <h4>Example: Job Interview</h4>
              <div class="theory-box">
                <p><strong>Q:</strong> "What's your biggest weakness?"</p>
                <p><strong>A:</strong> "I'm a perfectionist."</p>
              </div>
              <p><strong>Layers:</strong></p>
              <ol>
                <li>Surface: Answering about weaknesses</li>
                <li>Strategic: Framing weakness as strength</li>
                <li>Meta: Both know it's a game</li>
                <li>Evaluation: Interviewer judges how well you play</li>
              </ol>
              
              <h4>Professional Discourse</h4>
              <table class="rubric-table">
                <thead><tr><th>Context</th><th>Special Rules</th></tr></thead>
                <tbody>
                  <tr><td>Academic</td><td>Hedging: "This might suggest..."</td></tr>
                  <tr><td>Medical</td><td>Euphemism: "passed away"</td></tr>
                  <tr><td>Diplomatic</td><td>"Frank discussions" = disagreed</td></tr>
                </tbody>
              </table>
            `
          },
          {
            id: 'cross-cultural',
            title: '🌏 Cross-Cultural Pragmatics',
            content: `
              <h4>Same Words, Different Meanings</h4>
              <table class="rubric-table">
                <thead><tr><th>Phrase</th><th>American</th><th>British</th><th>Japanese</th></tr></thead>
                <tbody>
                  <tr><td>"I'll think about it"</td><td>Will consider</td><td>Probably no</td><td>Definitely no</td></tr>
                  <tr><td>"Interesting"</td><td>Interested</td><td>I disagree</td><td>Acknowledging</td></tr>
                </tbody>
              </table>
              
              <h4>Developing Intercultural Competence</h4>
              <ol>
                <li><strong>Awareness:</strong> Know your own norms</li>
                <li><strong>Knowledge:</strong> Learn target culture's norms</li>
                <li><strong>Observation:</strong> Watch native speakers</li>
                <li><strong>Flexibility:</strong> Adapt your style</li>
                <li><strong>Repair:</strong> Know how to fix misunderstandings</li>
              </ol>
            `
          },
          {
            id: 'power-status',
            title: '👔 Power, Status & Professional Communication',
            content: `
              <h4>Understanding Power Dynamics</h4>
              <p>In professional contexts, <strong>power asymmetry</strong> affects how we communicate.</p>

              <div class="theory-box">
                <h5>Power Indicators</h5>
                <ul>
                  <li><strong>Organizational:</strong> Boss vs. Employee</li>
                  <li><strong>Expertise:</strong> Doctor vs. Patient</li>
                  <li><strong>Social:</strong> Professor vs. Student</li>
                  <li><strong>Age/Seniority:</strong> Senior vs. Junior colleague</li>
                </ul>
              </div>

              <h4>How Power Affects Language</h4>
              <table class="rubric-table">
                <thead><tr><th>Situation</th><th>Higher Power Speaker</th><th>Lower Power Speaker</th></tr></thead>
                <tbody>
                  <tr><td>Making requests</td><td>"Get this done by Friday"</td><td>"Would it be possible to...?"</td></tr>
                  <tr><td>Disagreeing</td><td>"That won't work"</td><td>"I wonder if we might consider..."</td></tr>
                  <tr><td>Email opening</td><td>"Hi Sarah,"</td><td>"Dear Professor Johnson," / "Dear Dr. Johnson,"</td></tr>
                  <tr><td>Interrupting</td><td>Can interrupt freely</td><td>Must wait for pause, apologize</td></tr>
                </tbody>
              </table>

              <h4>Register Shifts (C1 Skill)</h4>
              <p><strong>Register</strong> = Level of formality matched to situation</p>

              <div class="theory-box" style="background: #e8f5e9;">
                <h5>Example: Requesting Time Off</h5>
                <p><strong>To close colleague (informal):</strong><br>"Hey, can you cover for me Friday? Got a doctor's thing."</p>
                <p><strong>To manager (formal):</strong><br>"Dear Ms. Rodriguez,<br>I would like to request annual leave for Friday, March 15th, for a medical appointment. I have arranged for John to cover my responsibilities. Please let me know if this presents any issues.<br>Best regards, [Name]"</p>
              </div>

              <h4>⚠️ Common C1-Level Errors</h4>
              <ul>
                <li>❌ Using informal register with high-power interlocutors</li>
                <li>❌ "Hey Prof" in emails (too casual)</li>
                <li>❌ Using imperatives with superiors: "Send me the report" → "Could you send me the report when convenient?"</li>
                <li>❌ Overly formal with peers: "Dear Esteemed Colleague" → "Hi Tom,"</li>
              </ul>
            `
          },
          {
            id: 'pragmatic-repair',
            title: '🔧 Repairing Misunderstandings',
            content: `
              <h4>When Pragmatic Failure Happens</h4>
              <p>Even advanced speakers make pragmatic mistakes. The key is <strong>pragmatic repair</strong> - fixing the misunderstanding gracefully.</p>

              <h4>Repair Strategies</h4>
              <table class="rubric-table">
                <thead><tr><th>Strategy</th><th>When to Use</th><th>Example</th></tr></thead>
                <tbody>
                  <tr>
                    <td><strong>Clarification Request</strong></td>
                    <td>You didn't understand their intent</td>
                    <td>"Sorry, I'm not sure I understood - are you saying...?"</td>
                  </tr>
                  <tr>
                    <td><strong>Reformulation</strong></td>
                    <td>They didn't understand you</td>
                    <td>"Let me rephrase that - what I meant was..."</td>
                  </tr>
                  <tr>
                    <td><strong>Acknowledgment + Correction</strong></td>
                    <td>You made a pragmatic error</td>
                    <td>"I apologize if that came across too directly..."</td>
                  </tr>
                  <tr>
                    <td><strong>Meta-comment</strong></td>
                    <td>Cultural difference causing confusion</td>
                    <td>"In my culture we..., but I understand here..."</td>
                  </tr>
                </tbody>
              </table>

              <h4>Example: Repairing Too-Direct Request</h4>
              <div class="theory-box">
                <p><strong>Original (too direct):</strong> "I need you to finish this today."</p>
                <p><strong>Repair:</strong> "Actually, let me rephrase - would it be possible to complete this today? I know it's a tight deadline, but the client is expecting it. If that's not feasible, please let me know and we can find another solution."</p>
              </div>

              <h4>Advanced: Preventive Hedging</h4>
              <p>At C1 level, you can <strong>prevent</strong> misunderstandings before they happen:</p>
              <ul>
                <li>"I hope this doesn't sound too forward, but..."</li>
                <li>"Please correct me if I'm wrong, but..."</li>
                <li>"I'm still learning the conventions here - is it appropriate to...?"</li>
                <li>"In my experience (which might differ from yours)..."</li>
              </ul>

              <div class="theory-box" style="background: #fff3cd;">
                <h5>💡 Cultural Intelligence</h5>
                <p>Showing awareness of potential pragmatic differences demonstrates <strong>high intercultural competence</strong> and protects face for everyone involved!</p>
              </div>
            `
          }
        ]
      },

      'module-5': {
        theorySections: [
          {
            id: 'uzbek-humour',
            title: '🇺🇿 Uzbek Humour Traditions',
            content: `
              <h4>Askiya: The Art of Wit</h4>
              <p><strong>Askiya</strong> is a traditional Uzbek verbal dueling art form.</p>
              
              <div class="theory-box">
                <h5>Key Features:</h5>
                <ul>
                  <li><strong>Improvisation:</strong> Spontaneous, not prepared</li>
                  <li><strong>Wordplay:</strong> Puns and double meanings</li>
                  <li><strong>Quick thinking:</strong> Delays mean you lose</li>
                  <li><strong>Social commentary:</strong> Critiques wrapped in humour</li>
                </ul>
              </div>
              
              <h4>Uzbek vs British Style</h4>
              <table class="rubric-table">
                <thead><tr><th>Feature</th><th>Uzbek/Askiya</th><th>British Wit</th></tr></thead>
                <tbody>
                  <tr><td>Delivery</td><td>Warm, animated</td><td>Cool, deadpan</td></tr>
                  <tr><td>Audience</td><td>Active, cheering</td><td>Quiet appreciation</td></tr>
                  <tr><td>Setting</td><td>Public gatherings</td><td>Private conversations</td></tr>
                </tbody>
              </table>
              
              <h4>Hospitality Humour</h4>
              <div class="theory-box">
                <p>The offering-refusing dance:</p>
                <ol>
                  <li>Host: "Please eat more!"</li>
                  <li>Guest: "I'm full"</li>
                  <li>Host: "You've eaten nothing!"</li>
                  <li>Guest: "Really, I couldn't..."</li>
                  <li>Host: "Just a little, for me"</li>
                  <li>Guest: "Well, maybe a little..."</li>
                </ol>
              </div>
            `
          },
          {
            id: 'british-humour',
            title: '🇬🇧 British Humour Decoded',
            content: `
              <h4>The Understatement Scale</h4>
              <table class="rubric-table">
                <thead><tr><th>They Say</th><th>They Mean</th></tr></thead>
                <tbody>
                  <tr><td>"Not bad"</td><td>Very good</td></tr>
                  <tr><td>"Quite good"</td><td>Very good</td></tr>
                  <tr><td>"Interesting"</td><td>I disagree</td></tr>
                  <tr><td>"With respect..."</td><td>You're wrong</td></tr>
                  <tr><td>"Brave decision"</td><td>Stupid decision</td></tr>
                  <tr><td>"A bit disappointed"</td><td>Very upset</td></tr>
                </tbody>
              </table>
              
              <h4>Self-Deprecation</h4>
              <p>British people insult themselves to:</p>
              <ul>
                <li>Show modesty (avoid boasting)</li>
                <li>Create solidarity ("I'm not perfect either")</li>
                <li>Defend pre-emptively (criticize before others)</li>
                <li>Bond with others</li>
              </ul>
              
              <div class="theory-box" style="background: #e8f5e9;">
                <p><strong>How to respond:</strong> Light disagreement!</p>
                <p>? "Oh, I'm sure you're not that bad!"</p>
                <p>? "Yes, you really are terrible."</p>
              </div>
            `
          },
          {
            id: 'bridging-practice',
            title: '🌉 Bridging Cultures',
            content: `
              <h4>Your Toolkit</h4>
              
              <h5>Strategy 1: Check Interpretation</h5>
              <ul>
                <li>"Just to make sure - you mean...?"</li>
                <li>"Was that a joke, or...?"</li>
              </ul>
              
              <h5>Strategy 2: Explain Your Culture</h5>
              <ul>
                <li>"In my culture, we usually..."</li>
                <li>"I might be too direct - please tell me!"</li>
              </ul>
              
              <h5>Strategy 3: Safe Responses</h5>
              <ul>
                <li>To possible sarcasm: Small smile + "Ha, yeah..."</li>
                <li>To unclear criticism: "I'll take that on board"</li>
              </ul>
              
              <div class="theory-box" style="background: #e8f5e9;">
                <h4>Remember</h4>
                <p>Your bicultural knowledge is an ASSET!</p>
                <ul>
                  <li>You can explain Uzbek culture to British friends</li>
                  <li>You can help other Uzbeks understand British humour</li>
                  <li>You can choose which style to use when</li>
                </ul>
                <p><strong>Goal:</strong> Not to become British, but to become FLEXIBLE.</p>
              </div>
            `
          }
        ]
      },
      'module-6': {
        theorySections: [
          {
            id: 'what-is-gtvh',
            title: 'What is GTVH?',
            content: `
              <h4>The Science of Humour Analysis</h4>
              <p>When you hear a joke in English and think "Why is this funny?", you need a systematic way to analyze it. This is where <strong>GTVH</strong> comes in.</p>

              <div class="theory-box">
                <p><strong>GTVH = General Theory of Verbal Humour</strong></p>
                <p>Developed by linguists Salvatore Attardo and Victor Raskin</p>
                <p>A framework to understand HOW and WHY jokes work</p>
              </div>

              <h4>Why Do You Need This?</h4>
              <p>As a language learner, GTVH helps you:</p>
              <ul>
                <li>? Understand jokes you hear systematically (not just guessing)</li>
                <li>? Identify WHICH part of a joke you didn't understand</li>
                <li>? Analyze cultural humour differences</li>
                <li>? Improve your own joke-telling skills</li>
              </ul>

              <h4>The 6 Knowledge Resources (KRs)</h4>
              <p>GTVH says every joke uses <strong>6 types of knowledge</strong>. Think of them as 6 lenses to look through:</p>

              <table class="rubric-table">
                <thead>
                  <tr><th>Knowledge Resource</th><th>Question It Answers</th><th>Symbol</th></tr>
                </thead>
                <tbody>
                  <tr><td><strong>Script Opposition</strong></td><td>What two meanings clash?</td><td>SO</td></tr>
                  <tr><td><strong>Logical Mechanism</strong></td><td>HOW does the punchline surprise us?</td><td>LM</td></tr>
                  <tr><td><strong>Situation</strong></td><td>What's the context/setting?</td><td>SI</td></tr>
                  <tr><td><strong>Target</strong></td><td>Who/what is being laughed at?</td><td>TA</td></tr>
                  <tr><td><strong>Narrative Strategy</strong></td><td>How is the joke told?</td><td>NS</td></tr>
                  <tr><td><strong>Language</strong></td><td>What wordplay is used?</td><td>LA</td></tr>
                </tbody>
              </table>

              <div class="theory-box" style="background: #fff3cd; border-left: 4px solid #ffc107;">
                <h5>? Key Insight</h5>
                <p>Not every joke uses ALL 6 resources equally. Some jokes rely heavily on wordplay (LA), others on situation (SI). GTVH helps you identify which resources matter most in each joke.</p>
              </div>

              <h4>Try It: Quick Analysis</h4>
              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                "I told my wife she was drawing her eyebrows too high. She looked surprised."
              </p>

              <div class="theory-box" style="background: #e8f5e9;">
                <p><strong>Analysis Preview:</strong></p>
                <ul>
                  <li><strong>SO:</strong> "Surprised" = emotion vs. physical appearance (high eyebrows)</li>
                  <li><strong>LM:</strong> Double meaning of "looked surprised"</li>
                  <li><strong>SI:</strong> Couple at home, conversation about appearance</li>
                  <li><strong>TA:</strong> The wife (gentle teasing)</li>
                  <li><strong>NS:</strong> Simple narrative (setup → punchline)</li>
                  <li><strong>LA:</strong> Ambiguity of "looked surprised"</li>
                </ul>
              </div>

              <p>In the next sections, you'll learn each Knowledge Resource in detail with practice exercises!</p>
            `
          },
          {
            id: 'script-opposition',
            title: 'Knowledge Resource 1: Script Opposition (SO)',
            content: `
              <h4>The Heart of Every Joke</h4>
              <p><strong>Script Opposition</strong> is THE most important part of GTVH. It's the clash between two different meanings or interpretations.</p>

              <div class="theory-box">
                <p><strong>Script =</strong> A mental framework or scenario</p>
                <p><strong>Opposition =</strong> Two scripts that contradict each other</p>
                <p><strong>Script Opposition =</strong> The joke makes you think of ONE script, then reveals a DIFFERENT script</p>
              </div>

              <h4>Common Script Oppositions</h4>
              <table class="rubric-table">
                <thead>
                  <tr><th>Opposition Type</th><th>Script A</th><th>Script B</th><th>Example</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Normal/Abnormal</td>
                    <td>Expected behavior</td>
                    <td>Unexpected behavior</td>
                    <td>"I'm on a seafood diet. I see food and I eat it."</td>
                  </tr>
                  <tr>
                    <td>Possible/Impossible</td>
                    <td>Realistic</td>
                    <td>Absurd</td>
                    <td>"I'd agree with you but then we'd both be wrong."</td>
                  </tr>
                  <tr>
                    <td>Literal/Figurative</td>
                    <td>Idiom meaning</td>
                    <td>Word-by-word meaning</td>
                    <td>"Time flies like an arrow. Fruit flies like a banana."</td>
                  </tr>
                  <tr>
                    <td>Good/Bad</td>
                    <td>Positive outcome</td>
                    <td>Negative outcome</td>
                    <td>"I'm great at multitasking. I can waste time, be unproductive, and procrastinate all at once."</td>
                  </tr>
                </tbody>
              </table>

              <h4>Step-by-Step: Finding Script Opposition</h4>
              <div class="theory-box" style="background: #e3f2fd;">
                <ol>
                  <li><strong>Read the setup:</strong> What do you expect?</li>
                  <li><strong>Read the punchline:</strong> What actually happens?</li>
                  <li><strong>Identify the clash:</strong> What two interpretations exist?</li>
                  <li><strong>Name the opposition:</strong> Which type is it?</li>
                </ol>
              </div>

              <h4>Practice: Identify the Script Opposition</h4>
              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                "I used to be a banker, but I lost interest."
              </p>

              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p><strong>What are the two scripts (meanings) in this joke?</strong></p>
                <p style="margin: 10px 0;">Script A: <input type="text" id="so-practice-1a" placeholder="First meaning..." style="width: 100%; padding: 8px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px;"></p>
                <p style="margin: 10px 0;">Script B: <input type="text" id="so-practice-1b" placeholder="Second meaning..." style="width: 100%; padding: 8px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px;"></p>
                <button type="button" data-action="call-fn" data-fn="checkSO1" style="background: var(--primary); color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;">Check Answer</button>
                <div id="so-feedback-1" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
              </div>

              <h4>Another Practice</h4>
              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                "I'm reading a book about anti-gravity. It's impossible to put down."
              </p>

              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p><strong>Identify the Script Opposition:</strong></p>
                <p style="margin: 10px 0;">Script A: <input type="text" id="so-practice-2a" placeholder="First interpretation..." style="width: 100%; padding: 8px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px;"></p>
                <p style="margin: 10px 0;">Script B: <input type="text" id="so-practice-2b" placeholder="Second interpretation..." style="width: 100%; padding: 8px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px;"></p>
                <button type="button" data-action="call-fn" data-fn="checkSO2" style="background: var(--primary); color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;">Check Answer</button>
                <div id="so-feedback-2" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
              </div>

              <div class="theory-box" style="background: #e8f5e9; margin-top: 20px;">
                <h5>Key Takeaway</h5>
                <p>Script Opposition is about finding the TWO ways to interpret something in a joke. Once you can identify both scripts, you've understood the core mechanism of the humour!</p>
              </div>
            `
          },
          {
            id: 'logical-mechanism',
            title: 'Knowledge Resource 2: Logical Mechanism (LM)',
            content: `
              <h4>HOW the Punchline Works</h4>
              <p>You know the joke has two scripts (Script Opposition). But <strong>HOW</strong> does the joke make you switch from one script to the other? That's the <strong>Logical Mechanism</strong>.</p>

              <div class="theory-box">
                <p><strong>Logical Mechanism (LM) =</strong> The technique that creates the surprise/twist</p>
                <p>It's the "trick" the joke uses to make you realize the second meaning</p>
              </div>

              <h4>Common Logical Mechanisms</h4>
              <table class="rubric-table">
                <thead>
                  <tr><th>Mechanism</th><th>How It Works</th><th>Example</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Ambiguity</strong></td>
                    <td>A word/phrase has multiple meanings</td>
                    <td>"Time flies like an arrow" (time passes quickly vs. flies that like arrows)</td>
                  </tr>
                  <tr>
                    <td><strong>Contradiction</strong></td>
                    <td>The punchline contradicts expectations</td>
                    <td>"I'd agree with you but then we'd both be wrong"</td>
                  </tr>
                  <tr>
                    <td><strong>False Analogy</strong></td>
                    <td>Compares two things incorrectly on purpose</td>
                    <td>"I'm on a seafood diet. I see food and I eat it."</td>
                  </tr>
                  <tr>
                    <td><strong>Exaggeration</strong></td>
                    <td>Takes something to an extreme</td>
                    <td>"I'm not lazy, I'm just highly motivated to do nothing"</td>
                  </tr>
                  <tr>
                    <td><strong>Role Reversal</strong></td>
                    <td>Swaps expected roles</td>
                    <td>"My dog is a genius. He can sit, stay, and make me feel guilty."</td>
                  </tr>
                  <tr>
                    <td><strong>Garden Path</strong></td>
                    <td>Leads you down one path, then switches</td>
                    <td>"I haven't slept for ten days, because that would be too long."</td>
                  </tr>
                </tbody>
              </table>

              <h4>LM vs SO: What's the Difference?</h4>
              <div class="theory-box" style="background: #e3f2fd;">
                <p><strong>SO (Script Opposition):</strong> WHAT are the two meanings?</p>
                <p><strong>LM (Logical Mechanism):</strong> HOW does the joke reveal the second meaning?</p>
                <br>
                <p><strong>Example:</strong> "I used to be a banker, but I lost interest."</p>
                <ul>
                  <li><strong>SO:</strong> Career interest vs. Bank interest</li>
                  <li><strong>LM:</strong> Ambiguity (the word "interest" has two meanings)</li>
                </ul>
              </div>

              <h4>Practice: Identify the Logical Mechanism</h4>
              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                "I told my wife she was drawing her eyebrows too high. She looked surprised."
              </p>

              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p><strong>What is the Logical Mechanism? (Select one)</strong></p>
                <div style="margin: 15px 0;">
                  <label style="display: block; padding: 10px; margin: 5px 0; cursor: pointer; border: 2px solid #ddd; border-radius: 5px;">
                    <input type="radio" name="lm1" value="ambiguity"> <strong>Ambiguity</strong> - A word/phrase has two meanings
                  </label>
                  <label style="display: block; padding: 10px; margin: 5px 0; cursor: pointer; border: 2px solid #ddd; border-radius: 5px;">
                    <input type="radio" name="lm1" value="contradiction"> <strong>Contradiction</strong> - The punchline contradicts expectations
                  </label>
                  <label style="display: block; padding: 10px; margin: 5px 0; cursor: pointer; border: 2px solid #ddd; border-radius: 5px;">
                    <input type="radio" name="lm1" value="exaggeration"> <strong>Exaggeration</strong> - Takes something to an extreme
                  </label>
                  <label style="display: block; padding: 10px; margin: 5px 0; cursor: pointer; border: 2px solid #ddd; border-radius: 5px;">
                    <input type="radio" name="lm1" value="garden"> <strong>Garden Path</strong> - Leads you one way, then switches
                  </label>
                </div>
                <button type="button" data-action="call-fn" data-fn="checkLM1" style="background: var(--primary); color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;">Check Answer</button>
                <div id="lm-feedback-1" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
              </div>

              <h4>Another Practice</h4>
              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                "I haven't slept for ten days, because that would be too long."
              </p>

              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p><strong>What is the Logical Mechanism here?</strong></p>
                <textarea id="lm-practice-2" placeholder="Explain how this joke works..." style="width: 100%; padding: 10px; margin: 10px 0; border: 2px solid #ddd; border-radius: 5px; min-height: 80px;"></textarea>
                <button type="button" data-action="call-fn" data-fn="checkLM2" style="background: var(--primary); color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;">Check Answer</button>
                <div id="lm-feedback-2" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
              </div>

              <div class="theory-box" style="background: #e8f5e9; margin-top: 20px;">
                <h5>Key Takeaway</h5>
                <p>The Logical Mechanism is the "HOW" - it's the specific trick or technique the joke uses to reveal the second script. Look for ambiguity, contradiction, garden paths, and other mechanisms!</p>
              </div>
            `
          },
          {
            id: 'situation-target',
            title: 'Knowledge Resources 3 & 4: Situation (SI) + Target (TA)',
            content: `
              <h4>Setting the Scene & Identifying the Victim</h4>
              <p>Now that you understand WHAT the joke is about (SO) and HOW it works (LM), let's look at WHERE it happens and WHO it's about.</p>

              <div class="theory-box">
                <p><strong>Situation (SI) =</strong> The context, setting, or circumstances of the joke</p>
                <p><strong>Target (TA) =</strong> Who or what is being laughed at or made fun of</p>
              </div>

              <h4>Situation (SI): Context Matters</h4>
              <p>The same joke can be funny or not funny depending on the situation.</p>

              <table class="rubric-table">
                <thead>
                  <tr><th>Aspect</th><th>Questions to Ask</th><th>Example</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Physical Setting</strong></td>
                    <td>Where does this happen?</td>
                    <td>Office, home, restaurant, online</td>
                  </tr>
                  <tr>
                    <td><strong>Social Context</strong></td>
                    <td>What's the relationship?</td>
                    <td>Friends, colleagues, strangers, family</td>
                  </tr>
                  <tr>
                    <td><strong>Activity</strong></td>
                    <td>What are people doing?</td>
                    <td>Working, eating, traveling, chatting</td>
                  </tr>
                  <tr>
                    <td><strong>Time/Era</strong></td>
                    <td>When is this relevant?</td>
                    <td>Modern day, historical, timeless</td>
                  </tr>
                </tbody>
              </table>

              <div class="theory-box" style="background: #fff3cd;">
                <h5>Why Situation Matters for Learners</h5>
                <p>Some jokes ONLY work in specific situations. If you don't recognize the situation, you won't get the joke!</p>
                <p><strong>Example:</strong> "I'm in a meeting" jokes only make sense if you understand British/Western office culture.</p>
              </div>

              <h4>Target (TA): Who's the Joke About?</h4>
              <p>Every joke has a target - the person, group, or thing being made fun of.</p>

              <table class="rubric-table">
                <thead>
                  <tr><th>Target Type</th><th>Description</th><th>Example</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Self</strong></td>
                    <td>The joke-teller makes fun of themselves</td>
                    <td>"I'm not lazy, I'm energy-efficient"</td>
                  </tr>
                  <tr>
                    <td><strong>Specific Person</strong></td>
                    <td>A particular individual (often friend/family)</td>
                    <td>"My wife says I never listen... or something like that"</td>
                  </tr>
                  <tr>
                    <td><strong>Group/Stereotype</strong></td>
                    <td>A profession, nationality, or group</td>
                    <td>"How many programmers does it take to change a lightbulb? None, that's a hardware problem."</td>
                  </tr>
                  <tr>
                    <td><strong>Situation/Concept</strong></td>
                    <td>An abstract idea or common experience</td>
                    <td>"Monday mornings should be illegal"</td>
                  </tr>
                  <tr>
                    <td><strong>No specific target</strong></td>
                    <td>Pure wordplay with no victim</td>
                    <td>"I used to be a baker but I couldn't make enough dough"</td>
                  </tr>
                </tbody>
              </table>

              <h4>Practice: Identify SI and TA</h4>
              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                <strong>Joke 1:</strong> "My boss told me to have a good day. So I went home."
              </p>

              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p><strong>Question 1: What is the SITUATION (SI)?</strong></p>
                <select id="si-practice-1" style="width: 100%; padding: 10px; margin: 10px 0; border: 2px solid #ddd; border-radius: 5px;">
                  <option value="">-- Select the situation --</option>
                  <option value="workplace">Workplace/Office environment</option>
                  <option value="home">Home/Family setting</option>
                  <option value="social">Social gathering with friends</option>
                  <option value="online">Online/Social media</option>
                </select>

                <p style="margin-top: 20px;"><strong>Question 2: Who is the TARGET (TA)?</strong></p>
                <select id="ta-practice-1" style="width: 100%; padding: 10px; margin: 10px 0; border: 2px solid #ddd; border-radius: 5px;">
                  <option value="">-- Select the target --</option>
                  <option value="boss">The boss (bad bosses)</option>
                  <option value="self">The joke-teller (self-deprecating)</option>
                  <option value="work">Work culture / employment in general</option>
                  <option value="none">No specific target</option>
                </select>

                <button type="button" data-action="call-fn" data-fn="checkSITA1" style="background: var(--primary); color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;">Check Answers</button>
                <div id="sita-feedback-1" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
              </div>

              <h4>Another Practice</h4>
              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                <strong>Joke 2:</strong> "I told my wife she was drawing her eyebrows too high. She looked surprised."
              </p>

              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p><strong>Describe the Situation and Target:</strong></p>
                <p style="margin: 10px 0;"><strong>Situation (SI):</strong><br>
                <textarea id="si-practice-2" placeholder="Describe the situation/context..." style="width: 100%; padding: 10px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px; min-height: 60px;"></textarea></p>
                <p style="margin: 10px 0;"><strong>Target (TA):</strong><br>
                <textarea id="ta-practice-2" placeholder="Who/what is being made fun of?" style="width: 100%; padding: 10px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px; min-height: 60px;"></textarea></p>
                <button type="button" data-action="call-fn" data-fn="checkSITA2" style="background: var(--primary); color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;">Check Answers</button>
                <div id="sita-feedback-2" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
              </div>

              <div class="theory-box" style="background: #e8f5e9; margin-top: 20px;">
                <h5>Key Takeaway</h5>
                <p><strong>Situation (SI):</strong> Understanding the context helps you know WHY the joke is funny in that setting</p>
                <p><strong>Target (TA):</strong> Identifying who/what is being made fun of helps you understand cultural attitudes and appropriateness</p>
              </div>
            `
          },
          {
            id: 'narrative-strategy',
            title: 'Knowledge Resource 5: Narrative Strategy (NS)',
            content: `
              <h4>How the Joke is Told</h4>
              <p><strong>Narrative Strategy</strong> is about the STRUCTURE and DELIVERY of the joke. How is the joke organized? Who tells it? What format does it use?</p>

              <div class="theory-box">
                <p><strong>Narrative Strategy (NS) =</strong> The way the joke is presented and structured</p>
                <p>Same content can be funny or not depending on HOW you tell it!</p>
              </div>

              <h4>Common Narrative Strategies</h4>
              <table class="rubric-table">
                <thead>
                  <tr><th>Strategy</th><th>Structure</th><th>Example</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Simple Narrative</strong></td>
                    <td>Setup → Punchline</td>
                    <td>"I used to be a banker but I lost interest."</td>
                  </tr>
                  <tr>
                    <td><strong>Dialogue</strong></td>
                    <td>Conversation between characters</td>
                    <td>"Wife: 'Do I look fat?' Husband: 'Do I look stupid?'"</td>
                  </tr>
                  <tr>
                    <td><strong>Question-Answer</strong></td>
                    <td>Riddle format</td>
                    <td>"Why did the chicken cross the road? To get to the other side."</td>
                  </tr>
                  <tr>
                    <td><strong>List/Series</strong></td>
                    <td>Pattern with twist at end</td>
                    <td>"I can speak 3 languages: English, sarcasm, and profanity."</td>
                  </tr>
                  <tr>
                    <td><strong>Story/Anecdote</strong></td>
                    <td>Longer narrative with buildup</td>
                    <td>"So I was at the shop yesterday, and you'll never believe what happened..."</td>
                  </tr>
                  <tr>
                    <td><strong>Observational</strong></td>
                    <td>Statement about life/reality</td>
                    <td>"Ever notice how 'studying' is 'student' + 'dying'?"</td>
                  </tr>
                </tbody>
              </table>

              <h4>Why NS Matters for Language Learners</h4>
              <div class="theory-box" style="background: #e3f2fd;">
                <h5>Format Recognition</h5>
                <p>Different cultures prefer different narrative strategies:</p>
                <ul>
                  <li><strong>British humour:</strong> Often uses observational or deadpan delivery</li>
                  <li><strong>American humour:</strong> Frequently uses question-answer or list formats</li>
                  <li><strong>Uzbek humour (Askiya):</strong> Dialogue/exchange format</li>
                </ul>
                <p>If you recognize the format, you know when the punchline is coming!</p>
              </div>

              <h4>Delivery Elements in NS</h4>
              <ul>
                <li><strong>Timing:</strong> When to pause, when to speed up</li>
                <li><strong>Voice:</strong> First person ("I...") vs. Third person ("A man...")</li>
                <li><strong>Framing:</strong> "Did you hear about..." vs. "So yesterday I..."</li>
                <li><strong>Length:</strong> One-liner vs. long story</li>
              </ul>

              <h4>Practice: Identify Narrative Strategy</h4>

              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                <strong>Joke 1:</strong> "Why don't scientists trust atoms? Because they make up everything."
              </p>

              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p><strong>What is the Narrative Strategy?</strong></p>
                <select id="ns-practice-1" style="width: 100%; padding: 10px; margin: 10px 0; border: 2px solid #ddd; border-radius: 5px;">
                  <option value="">-- Select narrative strategy --</option>
                  <option value="simple">Simple Narrative (setup → punchline)</option>
                  <option value="dialogue">Dialogue (conversation)</option>
                  <option value="qa">Question-Answer (riddle format)</option>
                  <option value="list">List/Series</option>
                  <option value="story">Story/Anecdote</option>
                  <option value="observational">Observational statement</option>
                </select>
                <button type="button" data-action="call-fn" data-fn="checkNS1" style="background: var(--primary); color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;">Check Answer</button>
                <div id="ns-feedback-1" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
              </div>

              <h4>more practice</h4>
              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                <strong>Joke 2:</strong> "I'm not saying I'm Batman. I'm just saying no one has ever seen me and Batman in the same room together."
              </p>

              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                <strong>Joke 3:</strong> "A man walks into a bar. Ouch."
              </p>

              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p><strong>Match each joke to its Narrative Strategy:</strong></p>

                <p style="margin: 15px 0;"><strong>Joke 2 Narrative Strategy:</strong></p>
                <select id="ns-practice-2a" style="width: 100%; padding: 10px; margin: 10px 0; border: 2px solid #ddd; border-radius: 5px;">
                  <option value="">-- Select --</option>
                  <option value="simple">Simple Narrative</option>
                  <option value="observational">Observational</option>
                  <option value="story">Story/Anecdote</option>
                  <option value="list">List/Series</option>
                </select>

                <p style="margin: 15px 0;"><strong>Joke 3 Narrative Strategy:</strong></p>
                <select id="ns-practice-2b" style="width: 100%; padding: 10px; margin: 10px 0; border: 2px solid #ddd; border-radius: 5px;">
                  <option value="">-- Select --</option>
                  <option value="simple">Simple Narrative</option>
                  <option value="observational">Observational</option>
                  <option value="story">Story/Anecdote</option>
                  <option value="subvert">Subverted Story (starts as story, short punchline)</option>
                </select>

                <button type="button" data-action="call-fn" data-fn="checkNS2" style="background: var(--primary); color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;">Check Answers</button>
                <div id="ns-feedback-2" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
              </div>

              <div class="theory-box" style="background: #e8f5e9; margin-top: 20px;">
                <h5>Key Takeaway</h5>
                <p>Narrative Strategy tells you HOW the joke is structured and delivered. Recognizing common formats (question-answer, observational, story) helps you:</p>
                <ul>
                  <li>Know when the punchline is coming</li>
                  <li>Understand cultural joke traditions</li>
                  <li>Tell jokes more effectively yourself</li>
                </ul>
              </div>
            `
          },
          {
            id: 'language',
            title: 'Knowledge Resource 6: Language (LA)',
            content: `
              <h4>The Power of Wordplay</h4>
              <p><strong>Language</strong> is the most technical Knowledge Resource. It focuses on the specific linguistic features that make a joke work.</p>

              <div class="theory-box">
                <p><strong>Language (LA) =</strong> The specific words, sounds, grammar, or linguistic features that create humour</p>
                <p>This includes: puns, homophones, rhymes, ambiguous grammar, and more</p>
              </div>

              <h4>Types of Language-Based Humour</h4>
              <table class="rubric-table">
                <thead>
                  <tr><th>Language Feature</th><th>Description</th><th>Example</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Homophones</strong></td>
                    <td>Words that sound the same but mean different things</td>
                    <td>"I used to be a baker but I couldn't make enough dough" (dough = bread/money)</td>
                  </tr>
                  <tr>
                    <td><strong>Polysemy</strong></td>
                    <td>One word with multiple related meanings</td>
                    <td>"I lost interest" (enthusiasm vs. bank interest)</td>
                  </tr>
                  <tr>
                    <td><strong>Idiom Literalization</strong></td>
                    <td>Taking an idiom literally instead of figuratively</td>
                    <td>"It's raining cats and dogs. I just stepped in a poodle."</td>
                  </tr>
                  <tr>
                    <td><strong>Morphological Play</strong></td>
                    <td>Breaking words into parts</td>
                    <td>"Studying = Student + Dying"</td>
                  </tr>
                  <tr>
                    <td><strong>Syntactic Ambiguity</strong></td>
                    <td>Sentence structure allows two meanings</td>
                    <td>"Time flies like an arrow. Fruit flies like a banana."</td>
                  </tr>
                  <tr>
                    <td><strong>Phonological</strong></td>
                    <td>Sound-based (rhymes, alliteration)</td>
                    <td>"See you later, alligator!"</td>
                  </tr>
                </tbody>
              </table>

              <h4>Why LA is Crucial for Language Learners</h4>
              <div class="theory-box" style="background: #fff3cd; border-left: 4px solid #ffc107;">
                <h5>?? LA is the hardest part for non-native speakers!</h5>
                <p>Wordplay requires:</p>
                <ul>
                  <li>? Deep vocabulary knowledge (knowing multiple meanings)</li>
                  <li>? Understanding of idioms and expressions</li>
                  <li>? Ability to hear sound similarities</li>
                  <li>? Fast mental processing</li>
                </ul>
                <p><strong>Good news:</strong> GTVH helps you break down the language to see HOW it works!</p>
              </div>

              <h4>LA vs LM: What's the Difference?</h4>
              <div class="theory-box" style="background: #e3f2fd;">
                <p><strong>LM (Logical Mechanism):</strong> The mental trick (ambiguity, contradiction, garden path)</p>
                <p><strong>LA (Language):</strong> The specific words/sounds used to create that trick</p>
                <br>
                <p><strong>Example:</strong> "I used to be a banker but I lost interest"</p>
                <ul>
                  <li><strong>LM:</strong> Ambiguity (general mechanism)</li>
                  <li><strong>LA:</strong> Polysemy of "interest" - one word, two meanings (specific linguistic feature)</li>
                </ul>
              </div>

              <h4>Practice: Identify Language Features</h4>
              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                "I'm reading a book about anti-gravity. It's impossible to put down."
              </p>

              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p><strong>What language feature creates the humour?</strong></p>
                <select id="la-practice-1" style="width: 100%; padding: 10px; margin: 10px 0; border: 2px solid #ddd; border-radius: 5px;">
                  <option value="">-- Select language feature --</option>
                  <option value="homophone">Homophones (same sound, different meaning)</option>
                  <option value="idiom">Idiom Literalization (literal vs. figurative)</option>
                  <option value="polysemy">Polysemy (one word, multiple meanings)</option>
                  <option value="morphology">Morphological Play (word parts)</option>
                </select>

                <p style="margin-top: 15px;"><strong>Which specific word/phrase creates the double meaning?</strong></p>
                <input type="text" id="la-practice-1-word" placeholder="Type the word or phrase..." style="width: 100%; padding: 10px; margin: 10px 0; border: 2px solid #ddd; border-radius: 5px;">

                <button type="button" data-action="call-fn" data-fn="checkLA1" style="background: var(--primary); color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;">Check Answers</button>
                <div id="la-feedback-1" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
              </div>

              <h4>Advanced Practice</h4>
              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                "Time flies like an arrow. Fruit flies like a banana."
              </p>

              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p><strong>This is a famous complex joke! Analyze the language:</strong></p>

                <p style="margin: 10px 0;"><strong>1. What language feature is used?</strong></p>
                <select id="la-practice-2a" style="width: 100%; padding: 10px; margin: 10px 0; border: 2px solid #ddd; border-radius: 5px;">
                  <option value="">-- Select --</option>
                  <option value="homophone">Homophones</option>
                  <option value="syntax">Syntactic Ambiguity (grammar structure)</option>
                  <option value="polysemy">Polysemy</option>
                  <option value="idiom">Idiom Literalization</option>
                </select>

                <p style="margin: 10px 0;"><strong>2. Explain the two meanings of "flies":</strong></p>
                <textarea id="la-practice-2b" placeholder="Explain the two meanings..." style="width: 100%; padding: 10px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px; min-height: 80px;"></textarea>

                <button type="button" data-action="call-fn" data-fn="checkLA2" style="background: var(--primary); color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;">Check Answers</button>
                <div id="la-feedback-2" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
              </div>

              <h4>Complete GTVH Analysis Practice</h4>
              <p style="font-style: italic; padding: 10px; background: #f8f9fa; border-radius: 8px; margin: 15px 0;">
                "I told my wife she was drawing her eyebrows too high. She looked surprised."
              </p>

              <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p><strong>Now apply ALL 6 Knowledge Resources!</strong></p>

                <div style="margin: 15px 0;">
                  <label><strong>SO (Script Opposition):</strong></label>
                  <input type="text" id="complete-so" placeholder="What two meanings clash?" style="width: 100%; padding: 8px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px;">
                </div>

                <div style="margin: 15px 0;">
                  <label><strong>LM (Logical Mechanism):</strong></label>
                  <input type="text" id="complete-lm" placeholder="How does it work?" style="width: 100%; padding: 8px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px;">
                </div>

                <div style="margin: 15px 0;">
                  <label><strong>SI (Situation):</strong></label>
                  <input type="text" id="complete-si" placeholder="Context/setting?" style="width: 100%; padding: 8px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px;">
                </div>

                <div style="margin: 15px 0;">
                  <label><strong>TA (Target):</strong></label>
                  <input type="text" id="complete-ta" placeholder="Who/what is being teased?" style="width: 100%; padding: 8px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px;">
                </div>

                <div style="margin: 15px 0;">
                  <label><strong>NS (Narrative Strategy):</strong></label>
                  <input type="text" id="complete-ns" placeholder="How is it told?" style="width: 100%; padding: 8px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px;">
                </div>

                <div style="margin: 15px 0;">
                  <label><strong>LA (Language):</strong></label>
                  <input type="text" id="complete-la" placeholder="What specific language feature?" style="width: 100%; padding: 8px; margin: 5px 0; border: 2px solid #ddd; border-radius: 5px;">
                </div>

                <button type="button" data-action="call-fn" data-fn="checkComplete" style="background: var(--primary); color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 10px 0;">Check Complete Analysis</button>
                <div id="complete-feedback" style="margin-top: 15px; padding: 15px; border-radius: 8px; display: none;"></div>
              </div>

              <div class="theory-box" style="background: #e8f5e9; margin-top: 20px;">
                <h5>Module 6 Complete!</h5>
                <p>You now have a complete framework (GTVH) to analyze ANY joke systematically using 6 Knowledge Resources:</p>
                <ol>
                  <li><strong>SO:</strong> What two scripts clash?</li>
                  <li><strong>LM:</strong> How does the punchline work?</li>
                  <li><strong>SI:</strong> What's the context?</li>
                  <li><strong>TA:</strong> Who/what is the target?</li>
                  <li><strong>NS:</strong> How is it structured/told?</li>
                  <li><strong>LA:</strong> What language features create the humor?</li>
                </ol>
                <p><strong>Use GTVH whenever you encounter a joke you don't understand - it will help you identify exactly WHAT you're missing!</strong></p>
              </div>
            `
          }
        ]
      }
    };

    // ========================================
    // MODULE 6: ATTARDO'S GTVH (Updated Content)
    // ========================================
    const MODULE_6_THEORY_CONTENT = {
      'module-6': {
        theorySections: [
          {
            id: 'gtvh-introduction',
            title: 'What is GTVH?',
            content: `
              <div class="theory-box" style="background: #dbeafe; border-left: 4px solid #3b82f6;">
                <h4 style="margin-top: 0;">Plain English Summary</h4>
                <p><strong>GTVH is a way to break down any joke into 6 simple parts.</strong> Instead of just saying "I get it" or "I don't get it," you can actually understand exactly why a joke is funny by looking at each part one by one.</p>
              </div>

              <h4>The General Theory of Verbal Humour</h4>
              <p><strong>GTVH</strong> was created by Salvatore Attardo and Victor      
  Raskin in the 1990s. It's a practical system for understanding how jokes work.</p>

              <div class="theory-box">
                <p><strong>Main Idea:</strong> Every joke has <strong>6 parts</strong> called <strong>Knowledge Resources</strong>. When you identify these parts, you understand HOW and WHY the joke is funny.</p>
              </div>

              <h4>Why Learn This?</h4>
              <table class="rubric-table">
                <tr><td><strong>Step-by-Step Understanding</strong></td><td>Instead of just "getting it" or not, you can analyze what makes it funny</td></tr>
                <tr><td><strong>Better Language Skills</strong></td><td>You'll spot wordplay, puns, and cultural references more easily</td></tr>
                <tr><td><strong>Works Across Cultures</strong></td><td>You can explain why a joke works even if it's not funny to you</td></tr>
                <tr><td><strong>Builds Critical Thinking</strong></td><td>GTVH teaches you to analyze language and meaning carefully</td></tr>
              </table>

              <div class="theory-box" style="background: #e8f5e9;">
                <p><strong>The Big Secret:</strong> All jokes rely on TWO clashing ideas that overlap. The surprise of jumping from one idea to the other creates the humor!</p>
              </div>
            `
          },
          {
            id: 'six-knowledge-resources',
            title: 'The 6 Knowledge Resources (Overview)',
            content: `
              <div class="theory-box" style="background: #dbeafe; border-left: 4px solid #3b82f6;">
                <h4 style="margin-top: 0;">Plain English Summary</h4>
                <p><strong>Here are the 6 parts that make up every joke.</strong> The first two (Script Opposition and Logical Mechanism) are the most important - they're what actually make the joke funny. The other four are like the decorations and packaging around the joke.</p>
              </div>

              <h4>The 6 Parts - From Most to Least Important</h4>

              <table class="rubric-table">
                <thead>
                  <tr><th>#</th><th>Knowledge Resource</th><th>Question It Answers</th><th>Example</th></tr>
                </thead>
                <tbody>
                  <tr style="background: #fee2e2;"><td><strong>1</strong></td><td><strong>Script Opposition (SO)</strong></td><td>What two meanings clash?</td><td>Professional vs. literal meaning</td></tr>
                  <tr style="background: #fef3c7;"><td><strong>2</strong></td><td><strong>Logical Mechanism (LM)</strong></td><td>How does the punchline connect?</td><td>Pun, faulty logic, exaggeration</td></tr>
                  <tr style="background: #e0f2fe;"><td><strong>3</strong></td><td><strong>Situation (SI)</strong></td><td>What's the setting?</td><td>Doctor's office, bar, school</td></tr>
                  <tr style="background: #f3e8ff;"><td><strong>4</strong></td><td><strong>Target (TA)</strong></td><td>Who is mocked?</td><td>Politicians, professions, self</td></tr>
                  <tr style="background: #dcfce7;"><td><strong>5</strong></td><td><strong>Narrative Strategy (NS)</strong></td><td>What format?</td><td>Riddle, story, one-liner</td></tr>
                  <tr style="background: #f1f5f9;"><td><strong>6</strong></td><td><strong>Language (LA)</strong></td><td>What exact words?</td><td>Specific phrasing, sounds</td></tr>
                </tbody>
              </table>
              
              <div class="theory-box" style="background: #fff3cd;">
                <p><strong>Hierarchy Rule:</strong></p>
                <p>- Change <strong>SO</strong> = completely different joke</p>
                <p>- Change only <strong>LA</strong> = same joke, different words</p>
              </div>
            `
          },
          {
            id: 'kr-script-opposition',
            title: '1. Script Opposition (SO) - The Heart',
            content: `
              <div class="theory-box" style="background: #dbeafe; border-left: 4px solid #3b82f6;">
                <h4 style="margin-top: 0;">Plain English Summary</h4>
                <p><strong>Script Opposition means finding the TWO clashing ideas in a joke.</strong> A joke starts by making you think of one idea, then suddenly switches to a completely different idea. That surprise switch is what makes you laugh!</p>
              </div>

              <h4>The Most Important Element</h4>
              <p><strong>Script Opposition (SO)</strong> finds the TWO clashing ideas that overlap in the joke. A "script" is just a way of thinking about something.</p>

              <div class="theory-box">
                <p><strong>Simple Definition:</strong> Two different meanings that clash with each other - the joke makes you jump from one to the other.</p>
              </div>

              <h4>Common Types of Clashing Ideas</h4>
              <table class="rubric-table">
                <thead>
                  <tr><th>Type of Clash</th><th>Idea 1</th><th>Idea 2</th></tr>
                </thead>
                <tbody>
                  <tr><td>Literal / Figurative</td><td>The actual word meaning</td><td>The saying/idiom meaning</td></tr>
                  <tr><td>Real / Unreal</td><td>Normal reality</td><td>Impossible/silly situation</td></tr>
                  <tr><td>Expected / Unexpected</td><td>What should happen</td><td>What actually happens</td></tr>
                  <tr><td>Innocent / Taboo</td><td>Clean meaning</td><td>Adult/hidden meaning</td></tr>
                  <tr><td>Smart / Stupid</td><td>Clever interpretation</td><td>Silly interpretation</td></tr>
                </tbody>
              </table>

              <h4>Example</h4>
              <div class="joke-card">
                <p class="joke-text">"I used to be a banker, but I lost interest."</p>
              </div>
              <p><strong>Idea 1:</strong> Career/feelings - "lost interest" = got bored</p>
              <p><strong>Idea 2:</strong> Banking/money - "lost interest" = lost money from bank interest</p>
              <p><strong>The Clash:</strong> Feelings vs. Money - two totally different meanings of the same phrase!</p>
            `
          },
          {
            id: 'kr-logical-mechanism',
            title: '2. Logical Mechanism (LM) - The Trick',
            content: `
              <div class="theory-box" style="background: #dbeafe; border-left: 4px solid #3b82f6;">
                <h4 style="margin-top: 0;">Plain English Summary</h4>
                <p><strong>The Logical Mechanism is HOW the joke connects the two clashing ideas.</strong> It's the trick or technique that lets you jump from one meaning to the other. Think of it as the bridge that connects the two sides of the joke.</p>
              </div>

              <h4>How the Joke "Works"</h4>
              <p><strong>Logical Mechanism (LM)</strong> is the "trick" that connects the setup to the punchline.</p>

              <div class="theory-box" style="background: #fef3c7;">
                <p><strong>Helpful Analogy:</strong> Think of the Logical Mechanism as the <strong>bridge that connects the two sides of the joke</strong>. On one side is the first idea, on the other side is the second clashing idea. The bridge is how you get from one to the other!</p>
              </div>

              <h4>Common Types of Bridges (Logical Mechanisms)</h4>
              <table class="rubric-table">
                <thead>
                  <tr><th>Mechanism</th><th>How It Works</th><th>Example</th></tr>
                </thead>
                <tbody>
                  <tr><td><strong>Pun</strong></td><td>One word with multiple meanings</td><td>"Interest" (curiosity/bank rate)</td></tr>
                  <tr><td><strong>Sound-Alike Words</strong></td><td>Words that sound the same</td><td>"Cereal" / "serial" killer</td></tr>
                  <tr><td><strong>Faulty Logic</strong></td><td>Reasoning that sounds right but isn't</td><td>Silly conclusions</td></tr>
                  <tr><td><strong>Exaggeration</strong></td><td>Making something ridiculously extreme</td><td>Over-the-top claims</td></tr>
                  <tr><td><strong>Misdirection</strong></td><td>Lead you to expect one thing, then surprise you</td><td>Surprise endings</td></tr>
                  <tr><td><strong>Literal Interpretation</strong></td><td>Taking a saying word-for-word instead of as an expression</td><td>Treating idioms as literal</td></tr>
                </tbody>
              </table>

              <h4>Example</h4>
              <div class="joke-card">
                <p class="joke-text">"What do you call a fish without eyes? A fsh."</p>
              </div>
              <p><strong>LM (The Bridge):</strong> Sound-alike words + spelling trick</p>
              <p>"Eyes" sounds like "i's" (the letter i) ? Remove the i from "fish" ? "fsh"</p>
            `
          },
          {
            id: 'kr-remaining-four',
            title: '3-6. SI, TA, NS, LA',
            content: `
              <div class="theory-box" style="background: #dbeafe; border-left: 4px solid #3b82f6;">
                <h4 style="margin-top: 0;">Plain English Summary</h4>
                <p><strong>These last four parts describe the "packaging" of the joke.</strong> They tell you WHERE the joke takes place (Situation), WHO gets made fun of (Target), HOW the joke is told (Narrative Strategy), and WHAT exact words are used (Language). These can change without changing the core joke.</p>
              </div>

              <h4>3. Situation (SI) - The Setting</h4>
              <div class="theory-box">
                <p>The "props" of the joke: characters, objects, locations, activities.</p>
              </div>
              <p><strong>Example:</strong> Doctor joke SI = doctor, patient, office, illness</p>
              
              <hr style="margin: 20px 0;">
              
              <h4>4. Target (TA) - The "Butt"</h4>
              <div class="theory-box">
                <p>Who or what is being mocked or shown as foolish.</p>
              </div>
              <p><strong>Common targets:</strong> Politicians, professions, nationalities, the joke-teller (self-deprecation), or NO target (pure wordplay)</p>
              
              <hr style="margin: 20px 0;">
              
              <h4>5. Narrative Strategy (NS) - The Format</h4>
              <div class="theory-box">
                <p>How the joke is structured and delivered.</p>
              </div>
              <table class="rubric-table">
                <tr><td><strong>Riddle</strong></td><td>"Why did X...? Because Y."</td></tr>
                <tr><td><strong>Question-Answer</strong></td><td>"What do you call...?"</td></tr>
                <tr><td><strong>Narrative</strong></td><td>"A man walks into a bar..."</td></tr>
                <tr><td><strong>One-liner</strong></td><td>Single sentence joke</td></tr>
                <tr><td><strong>Dialogue</strong></td><td>Conversation between characters</td></tr>
              </table>
              
              <hr style="margin: 20px 0;">
              
              <h4>6. Language (LA) - The Words</h4>
              <div class="theory-box">
                <p>The exact wording, sounds, and phrasing chosen.</p>
              </div>
              <p>LA is the "surface" level - you can change the words but keep the same joke (translation, paraphrase).</p>
            `
          },
          {
            id: 'complete-analysis',
            title: 'Complete Analysis Example',
            content: `
              <div class="theory-box" style="background: #dbeafe; border-left: 4px solid #3b82f6;">
                <h4 style="margin-top: 0;">Plain English Summary</h4>
                <p><strong>Now let's put it all together!</strong> We'll take one joke and identify all 6 parts. You'll see how each piece contributes to making the joke work. This is how you can analyze any joke step-by-step.</p>
              </div>

              <h4>Full GTVH Analysis</h4>

              <div class="joke-card">
                <p class="joke-text">"Why did the scarecrow win an award?<br>Because he was outstanding in his field!"</p>
              </div>
              
              <table class="rubric-table">
                <thead>
                  <tr><th>KR</th><th>Analysis</th></tr>
                </thead>
                <tbody>
                  <tr style="background: #fee2e2;">
                    <td><strong>SO</strong></td>
                    <td><strong>Script 1:</strong> Achievement - "outstanding" = excellent<br><strong>Script 2:</strong> Physical - "standing out in field" = literally in farm field</td>
                  </tr>
                  <tr style="background: #fef3c7;">
                    <td><strong>LM</strong></td>
                    <td><strong>Polysemy:</strong> "Outstanding in his field" has double meaning<br><strong>Garden path:</strong> "Win award" primes achievement, then literal reveal</td>
                  </tr>
                  <tr style="background: #e0f2fe;">
                    <td><strong>SI</strong></td>
                    <td>Scarecrow, farm field, award ceremony</td>
                  </tr>
                  <tr style="background: #f3e8ff;">
                    <td><strong>TA</strong></td>
                    <td>No target - harmless wordplay</td>
                  </tr>
                  <tr style="background: #dcfce7;">
                    <td><strong>NS</strong></td>
                    <td>Riddle format: "Why did X? Because Y"</td>
                  </tr>
                  <tr style="background: #f1f5f9;">
                    <td><strong>LA</strong></td>
                    <td>Key phrase: "outstanding in his field" - common English idiom</td>
                  </tr>
                </tbody>
              </table>
              
              <div class="theory-box" style="background: #e8f5e9;">
                <h4>Now practice analyzing jokes yourself in the Interactive Analysis section!</h4>
              </div>
            `
          },
          {
            id: 'gtvh-interactive-analyzer',
            title: 'Interactive Analyzer Practice',
            content: `
              <p>Put GTVH into action: choose a joke, analyze each Knowledge Resource, and get instant keyword-based feedback.</p>
              <div id="gtvh-analyzer-container"></div>
            `
          }
        ]
      }
    };

    // Override legacy module-6 theory content with the updated GTVH material
    MODULE_THEORY_CONTENT['module-6'] = MODULE_6_THEORY_CONTENT['module-6'];

    // ========================================
    // MODULE 6: GTVH Interactive Analyzer (Keyword-Based Feedback)
    // ========================================
    const GTVH_ANALYZER = {
      
      // Jokes for analysis with expected keywords/concepts
      practiceJokes: [
        {
          id: 'gtvh-practice-1',
          joke: "I told my wife she was drawing her eyebrows too high. She looked surprised.",
          difficulty: 'easy',
          hints: {
            SO: 'Think about what "surprised" can mean...',
            LM: 'What type of word trick is being used?',
            SI: 'Who are the characters? Where might this happen?',
            TA: 'Is anyone being made fun of?',
            NS: 'Is this a riddle, story, or one-liner?',
            LA: 'Which specific word creates the humour?'
          },
          expectedKeywords: {
            SO: ['emotion', 'feeling', 'shocked', 'facial', 'face', 'eyebrow', 'raised', 'expression', 'surprised', 'high', 'appearance', 'reaction', 'physical'],
            LM: ['polysemy', 'pun', 'double meaning', 'two meanings', 'word play', 'wordplay', 'ambiguity', 'homonym'],
            SI: ['wife', 'husband', 'couple', 'married', 'home', 'mirror', 'makeup', 'bathroom'],
            TA: ['wife', 'no target', 'none', 'self', 'harmless', 'wordplay'],
            NS: ['one-liner', 'one liner', 'short', 'dialogue', 'anecdote', 'narrative'],
            LA: ['surprised', 'eyebrows', 'too high', 'looked']
          },
          modelAnswer: {
            SO: 'Script 1: Emotional reaction (surprised = shocked by criticism). Script 2: Physical appearance (surprised = eyebrows raised high). The word "surprised" connects both meanings.',
            LM: 'Polysemy/Pun - "surprised" means both the emotion AND the facial expression with raised eyebrows.',
            SI: 'Married couple (husband and wife), likely at home, context of makeup/appearance.',
            TA: 'Mild target on the wife, but mostly harmless wordplay - no strong mockery.',
            NS: 'One-liner / short anecdote format.',
            LA: 'Key word: "surprised" - carries both meanings and is positioned as punchline.'
          }
        },
        {
          id: 'gtvh-practice-2', 
          joke: "I'm reading a book about anti-gravity. It's impossible to put down!",
          difficulty: 'easy',
          hints: {
            SO: 'Think about two meanings of "put down"...',
            LM: 'What makes "put down" special here?',
            SI: 'What activity is happening?',
            TA: 'Is this joke making fun of anyone?',
            NS: 'How is this joke structured?',
            LA: 'Which phrase has the double meaning?'
          },
          expectedKeywords: {
            SO: ["stop reading", "can't stop", 'engaging', 'interesting', 'physical', 'gravity', 'float', 'lift', 'literal', 'figurative', 'put down'],
            LM: ['polysemy', 'pun', 'double meaning', 'idiom', 'literal', 'figurative', 'wordplay'],
            SI: ['book', 'reading', 'reader', 'science', 'physics', 'anti-gravity'],
            TA: ['no target', 'none', 'harmless', 'wordplay', 'no one'],
            NS: ['one-liner', 'one liner', 'statement', 'observation'],
            LA: ['put down', 'impossible', 'anti-gravity']
          },
          modelAnswer: {
            SO: "Script 1: Reading engagement - \"can't put down\" = so interesting I can't stop reading. Script 2: Physical impossibility - \"can't put down\" = anti-gravity makes it float/impossible to set down.",
            LM: 'Polysemy - "put down" is an idiom for stopping reading, but literally means placing something down (impossible with anti-gravity).',
            SI: 'Someone reading a book about physics/anti-gravity.',
            TA: 'No target - pure wordplay, no one is mocked.',
            NS: 'One-liner observation format.',
            LA: 'Key phrase: "impossible to put down" - idiom taken literally.'
          }
        },
        {
          id: 'gtvh-practice-3',
          joke: "Why don't scientists trust atoms? Because they make up everything!",
          difficulty: 'medium',
          hints: {
            SO: 'What does "make up" mean in science vs. everyday language?',
            LM: 'Two meanings of the same phrase...',
            SI: 'What field of science is this about?',
            TA: 'Who might be the "butt" of this joke?',
            NS: 'What classic joke format is this?',
            LA: 'Which phrase carries both meanings?'
          },
          expectedKeywords: {
            SO: ['compose', 'composition', 'constitute', 'lie', 'lying', 'fabricate', 'invent', 'deceive', 'trust', 'physical', 'matter', 'dishonest'],
            LM: ['polysemy', 'pun', 'double meaning', 'wordplay', 'homonym', 'phrase'],
            SI: ['science', 'scientist', 'atom', 'physics', 'chemistry', 'laboratory', 'research'],
            TA: ['atom', 'atoms', 'no target', 'science', 'harmless', 'none'],
            NS: ['riddle', 'question', 'why', 'because', 'q&a', 'question-answer'],
            LA: ['make up', 'everything', 'trust']
          },
          modelAnswer: {
            SO: 'Script 1: Physical composition - atoms "make up" (compose/form) everything in the universe. Script 2: Deception - "make up" = to lie or fabricate stories. Trust issue implies dishonesty.',
            LM: 'Polysemy - "make up" has multiple meanings: compose/form AND lie/fabricate.',
            SI: 'Scientific context - scientists studying atoms/physics.',
            TA: 'Atoms personified as untrustworthy - mild, playful target.',
            NS: 'Classic riddle format: "Why don\'t X? Because Y."',
            LA: 'Key phrase: "make up everything" - bridges both scripts.'
          }
        },
        {
          id: 'gtvh-practice-4',
          joke: "I used to hate facial hair, but then it grew on me.",
          difficulty: 'medium',
          hints: {
            SO: 'What does "grew on me" mean emotionally vs. literally?',
            LM: 'An idiom being taken literally...',
            SI: 'What is physically changing?',
            TA: 'Is the speaker making fun of anyone?',
            NS: 'Past to present change - what format?',
            LA: 'Which phrase works in two ways?'
          },
          expectedKeywords: {
            SO: ['like', 'appreciate', 'enjoy', 'fond', 'opinion change', 'physical growth', 'beard', 'hair growing', 'literal', 'figurative'],
            LM: ['polysemy', 'idiom', 'literal', 'figurative', 'pun', 'double meaning', 'wordplay'],
            SI: ['facial hair', 'beard', 'mustache', 'face', 'grooming', 'personal'],
            TA: ['self', 'self-deprecation', 'speaker', 'no target', 'himself', 'herself'],
            NS: ['one-liner', 'observation', 'personal', 'anecdote', 'past tense'],
            LA: ['grew on me', 'facial hair', 'used to hate']
          },
          modelAnswer: {
            SO: 'Script 1: Opinion change - "grew on me" = I started to like it over time. Script 2: Physical growth - facial hair literally grows on your face.',
            LM: 'Idiom literalization - "grew on me" is an idiom for developing fondness, but literally applies to hair growth.',
            SI: 'Personal grooming, facial hair (beard/mustache).',
            TA: 'Self-deprecating - the speaker is the mild target.',
            NS: 'One-liner with past-to-present structure.',
            LA: 'Key phrase: "grew on me" - idiom perfectly matches the literal situation.'
          }
        },
        {
          id: 'gtvh-practice-5',
          joke: "A man walked into a library and asked for books about paranoia. The librarian whispered, 'They're right behind you!'",
          difficulty: 'hard',
          hints: {
            SO: 'Why is "right behind you" scary for a paranoid person?',
            LM: 'The librarian\'s answer works two ways...',
            SI: 'Where does this take place? Who is involved?',
            TA: 'Is anyone being made fun of?',
            NS: 'What format - riddle, story, dialogue?',
            LA: 'Which phrase creates the humour?'
          },
          expectedKeywords: {
            SO: ['location', 'shelf', 'books behind', 'threat', 'danger', 'someone following', 'paranoia', 'fear', 'helpful', 'scary', 'sinister', 'innocent'],
            LM: ['ambiguity', 'double meaning', 'misdirection', 'context', 'helpful', 'threatening', 'irony', 'situational'],
            SI: ['library', 'librarian', 'books', 'shelf', 'whisper', 'quiet'],
            TA: ['paranoid person', 'man', 'customer', 'mental health', 'no target', 'mild'],
            NS: ['narrative', 'story', 'dialogue', 'anecdote', 'walked into'],
            LA: ['right behind you', 'whispered', 'paranoia']
          },
          modelAnswer: {
            SO: 'Script 1: Helpful librarian - "right behind you" = the books are on the shelf behind you. Script 2: Paranoid fear - "right behind you" = someone/something threatening is behind you. The whisper adds to creepy interpretation.',
            LM: 'Ambiguity + situational irony - the helpful phrase sounds threatening given the paranoia context. Whispering amplifies the creepy interpretation.',
            SI: 'Library setting with librarian and customer seeking books.',
            TA: 'Mild target on the paranoid person, but mostly situational irony.',
            NS: 'Short narrative/dialogue format: "A man walked into..."',
            LA: 'Key phrase: "right behind you" + "whispered" creates the double reading.'
          }
        },
        {
          id: 'gtvh-practice-6',
          joke: "My wife told me to stop impersonating a flamingo. I had to put my foot down.",
          difficulty: 'hard',
          hints: {
            SO: 'How do flamingos stand? What does "put foot down" mean?',
            LM: 'An idiom that literally describes the action...',
            SI: 'What is the speaker doing?',
            TA: 'Who is being humorous about themselves?',
            NS: 'Personal anecdote or one-liner?',
            LA: 'Which phrase works perfectly for both meanings?'
          },
          expectedKeywords: {
            SO: ['assertive', 'firm', 'decision', 'authority', 'stop', 'flamingo', 'one leg', 'standing', 'posture', 'literal', 'figurative'],
            LM: ['idiom', 'literal', 'polysemy', 'pun', 'double meaning', 'perfect fit', 'wordplay'],
            SI: ['wife', 'husband', 'couple', 'home', 'flamingo', 'impersonation', 'imitation'],
            TA: ['self', 'speaker', 'husband', 'self-deprecation', 'harmless'],
            NS: ['one-liner', 'anecdote', 'personal', 'dialogue implied'],
            LA: ['put my foot down', 'impersonating', 'flamingo']
          },
          modelAnswer: {
            SO: 'Script 1: Taking authority - "put my foot down" = assert myself, be firm, make a stand. Script 2: Physical action - flamingos stand on one leg, so "putting foot down" = stopping the impersonation by putting the raised leg down.',
            LM: "Idiom literalization with perfect situational match - the idiom exactly describes what you'd physically do to stop impersonating a flamingo.",
            SI: 'Married couple, husband doing flamingo impersonation at home.',
            TA: 'Self-deprecating - the speaker makes fun of their own silly behavior.',
            NS: 'One-liner personal anecdote format.',
            LA: 'Key phrase: "put my foot down" - brilliantly fits both meanings.'
          }
        }
      ],

      // Evaluate student answer against expected keywords
      evaluateAnswer: function(jokeId, kr, studentAnswer) {
        const joke = this.practiceJokes.find(function(j) { return j.id === jokeId; });
        if (!joke) return { score: 0, feedback: 'Joke not found.' };
        
        const expectedKeywords = joke.expectedKeywords[kr];
        const modelAnswer = joke.modelAnswer[kr];
        const answer = studentAnswer.toLowerCase();
        
        // Count matching keywords
        let matchedKeywords = [];
        
        expectedKeywords.forEach(function(keyword) {
          if (answer.includes(keyword.toLowerCase())) {
            matchedKeywords.push(keyword);
          }
        });
        
        // Calculate score
        const score = Math.min(100, Math.round((matchedKeywords.length / Math.min(3, expectedKeywords.length)) * 100));
        
        // Generate feedback based on score
        let feedback = '';
        let feedbackClass = '';
        
        if (score >= 80) {
          feedbackClass = 'excellent';
          feedback = '<strong>Excellent!</strong> You identified the key concepts well.';
          if (matchedKeywords.length > 0) {
            feedback += ' Good recognition of: ' + matchedKeywords.slice(0, 3).join(', ') + '.';
          }
        } else if (score >= 50) {
          feedbackClass = 'good';
          feedback = '<strong>Good attempt!</strong> You\'re on the right track.';
          if (matchedKeywords.length > 0) {
            feedback += ' You identified: ' + matchedKeywords.join(', ') + '.';
          }
          feedback += ' <strong>Consider also:</strong> Look at the model answer below for additional insights.';
        } else if (score >= 20) {
          feedbackClass = 'partial';
          feedback = '<strong>Partial understanding.</strong> You\'ve touched on some ideas.';
          feedback += ' <strong>Hint:</strong> ' + joke.hints[kr];
        } else {
          feedbackClass = 'needs-work';
          feedback = '<strong>Keep trying!</strong> ' + joke.hints[kr];
          feedback += ' Review the theory section and try again, or check the model answer.';
        }
        
        return {
          score: score,
          feedback: feedback,
          feedbackClass: feedbackClass,
          modelAnswer: modelAnswer,
          matchedKeywords: matchedKeywords
        };
      }
    };

    // ========================================
    // RENDER THE INTERACTIVE ANALYZER
    // ========================================
    function renderGTVHAnalyzer(container) {
      container.innerHTML = `
        <div class="gtvh-analyzer">
          <div style="text-align: center; margin-bottom: 30px;">
            <span style="font-size: 3rem;">📝</span>
            <h2>GTVH Interactive Analyzer</h2>
            <p style="color: #64748b;">Analyze jokes using the 6 Knowledge Resources and get instant feedback!</p>
          </div>
          
          <div class="joke-selector" style="margin-bottom: 20px;">
            <label style="font-weight: 600; display: block; margin-bottom: 8px;">Select a joke to analyze:</label>
            <select id="gtvh-joke-select" style="width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem;">
              ${GTVH_ANALYZER.practiceJokes.map(function(joke, i) {
                return '<option value=\"' + joke.id + '\">Joke ' + (i + 1) + ' (' + joke.difficulty + '): \"' + joke.joke.substring(0, 50) + '...\"</option>';
              }).join('')}
            </select>
          </div>
          
          <div id="gtvh-joke-display" class="joke-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px; margin-bottom: 25px;">
            <p style="font-size: 1.2rem; font-style: italic; margin: 0;">"${GTVH_ANALYZER.practiceJokes[0].joke}"</p>
          </div>
          
          <div class="analysis-form">
            <p style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <strong>Instructions:</strong> Analyze this joke using each Knowledge Resource. Write your analysis in the boxes below, then click "Check" to get feedback. Try to identify the key concepts for each KR!
            </p>
            
            ${['SO', 'LM', 'SI', 'TA', 'NS', 'LA'].map(function(kr) {
              return `
                <div class="kr-analysis-box" style="background: white; border: 2px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 15px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4 style="margin: 0; color: #1e293b;">
                      ${kr === 'SO' ? '1. Script Opposition (SO)' : ''}
                      ${kr === 'LM' ? '2. Logical Mechanism (LM)' : ''}
                      ${kr === 'SI' ? '3. Situation (SI)' : ''}
                      ${kr === 'TA' ? '4. Target (TA)' : ''}
                      ${kr === 'NS' ? '5. Narrative Strategy (NS)' : ''}
                      ${kr === 'LA' ? '6. Language (LA)' : ''}
                    </h4>
                    <span class="kr-score" id="score-${kr}" style="font-weight: bold; padding: 5px 12px; border-radius: 20px; font-size: 0.9rem;"></span>
                  </div>
                  <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 10px;">
                    ${kr === 'SO' ? 'What two meanings/scripts clash in this joke?' : ''}
                    ${kr === 'LM' ? 'What technique connects the setup to the punchline?' : ''}
                    ${kr === 'SI' ? 'What is the setting, who are the characters?' : ''}
                    ${kr === 'TA' ? 'Who or what is being mocked (if anyone)?' : ''}
                    ${kr === 'NS' ? 'What format is this joke? (riddle, story, one-liner, etc.)' : ''}
                    ${kr === 'LA' ? 'What specific words/phrases create the humour?' : ''}
                  </p>
                  <textarea id="input-${kr}" placeholder="Type your analysis here..." 
                    style="width: 100%; min-height: 80px; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 1rem; resize: vertical; box-sizing: border-box;"></textarea>
                  <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button type="button" data-action="gtvh-check" data-kr="${kr}" 
                      style="padding: 10px 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                      ? Check
                    </button>
                    <button type="button" data-action="gtvh-hint" data-kr="${kr}" 
                      style="padding: 10px 20px; background: #f1f5f9; color: #475569; border: none; border-radius: 8px; cursor: pointer;">
                      Hint
                    </button>
                    <button type="button" data-action="gtvh-model" data-kr="${kr}" 
                      style="padding: 10px 20px; background: #fef3c7; color: #92400e; border: none; border-radius: 8px; cursor: pointer;">
                      Show Answer
                    </button>
                  </div>
                  <div id="feedback-${kr}" style="margin-top: 15px; display: none;"></div>
                  <div id="model-${kr}" style="margin-top: 10px; display: none; background: #f0fdf4; padding: 15px; border-radius: 8px; border-left: 4px solid #22c55e;"></div>
                </div>
              `;
            }).join('')}
            
            <div style="text-align: center; margin-top: 25px; padding: 20px; background: #f8fafc; border-radius: 12px;">
              <button type="button" data-action="gtvh-check-all" 
                style="padding: 15px 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 1.1rem; font-weight: 600; margin-right: 10px;">
                ? Check All Answers
              </button>
              <button type="button" data-action="gtvh-reset" 
                style="padding: 15px 30px; background: #e2e8f0; color: #475569; border: none; border-radius: 10px; cursor: pointer; font-size: 1.1rem;">
                ? Reset
              </button>
              <div id="overall-score" style="margin-top: 20px; font-size: 1.2rem; display: none;"></div>
            </div>
          </div>
        </div>
      `;
      
      // Add event listener for joke selection
      var selectEl = document.getElementById('gtvh-joke-select');
      if (selectEl) {
        selectEl.addEventListener('change', function() {
          var jokeId = this.value;
          var joke = GTVH_ANALYZER.practiceJokes.find(function(j) { return j.id === jokeId; });
          var jokeDisplay = document.getElementById('gtvh-joke-display');
          if (joke && jokeDisplay) {
            jokeDisplay.innerHTML = '<p style="font-size: 1.2rem; font-style: italic; margin: 0;">\"' + sanitizeHTML(joke.joke) + '\"</p>';
            resetGTVHForm();
          }
        });
      }
    }

    function checkGTVHAnswer(kr) {
      var jokeSelect = document.getElementById('gtvh-joke-select');
      var inputEl = document.getElementById('input-' + kr);
      if (!jokeSelect || !inputEl) return;

      var jokeId = jokeSelect.value;
      var studentAnswer = inputEl.value;
      
      if (!studentAnswer.trim()) {
        alert('Please write your analysis first!');
        return;
      }
      
      var result = GTVH_ANALYZER.evaluateAnswer(jokeId, kr, studentAnswer);
      
      // Show score
      var scoreEl = document.getElementById('score-' + kr);
      if (scoreEl) {
        scoreEl.textContent = result.score + '%';
        scoreEl.style.background = result.score >= 80 ? '#dcfce7' : result.score >= 50 ? '#fef3c7' : '#fee2e2';
        scoreEl.style.color = result.score >= 80 ? '#166534' : result.score >= 50 ? '#92400e' : '#dc2626';
      }
      
      // Show feedback
      var feedbackEl = document.getElementById('feedback-' + kr);
      if (feedbackEl) {
        feedbackEl.textContent = result.feedback;
        feedbackEl.style.display = 'block';
        feedbackEl.style.padding = '15px';
        feedbackEl.style.borderRadius = '8px';
        feedbackEl.style.background = result.score >= 80 ? '#f0fdf4' : result.score >= 50 ? '#fffbeb' : '#fef2f2';
        feedbackEl.style.borderLeft = '4px solid ' + (result.score >= 80 ? '#22c55e' : result.score >= 50 ? '#f59e0b' : '#ef4444');
      }
    }

    function showGTVHHint(kr) {
      var jokeSelect = document.getElementById('gtvh-joke-select');
      if (!jokeSelect) return;
      var joke = GTVH_ANALYZER.practiceJokes.find(function(j) { return j.id === jokeSelect.value; });
      var feedbackEl = document.getElementById('feedback-' + kr);
      if (feedbackEl && joke) {
        feedbackEl.textContent = '💡 Hint: ' + joke.hints[kr];
        feedbackEl.style.display = 'block';
        feedbackEl.style.padding = '15px';
        feedbackEl.style.borderRadius = '8px';
        feedbackEl.style.background = '#e0f2fe';
        feedbackEl.style.borderLeft = '4px solid #3b82f6';
      }
    }

    function showGTVHModel(kr) {
      var jokeSelect = document.getElementById('gtvh-joke-select');
      if (!jokeSelect) return;
      var joke = GTVH_ANALYZER.practiceJokes.find(function(j) { return j.id === jokeSelect.value; });
      var modelEl = document.getElementById('model-' + kr);
      if (modelEl && joke) {
        modelEl.innerHTML = '<strong>Model Answer:</strong><br>' + sanitizeHTML(joke.modelAnswer[kr]);
        modelEl.style.display = 'block';
      }
    }

    function checkAllGTVH() {
      var totalScore = 0;
      var count = 0;
      
      ['SO', 'LM', 'SI', 'TA', 'NS', 'LA'].forEach(function(kr) {
        var input = document.getElementById('input-' + kr);
        if (input && input.value.trim()) {
          checkGTVHAnswer(kr);
          var scoreText = document.getElementById('score-' + kr).textContent;
          if (scoreText) {
            totalScore += parseInt(scoreText, 10);
            count++;
          }
        }
      });
      
      if (count > 0) {
        var avg = Math.round(totalScore / count);
        var overallEl = document.getElementById('overall-score');
        if (overallEl) {
          overallEl.style.display = 'block';
          overallEl.innerHTML = '<strong>Overall Score: ' + avg + '%</strong><br>' +
            '<span style=\"color: #64748b;\">Analyzed ' + count + '/6 Knowledge Resources</span>' +
            (avg >= 80 ? '<br><span style=\"color: #22c55e;\">Excellent analysis!</span>' : '') +
            (avg >= 50 && avg < 80 ? '<br><span style=\"color: #f59e0b;\">Good work! Review the model answers to improve.</span>' : '') +
            (avg < 50 ? '<br><span style=\"color: #ef4444;\">Keep practicing! Use the hints and model answers.</span>' : '');
        }
      }
    }

    function resetGTVHForm() {
      ['SO', 'LM', 'SI', 'TA', 'NS', 'LA'].forEach(function(kr) {
        var input = document.getElementById('input-' + kr);
        var score = document.getElementById('score-' + kr);
        var feedback = document.getElementById('feedback-' + kr);
        var model = document.getElementById('model-' + kr);
        if (input) input.value = '';
        if (score) {
          score.textContent = '';
          score.style.background = 'transparent';
        }
        if (feedback) feedback.style.display = 'none';
        if (model) model.style.display = 'none';
      });
      var overall = document.getElementById('overall-score');
      if (overall) overall.style.display = 'none';
    }

    // Make functions globally available
    window.checkGTVHAnswer = checkGTVHAnswer;
    window.showGTVHHint = showGTVHHint;
    window.showGTVHModel = showGTVHModel;
    window.checkAllGTVH = checkAllGTVH;
    window.resetGTVHForm = resetGTVHForm;
    window.renderGTVHAnalyzer = renderGTVHAnalyzer;
    window.GTVH_ANALYZER = GTVH_ANALYZER;

    // Calculate module mastery based on completed steps
    function calculateModuleMastery(moduleId) {
      var progress = State.moduleMastery.modules[moduleId];
      var score = 0;

      if (progress.preTest.completed) score += 10;
      if (progress.theory.completed) score += 20;

      // Jokes: up to 30 points based on how many analyzed
      var module = LEARNING_SYSTEM.modules.find(function(m) { return m.id === moduleId; });
      if (module) {
        var jokeProgress = progress.jokes.analyzed.length / module.jokeIndices.length;
        score += Math.round(jokeProgress * 30);
      }

      // Activities: up to 20 points
      if (module) {
        var activityProgress = progress.activities.completed.length / module.activityIndices.length;
        score += Math.round(activityProgress * 20);
      }

      if (progress.postTest.completed) score += 15;
      if (progress.reflection.completed) score += 5;

      progress.masteryScore = score;
      return score;
    }

    // Check if module prerequisites are met
    function checkPrerequisites(moduleId) {
      var module = LEARNING_SYSTEM.modules.find(function(m) { return m.id === moduleId; });
      if (!module || module.prerequisites.length === 0) return true;

      return module.prerequisites.every(function(prereqId) {
        var prereqProgress = State.moduleMastery.modules[prereqId];
        return prereqProgress && prereqProgress.completed;
      });
    }

    // Unlock next module if current is complete enough
    function tryUnlockNextModule(currentModuleId) {
      var currentIndex = LEARNING_SYSTEM.modules.findIndex(function(m) { return m.id === currentModuleId; });
      if (currentIndex < 0 || currentIndex >= LEARNING_SYSTEM.modules.length - 1) return;

      var currentProgress = State.moduleMastery.modules[currentModuleId];
      if (currentProgress && currentProgress.completed) {
        // Bug Fix #2: Verify ALL previous modules are completed before unlocking
        var canUnlock = true;
        for (var i = 0; i <= currentIndex; i++) {
          var moduleId = LEARNING_SYSTEM.modules[i].id;
          var moduleProgress = State.moduleMastery.modules[moduleId];
          if (!moduleProgress || !moduleProgress.completed) {
            canUnlock = false;
            console.warn('Cannot unlock next module - Module ' + moduleId + ' not completed');
            break;
          }
        }

        if (canUnlock) {
          var nextModule = LEARNING_SYSTEM.modules[currentIndex + 1];
          State.moduleMastery.modules[nextModule.id].unlocked = true;
          Storage.saveMastery();
          updateModuleProgressUI();
          return nextModule.id;
        }
      }
      return null;
    }

    // Update skill level after practice
    function updateSkillLevel(skillId, correct) {
      if (!State.moduleMastery.skills[skillId]) return;

      var skill = State.moduleMastery.skills[skillId];
      skill.practiced++;
      skill.lastPracticed = new Date().toISOString();

      if (correct) {
        skill.level = Math.min(100, skill.level + 10);
      } else {
        skill.level = Math.min(100, skill.level + 2);
      }

      Storage.saveMastery();
    }

    // Save mastery progress to localStorage
    function saveMastery() {
      try {
        var data = JSON.stringify(State.moduleMastery);

        // Bug Fix #3: Check storage size and warn if approaching limit
        var dataSize = new Blob([data]).size;
        if (dataSize > 4000000) { // ~4MB warning threshold
          console.warn('Progress data approaching storage limit (' + Math.round(dataSize / 1024) + ' KB). Consider using browser sync to access your progress across devices.');
        }

        localStorage.setItem('pragmaticsMastery', data);
      } catch (e) {
        console.error('Failed to save mastery progress:', e);

        // Bug Fix #3: Handle quota exceeded specifically
        if (e.name === 'QuotaExceededError') {
          alert('Storage full! Your progress could not be saved. Please clear browser data or use browser sync to access your progress across devices.');

          // Try to show progress section if available
          if (typeof Navigation !== 'undefined' && Navigation.showSection) {
            setTimeout(function() {
              Navigation.showSection('progress');
              // User can see browser sync instructions
            }, 100);
          }
        }
      }
    }

    // Load mastery progress from localStorage
    function loadMasteryProgress() {
      try {
        var saved = localStorage.getItem('pragmaticsMastery');
        if (saved) {
          var parsed = JSON.parse(saved);
          Object.assign(State.moduleMastery, parsed);
        }
      } catch (e) {
        console.error('Failed to load mastery progress:', e);
      }
    }

    // Edge Case Fix: Cross-browser progress transfer
    // Generate a portable progress code that can be copied to another browser
    function getProgressCode() {
      try {
        // Combine both State.moduleMastery and State.userProgress for complete transfer
        var fullProgress = {
          mastery: State.moduleMastery,
          state: State.userProgress,
          timestamp: new Date().toISOString(),
          version: '1.0'
        };

        var jsonString = JSON.stringify(fullProgress);

        // Simple compression: Base64 encoding (works without external libraries)
        var encoded = btoa(encodeURIComponent(jsonString));

        console.log('Progress code generated (' + Math.round(encoded.length / 1024) + ' KB)');
        return encoded;
      } catch (e) {
        console.error('Failed to generate progress code:', e);
        return null;
      }
    }

    // Restore progress from a code generated in another browser
    function restoreFromCode(code) {
      try {
        if (!code || code.trim() === '') {
          throw new Error('Progress code is empty');
        }

        // Decode from Base64
        var jsonString = decodeURIComponent(atob(code.trim()));
        var fullProgress = JSON.parse(jsonString);

        // Validate version (future-proofing)
        if (!fullProgress.version) {
          throw new Error('Invalid progress code format');
        }

        // Restore both mastery and state
        if (fullProgress.mastery) {
          Object.assign(State.moduleMastery, fullProgress.mastery);
          Storage.saveMastery();
        }

        if (fullProgress.state) {
          Object.assign(State.userProgress, fullProgress.state);
          Storage.save();
        }

        console.log('Progress restored from code (timestamp: ' + fullProgress.timestamp + ')');

        // Refresh UI
        updateModuleProgressUI();
        if (typeof ProgressModule !== 'undefined' && ProgressModule.update) {
          ProgressModule.update();
        }

        return true;
      } catch (e) {
        console.error('Failed to restore progress from code:', e);
        alert('Failed to restore progress: ' + e.message + '\n\nPlease check that you copied the entire code correctly.');
        return false;
      }
    }

    // Expose functions globally for UI access
    window.getProgressCode = getProgressCode;
    window.restoreFromCode = restoreFromCode;

    // ========================================
    // QR BACKUP / RESTORE (optional, opt-in)
    // ========================================
    var qrRestoreScanner = null;
    var qrRestoreApplying = false;
    var MAX_QR_DATA_LENGTH = 2800;
    var QR_REFLECTION_TEXT_LIMIT = 2000;
    var QR_SLIM_MAX_ARRAY_ITEMS = 300;
    var QR_SLIM_NOTE_LIMIT = 1000;
    var QR_SLIM_NOTE_KEYS = 200;
    var QR_SLIM_REFLECTION_TEXT_LIMIT = 1200;

    // Library readiness tracking
    var qrLibrariesReady = false;
    var qrLibraryCheckAttempts = 0;
    var MAX_QR_LIBRARY_CHECK_ATTEMPTS = 10;

    // Check if QR libraries are loaded and ready
    function areQrLibrariesReady() {
        var hasQRious = typeof window.QRious !== 'undefined' && typeof QRious === 'function';
        var hasHtml5Qrcode = typeof Html5QrcodeScanner !== 'undefined' || typeof Html5Qrcode !== 'undefined';
        return hasQRious && hasHtml5Qrcode;
    }

    // Wait for QR libraries to load with exponential backoff
    function waitForQrLibraries(callback, errorCallback) {
        if (areQrLibrariesReady()) {
            qrLibrariesReady = true;
            callback();
            return;
        }

        if (qrLibraryCheckAttempts >= MAX_QR_LIBRARY_CHECK_ATTEMPTS) {
            if (errorCallback) {
                errorCallback('QR libraries failed to load after multiple attempts. Please refresh the page.');
            }
            return;
        }

        qrLibraryCheckAttempts++;
        var delay = Math.min(100 * Math.pow(1.5, qrLibraryCheckAttempts), 2000);

        setTimeout(function() {
            waitForQrLibraries(callback, errorCallback);
        }, delay);
    }

    function truncateStringForQr(str, limit) {
        if (typeof str !== 'string') return str;
        if (!Number.isFinite(limit) || limit <= 0) return str;
        if (str.length <= limit) return str;
        var end = Math.max(0, limit - 3);
        return str.slice(0, end) + '...';
    }

    function serializeProgressForBackup() {
        try {
            var masterySource = (State && State.moduleMastery) ? State.moduleMastery : {};
            var userProgressSource = (State && State.userProgress) ? State.userProgress : {};

            var masteryCopy = (Storage && typeof Storage.validateModuleMastery === 'function')
                ? Storage.validateModuleMastery(masterySource)
                : JSON.parse(JSON.stringify(masterySource));

            var userProgressCopy = (Storage && typeof Storage.validateUserProgress === 'function')
                ? Storage.validateUserProgress(userProgressSource)
                : JSON.parse(JSON.stringify(userProgressSource));

            masteryCopy = clampReflectionResponses(masteryCopy);

            return {
                mastery: masteryCopy,
                userProgress: userProgressCopy
            };
        } catch (err) {
            console.warn('serializeProgressForBackup failed:', err);
            return null;
        }
    }

    function clampReflectionResponses(masteryData) {
        if (!masteryData || !masteryData.modules) return masteryData;
        try {
            Object.keys(masteryData.modules).forEach(function(moduleId) {
                var moduleProgress = masteryData.modules[moduleId];
                if (!moduleProgress || !moduleProgress.reflection || moduleProgress.reflection.responses == null) return;
                var responses = moduleProgress.reflection.responses;

                if (typeof responses === 'string') {
                    if (responses.length > QR_REFLECTION_TEXT_LIMIT) {
                        moduleProgress.reflection.responses = truncateStringForQr(responses, QR_REFLECTION_TEXT_LIMIT);
                    }
                } else if (Array.isArray(responses)) {
                    moduleProgress.reflection.responses = responses.map(function(item) {
                        if (typeof item === 'string' && item.length > QR_REFLECTION_TEXT_LIMIT) {
                            return truncateStringForQr(item, QR_REFLECTION_TEXT_LIMIT);
                        }
                        return item;
                    });
                } else if (responses && typeof responses === 'object') {
                    var safe = {};
                    Object.keys(responses).forEach(function(key) {
                        var value = responses[key];
                        if (typeof value === 'string') {
                            safe[key] = value.length > QR_REFLECTION_TEXT_LIMIT ? truncateStringForQr(value, QR_REFLECTION_TEXT_LIMIT) : value;
                        } else {
                            safe[key] = value;
                        }
                    });
                    moduleProgress.reflection.responses = safe;
                }
            });
        } catch (err) {
            console.warn('clampReflectionResponses failed:', err);
        }
        return masteryData;
    }

    function clampNumberArrayForQr(arr, maxItems, minValue, maxValue) {
        if (!Array.isArray(arr) || !Number.isFinite(maxItems) || maxItems <= 0) return [];
        return arr
            .filter(function(num) {
                return Number.isFinite(num);
            })
            .slice(0, maxItems)
            .map(function(num) {
                var clamped = num;
                if (Number.isFinite(minValue)) clamped = Math.max(minValue, clamped);
                if (Number.isFinite(maxValue)) clamped = Math.min(maxValue, clamped);
                return Math.round(clamped);
            });
    }

    function clampStringArrayForQr(arr, maxItems, maxLength) {
        if (!Array.isArray(arr) || !Number.isFinite(maxItems) || maxItems <= 0) return [];
        return arr
            .filter(function(item) { return typeof item === 'string'; })
            .slice(0, maxItems)
            .map(function(item) {
                if (!Number.isFinite(maxLength) || maxLength <= 0) return item;
                return item.length > maxLength ? item.slice(0, maxLength) : item;
            });
    }

    function clampNotesForQr(notes) {
        var safe = {};
        if (!notes || typeof notes !== 'object') return safe;
        Object.keys(notes).slice(0, QR_SLIM_NOTE_KEYS).forEach(function(key) {
            var value = notes[key];
            if (typeof value !== 'string') return;
            var safeKey = key.slice(0, 64);
            safe[safeKey] = truncateStringForQr(value, QR_SLIM_NOTE_LIMIT);
        });
        return safe;
    }

    function slimReflectionResponsesForQr(responses) {
        if (!responses) return responses;
        if (typeof responses === 'string') {
            return truncateStringForQr(responses, QR_SLIM_REFLECTION_TEXT_LIMIT);
        }
        if (Array.isArray(responses)) {
            return responses.slice(0, QR_SLIM_NOTE_KEYS).map(function(item) {
                return typeof item === 'string' ? truncateStringForQr(item, QR_SLIM_REFLECTION_TEXT_LIMIT) : item;
            });
        }
        if (typeof responses === 'object') {
            var safe = {};
            Object.keys(responses).slice(0, QR_SLIM_NOTE_KEYS).forEach(function(key) {
                var value = responses[key];
                if (typeof value === 'string') {
                    safe[key] = truncateStringForQr(value, QR_SLIM_REFLECTION_TEXT_LIMIT);
                } else {
                    safe[key] = value;
                }
            });
            return safe;
        }
        return responses;
    }

    function buildSlimModuleEntry(moduleId, source) {
        if (!source || typeof source !== 'object') return null;
        var moduleEntry = {};

        if (source.unlocked) moduleEntry.unlocked = true;
        if (source.started) moduleEntry.started = true;
        if (source.completed) moduleEntry.completed = true;

        if (Number.isFinite(source.masteryScore)) {
            moduleEntry.masteryScore = Math.max(0, Math.min(100, Math.round(source.masteryScore)));
        }
        if (source.masteryAchieved === true) {
            moduleEntry.masteryAchieved = true;
        }
        if (Number.isFinite(source.timeSpent) && source.timeSpent > 0) {
            moduleEntry.timeSpent = Math.max(0, Math.round(source.timeSpent));
        }
        if (source.lastAccessed) {
            moduleEntry.lastAccessed = String(source.lastAccessed).slice(0, 64);
        }
        if (Number.isFinite(source.completionDate)) {
            moduleEntry.completionDate = source.completionDate;
        }

        if (source.preTest && (source.preTest.completed || Number.isFinite(source.preTest.score) || (Array.isArray(source.preTest.answers) && source.preTest.answers.length))) {
            moduleEntry.preTest = {
                completed: source.preTest.completed === true,
                score: Number.isFinite(source.preTest.score) ? Math.max(0, Math.min(100, Math.round(source.preTest.score))) : null,
                answers: clampNumberArrayForQr(source.preTest.answers || [], QR_SLIM_MAX_ARRAY_ITEMS, 0, 100)
            };
        }

        if (source.postTest && (source.postTest.completed || Number.isFinite(source.postTest.score) || (Array.isArray(source.postTest.answers) && source.postTest.answers.length))) {
            moduleEntry.postTest = {
                completed: source.postTest.completed === true,
                score: Number.isFinite(source.postTest.score) ? Math.max(0, Math.min(100, Math.round(source.postTest.score))) : null,
                answers: clampNumberArrayForQr(source.postTest.answers || [], QR_SLIM_MAX_ARRAY_ITEMS, 0, 100)
            };
            if (Number.isFinite(source.postTest.completedAt)) {
                moduleEntry.postTest.completedAt = source.postTest.completedAt;
            }
        }

        if (source.theory && (source.theory.completed || (Array.isArray(source.theory.sectionsRead) && source.theory.sectionsRead.length))) {
            moduleEntry.theory = {
                completed: source.theory.completed === true,
                sectionsRead: clampStringArrayForQr(source.theory.sectionsRead || [], QR_SLIM_MAX_ARRAY_ITEMS, 64)
            };
        }

        var jokesHasData = source.jokes && (
            (Array.isArray(source.jokes.analyzed) && source.jokes.analyzed.length) ||
            (source.jokes.notes && Object.keys(source.jokes.notes).length)
        );
        if (jokesHasData) {
            moduleEntry.jokes = {
                analyzed: clampStringArrayForQr(source.jokes.analyzed || [], QR_SLIM_MAX_ARRAY_ITEMS, 64),
                notes: clampNotesForQr(source.jokes.notes || {})
            };
        }

        var activitiesHasData = source.activities && (
            (Array.isArray(source.activities.completed) && source.activities.completed.length) ||
            (source.activities.notes && Object.keys(source.activities.notes).length) ||
            source.activities.completedFlag
        );
        if (activitiesHasData) {
            moduleEntry.activities = {
                completed: clampStringArrayForQr(source.activities.completed || [], QR_SLIM_MAX_ARRAY_ITEMS, 64),
                notes: clampNotesForQr(source.activities.notes || {})
            };
            if (source.activities.completedFlag === true) {
                moduleEntry.activities.completedFlag = true;
            }
        }

        var reflectionHasData = source.reflection && (
            source.reflection.completed ||
            (source.reflection.responses && (
                (typeof source.reflection.responses === 'string' && source.reflection.responses.length > 0) ||
                (Array.isArray(source.reflection.responses) && source.reflection.responses.length > 0) ||
                (typeof source.reflection.responses === 'object' && !Array.isArray(source.reflection.responses) && Object.keys(source.reflection.responses).length > 0)
            ))
        );
        if (reflectionHasData) {
            moduleEntry.reflection = {
                completed: source.reflection.completed === true,
                responses: slimReflectionResponsesForQr(source.reflection.responses)
            };
        }

        if (Object.keys(moduleEntry).length === 0) {
            return null;
        }

        return moduleEntry;
    }

    function buildSlimMasterySnapshot(masteryData) {
        var safe = { placementTest: {}, modules: {} };
        if (!masteryData || typeof masteryData !== 'object') return safe;

        if (masteryData.placementTest && typeof masteryData.placementTest === 'object') {
            var placement = masteryData.placementTest;
            if (placement.completed) safe.placementTest.completed = true;
            if (Number.isFinite(placement.score)) safe.placementTest.score = Math.max(0, Math.min(100, Math.round(placement.score)));
            if (placement.recommendedModule) safe.placementTest.recommendedModule = String(placement.recommendedModule).slice(0, 64);
            if (Number.isFinite(placement.dateTaken)) safe.placementTest.dateTaken = placement.dateTaken;
        }

        var modules = masteryData.modules || {};
        Object.keys(modules).forEach(function(moduleId) {
            var entry = buildSlimModuleEntry(moduleId, modules[moduleId]);
            if (entry) {
                safe.modules[moduleId] = entry;
            }
        });

        return safe;
    }

    function buildSlimUserProgressSnapshot(userProgressData) {
        var safe = {};
        if (!userProgressData || typeof userProgressData !== 'object') return safe;

        var jokesRead = clampNumberArrayForQr(userProgressData.jokesRead || [], QR_SLIM_MAX_ARRAY_ITEMS, 0, 100000);
        if (jokesRead.length) safe.jokesRead = jokesRead;

        var activitiesCompleted = clampStringArrayForQr(userProgressData.activitiesCompleted || [], QR_SLIM_MAX_ARRAY_ITEMS, 64);
        if (activitiesCompleted.length) safe.activitiesCompleted = activitiesCompleted;

        var quizScores = clampNumberArrayForQr(userProgressData.quizScores || [], QR_SLIM_MAX_ARRAY_ITEMS, 0, 100);
        if (quizScores.length) safe.quizScores = quizScores;

        var favoriteJokes = clampNumberArrayForQr(userProgressData.favoriteJokes || [], QR_SLIM_MAX_ARRAY_ITEMS, 0, 100000);
        if (favoriteJokes.length) safe.favoriteJokes = favoriteJokes;

        var jokeNotes = clampNotesForQr(userProgressData.jokeNotes || {});
        if (Object.keys(jokeNotes).length) safe.jokeNotes = jokeNotes;

        var activityNotes = clampNotesForQr(userProgressData.activityNotes || {});
        if (Object.keys(activityNotes).length) safe.activityNotes = activityNotes;

        if (userProgressData.learningPath) {
            safe.learningPath = String(userProgressData.learningPath).slice(0, 64);
        }

        if (userProgressData.onboardingComplete) safe.onboardingComplete = true;
        if (userProgressData.hasVisitedBefore) safe.hasVisitedBefore = true;
        if (userProgressData.placementCompleted) safe.placementCompleted = true;

        if (Number.isFinite(userProgressData.currentJokeIndex)) {
            safe.currentJokeIndex = Math.max(0, Math.round(userProgressData.currentJokeIndex));
        }

        return safe;
    }

    function buildQrPayload() {
        var serialized = serializeProgressForBackup();
        if (!serialized) return null;

        var slimProgress = {
            mastery: buildSlimMasterySnapshot(serialized.mastery || serialized.moduleMastery || {}),
            userProgress: buildSlimUserProgressSnapshot(serialized.userProgress || serialized.state || {})
        };

        var wrapper = {
            v: 1,
            ts: Date.now(),
            progress: slimProgress
        };

        var qrPayload;
        try {
            qrPayload = JSON.stringify(wrapper);
        } catch (err) {
            console.error('[QR Backup] Failed to stringify QR payload:', err);
            return null;
        }

        console.log('[QR Backup] Slim QR payload length =', qrPayload.length);
        return {
            wrapper: wrapper,
            string: qrPayload
        };
    }

    function applyProgressFromBackup(progressObject) {
        if (!progressObject || typeof progressObject !== 'object') {
            return false;
        }

        try {
            var masteryData = progressObject.mastery || progressObject.moduleMastery || null;
            var userProgressData = progressObject.userProgress || progressObject.state || null;

            if (masteryData) {
                if (Storage && typeof Storage.validateModuleMastery === 'function') {
                    masteryData = Storage.validateModuleMastery(masteryData);
                } else {
                    masteryData = JSON.parse(JSON.stringify(masteryData));
                }
                masteryData = clampReflectionResponses(masteryData);
            } else {
                masteryData = null;
            }

            if (userProgressData) {
                if (Storage && typeof Storage.validateUserProgress === 'function') {
                    userProgressData = Storage.validateUserProgress(userProgressData);
                } else {
                    userProgressData = JSON.parse(JSON.stringify(userProgressData));
                }
            } else {
                userProgressData = null;
            }

            if (!masteryData && !userProgressData) {
                console.warn('No progress data found to apply from backup');
                return false;
            }

            if (masteryData) {
                State.moduleMastery = masteryData;
                if (Storage && typeof Storage.saveMastery === 'function') {
                    Storage.saveMastery();
                } else {
                    safeLocalStorageSet('pragmaticsMastery', JSON.stringify(masteryData));
                }
            }

            if (userProgressData) {
                State.userProgress = userProgressData;
                if (Storage && typeof Storage.save === 'function') {
                    Storage.save();
                } else {
                    safeLocalStorageSet('pragmaticsProgress', JSON.stringify(userProgressData));
                }
            }

            if (State && typeof State.initModuleMastery === 'function') {
                State.initModuleMastery();
            }

            if (typeof updateModuleProgressUI === 'function') {
                updateModuleProgressUI();
            }
            if (typeof ProgressModule !== 'undefined' && ProgressModule && typeof ProgressModule.update === 'function') {
                try {
                    ProgressModule.update();
                } catch (progressErr) {
                    console.warn('ProgressModule.update failed (non-blocking):', progressErr);
                }
            }

            return true;
        } catch (err) {
            console.error('applyProgressFromBackup failed:', err);
            return false;
        }
    }

    function validateQrPayload(qrText) {
        if (!qrText) {
            return { ok: false, error: 'QR code is empty.' };
        }

        var wrapper;
        try {
            wrapper = JSON.parse(qrText);
        } catch (parseErr) {
            return { ok: false, error: 'Invalid QR data (not JSON).' };
        }

        if (!wrapper || typeof wrapper !== 'object') {
            return { ok: false, error: 'Invalid QR data structure.' };
        }
        if (wrapper.v !== 1) {
            return { ok: false, error: 'Unsupported QR version.' };
        }
        if (!Number.isFinite(wrapper.ts)) {
            return { ok: false, error: 'Invalid timestamp in QR data.' };
        }

        var now = Date.now();
        var minTs = 946684800000; // Jan 1 2000
        var maxTs = now + (365 * 24 * 60 * 60 * 1000); // 1 year ahead buffer
        if (wrapper.ts < minTs || wrapper.ts > maxTs) {
            return { ok: false, error: 'Timestamp out of range.' };
        }

        if (!wrapper.progress || typeof wrapper.progress !== 'object') {
            return { ok: false, error: 'Missing progress data in QR code.' };
        }

        var rawProgress = wrapper.progress;
        if (Array.isArray(rawProgress)) {
            return { ok: false, error: 'Progress payload must be an object.' };
        }

        var masteryRaw = null;
        if (rawProgress.mastery) {
            masteryRaw = rawProgress.mastery;
        } else if (rawProgress.moduleMastery) {
            masteryRaw = rawProgress.moduleMastery;
        } else if (rawProgress.progress) {
            masteryRaw = rawProgress.progress;
        }

        var userProgressRaw = null;
        if (rawProgress.userProgress) {
            userProgressRaw = rawProgress.userProgress;
        } else if (rawProgress.state) {
            userProgressRaw = rawProgress.state;
        } else if (rawProgress.user) {
            userProgressRaw = rawProgress.user;
        }

        var hasMastery = masteryRaw && typeof masteryRaw === 'object' && !Array.isArray(masteryRaw) && Object.keys(masteryRaw).length > 0;
        var hasUserProgress = userProgressRaw && typeof userProgressRaw === 'object' && !Array.isArray(userProgressRaw) && Object.keys(userProgressRaw).length > 0;

        if (!hasMastery && !hasUserProgress) {
            return { ok: false, error: 'QR code did not contain progress data.' };
        }

        var masteryValidated = null;
        var userValidated = null;

        try {
            if (hasMastery && Storage && typeof Storage.validateModuleMastery === 'function') {
                masteryValidated = Storage.validateModuleMastery(masteryRaw);
            } else if (hasMastery) {
                masteryValidated = JSON.parse(JSON.stringify(masteryRaw));
            }
        } catch (masteryErr) {
            console.warn('Failed to validate mastery from QR:', masteryErr);
            masteryValidated = null;
        }

        try {
            if (hasUserProgress && Storage && typeof Storage.validateUserProgress === 'function') {
                userValidated = Storage.validateUserProgress(userProgressRaw);
            } else if (hasUserProgress) {
                userValidated = JSON.parse(JSON.stringify(userProgressRaw));
            }
        } catch (userErr) {
            console.warn('Failed to validate user progress from QR:', userErr);
            userValidated = null;
        }

        masteryValidated = clampReflectionResponses(masteryValidated);

        if (!masteryValidated && !userValidated) {
            return { ok: false, error: 'No usable progress found in QR code.' };
        }

        return {
            ok: true,
            data: {
                mastery: masteryValidated,
                userProgress: userValidated
            }
        };
    }

    function handleQrRestorePayload(decodedText) {
        var statusNode = document.getElementById('qr-restore-status');
        console.log('[QR Restore] Decoded text length =', decodedText && decodedText.length);

        if (typeof decodedText !== 'string') {
            console.warn('[QR Restore] Expected string payload but received:', typeof decodedText);
            if (statusNode) {
                statusNode.textContent = 'Invalid QR data. Please use a QR code generated by this platform.';
            }
            return false;
        }

        var wrapper;
        try {
            wrapper = JSON.parse(decodedText);
        } catch (e) {
            console.warn('[QR Restore] JSON parse error:', e);
            if (statusNode) {
                statusNode.textContent = 'Invalid QR data. Please use a QR code generated by this platform.';
            }
            return false;
        }

        if (!wrapper || wrapper.v !== 1 || typeof wrapper.ts !== 'number' || !wrapper.progress || typeof wrapper.progress !== 'object') {
            console.warn('[QR Restore] Invalid wrapper structure:', wrapper);
            if (statusNode) {
                statusNode.textContent = 'Invalid QR data. Please use a QR code generated by this platform.';
            }
            return false;
        }

        var validation = (typeof validateQrPayload === 'function')
            ? validateQrPayload(decodedText)
            : { ok: true, data: wrapper.progress };

        if (!validation.ok) {
            console.warn('[QR Restore] Validation failed:', validation.error);
            if (statusNode) {
                statusNode.textContent = 'Invalid QR data. Please use a QR code generated by this platform.';
            }
            return false;
        }

        try {
            var applied = applyProgressFromBackup(validation.data || wrapper.progress);
            if (applied) {
                if (statusNode) {
                    statusNode.textContent = 'Progress restored successfully. You can continue learning from your previous state.';
                }
                console.log('[QR Restore] Progress applied from QR payload.');
                return true;
            } else {
                console.error('[QR Restore] applyProgressFromBackup returned false.');
                if (statusNode) {
                    statusNode.textContent = 'An error occurred while applying the QR progress. Please try again.';
                }
                return false;
            }
        } catch (err) {
            console.error('[QR Restore] Error while applying QR progress:', err);
            if (statusNode) {
                statusNode.textContent = 'An error occurred while applying the QR progress. Please try again.';
            }
            return false;
        }
    }

    function restoreFromPastedJson() {
        var statusNode = document.getElementById('qr-restore-status');
        var textarea = document.getElementById('qr-restore-textarea');
        var text = (textarea && typeof textarea.value === 'string') ? textarea.value.trim() : '';

        if (!text) {
            if (statusNode) {
                statusNode.textContent = 'Please paste backup text.';
            }
            return;
        }

        try {
            var applied = ModuleLearning.handleQrRestorePayload(text);
            if (applied) {
                if (statusNode) {
                    statusNode.textContent = 'Progress restored successfully.';
                }
            } else if (statusNode && !statusNode.textContent) {
                statusNode.textContent = 'Unable to restore from the provided text.';
            }
        } catch (err) {
            console.warn('[QR Restore] Text restore failed:', err);
            if (statusNode) {
                if (err && err.name === 'SyntaxError') {
                    statusNode.textContent = 'Invalid backup text. Please ensure you pasted the full QR backup JSON.';
                } else {
                    statusNode.textContent = 'Could not process the pasted backup. Please try again.';
            }
        }
    }
}

    // Enhanced modal display with backdrop click and escape key
    function showQrModal(modalId) {
        var modal = document.getElementById(modalId);
        if (!modal) return;
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');

        // Add backdrop click handler if not already added
        if (!modal.dataset.backdropBound) {
            modal.dataset.backdropBound = '1';
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    if (modalId === 'qr-backup-modal') {
                        closeQrBackupModal();
                    } else if (modalId === 'qr-restore-modal') {
                        closeQrRestoreModal();
                    }
                }
            });
        }

        // Add escape key handler
        if (!modal.dataset.escapeBound) {
            modal.dataset.escapeBound = '1';
            var escapeHandler = function(e) {
                if (e.key === 'Escape' || e.keyCode === 27) {
                    if (modal.style.display === 'flex') {
                        if (modalId === 'qr-backup-modal') {
                            closeQrBackupModal();
                        } else if (modalId === 'qr-restore-modal') {
                            closeQrRestoreModal();
                        }
                    }
                }
            };
            document.addEventListener('keydown', escapeHandler);
            modal.dataset.escapeHandler = 'bound';
        }

        // Focus trap for accessibility
        setTimeout(function() {
            var focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            }
        }, 100);
    }

    function hideQrModal(modalId) {
        var modal = document.getElementById(modalId);
        if (!modal) return;
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
    }

    // Generate QR code with data - called after libraries are confirmed ready
    function generateQrBackupCode() {
        var modal = document.getElementById('qr-backup-modal');
        var qrContainer = document.getElementById('qr-backup-code');
        var statusNode = document.getElementById('qr-backup-status');

        if (!modal || !qrContainer || !statusNode) {
            console.warn('[QR Backup] Modal elements missing');
            return;
        }

        statusNode.textContent = 'Preparing your QR backup...';
        qrContainer.innerHTML = '';

        var payloadResult = buildQrPayload();
        if (!payloadResult || !payloadResult.wrapper || !payloadResult.string) {
            statusNode.textContent = 'Unable to read your current progress. Please try again.';
            return;
        }

        var payload = payloadResult.wrapper;
        var jsonString = payloadResult.string;

        console.log('[QR Backup] Data length =', jsonString.length, 'bytes (max:', MAX_QR_DATA_LENGTH + ')');

        if (jsonString.length > MAX_QR_DATA_LENGTH) {
            var overBy = jsonString.length - MAX_QR_DATA_LENGTH;
            statusNode.textContent = 'Progress data is too large for QR backup (' + overBy + ' bytes over limit). Try clearing older module attempts or shortening reflection responses.';
            return;
        }

        try {
            qrContainer.innerHTML = '';
            var timestamp = new Date(payload.ts).toLocaleString();

            // Create canvas element for QRious
            var canvas = document.createElement('canvas');
            qrContainer.appendChild(canvas);

            // Generate QR code with QRious (more robust for complex data)
            var qr = new QRious({
                element: canvas,
                value: jsonString,
                size: 260,
                level: 'M'
            });

            statusNode.textContent = 'Scan this QR code on your other device to restore progress. Generated: ' + timestamp;
            console.log('[QR Backup] QR code generated successfully with QRious, data length:', jsonString.length);
        } catch (qrErr) {
            console.error('[QR Backup] Render failed:', qrErr);
            statusNode.textContent = 'Failed to generate QR code. Error: ' + qrErr.message;
        }
    }

    function openQrBackupModal() {
        var modal = document.getElementById('qr-backup-modal');
        var qrContainer = document.getElementById('qr-backup-code');
        var statusNode = document.getElementById('qr-backup-status');

        if (!modal || !qrContainer || !statusNode) {
            console.warn('[QR Backup] Modal elements missing - cannot open');
            alert('QR Backup feature is not available. Please check the console for errors.');
            return;
        }

        // Show modal immediately with loading state
        statusNode.textContent = 'Loading QR library (QRious)...';
        qrContainer.innerHTML = '<div style="padding: 40px; text-align: center; color: #64748b;">Loading...</div>';
        showQrModal('qr-backup-modal');

        // Wait for libraries then generate
        qrLibraryCheckAttempts = 0;
        waitForQrLibraries(
            function() {
                generateQrBackupCode();
            },
            function(errorMsg) {
                statusNode.textContent = errorMsg;
                qrContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Library loading failed. Please refresh the page and try again.</div>';
                console.error('[QR Backup] Library loading failed');
            }
        );
    }

    function stopQrRestoreScanner() {
        if (!qrRestoreScanner) return;

        try {
            if (typeof qrRestoreScanner.stop === 'function') {
                qrRestoreScanner.stop().then(function() {
                    console.log('[QR Restore] Scanner stopped');
                }).catch(function(err) {
                    console.debug('[QR Restore] Stop warning:', err);
                });
            } else if (typeof qrRestoreScanner.clear === 'function') {
                qrRestoreScanner.clear().then(function() {
                    console.log('[QR Restore] Scanner cleared');
                }).catch(function(err) {
                    console.debug('[QR Restore] Clear warning:', err);
                });
            }
        } catch (stopErr) {
            console.warn('[QR Restore] Failed to stop scanner:', stopErr);
        }

        qrRestoreScanner = null;
    }

    function closeQrRestoreModal() {
        stopQrRestoreScanner();
        qrRestoreApplying = false;
        hideQrModal('qr-restore-modal');

        var statusNode = document.getElementById('qr-restore-status');
        if (statusNode) {
            statusNode.textContent = '';
        }

        var reader = document.getElementById('qr-restore-reader');
        if (reader) {
            reader.innerHTML = '';
        }
    }

    function closeQrBackupModal() {
        hideQrModal('qr-backup-modal');
        var qrContainer = document.getElementById('qr-backup-code');
        if (qrContainer) {
            qrContainer.innerHTML = '';
        }
    }

    // Start QR scanner - called after libraries are confirmed ready
    function startQrRestoreScanner() {
        var modal = document.getElementById('qr-restore-modal');
        var reader = document.getElementById('qr-restore-reader');
        var statusNode = document.getElementById('qr-restore-status');

        if (!modal || !reader || !statusNode) {
            console.warn('[QR Restore] Modal elements missing');
            return;
        }

        stopQrRestoreScanner();
        qrRestoreApplying = false;
        reader.innerHTML = '';

        var onScanSuccess = function(decodedText, decodedResult) {
            // Handle both camera and file upload callbacks
            // Camera: decodedText is string
            // File: decodedText might be Event object, actual data in decodedResult
            var actualText = decodedText;

            // If decodedText is not a string, try to extract the actual text
            if (typeof decodedText !== 'string') {
                console.log('[QR Restore] Non-string input received, type:', typeof decodedText);
                console.log('[QR Restore] decodedText:', decodedText);
                console.log('[QR Restore] decodedResult:', decodedResult);

                // Try decodedResult parameter (file upload typically uses this)
                if (decodedResult && typeof decodedResult.decodedText === 'string') {
                    actualText = decodedResult.decodedText;
                    console.log('[QR Restore] Extracted from decodedResult.decodedText');
                }
                // Try decodedText.text property
                else if (decodedText && typeof decodedText.text === 'string') {
                    actualText = decodedText.text;
                    console.log('[QR Restore] Extracted from decodedText.text');
                }
                // Try decodedText.decodedText property
                else if (decodedText && typeof decodedText.decodedText === 'string') {
                    actualText = decodedText.decodedText;
                    console.log('[QR Restore] Extracted from decodedText.decodedText');
                }
                // If it's an Event-like object with target
                else if (decodedText && decodedText.target) {
                    console.error('[QR Restore] Received Event object, cannot extract QR data');
                    statusNode.textContent = 'Failed to read QR code from file. Please try again or use camera.';
                    qrRestoreApplying = false;
                    return;
                }
                // Last resort - try stringifying
                else if (decodedText && typeof decodedText === 'object') {
                    try {
                        actualText = JSON.stringify(decodedText);
                        console.log('[QR Restore] Stringified object as last resort');
                    } catch (e) {
                        console.error('[QR Restore] Could not extract text from object:', decodedText);
                        statusNode.textContent = 'Failed to read QR code data. Please try again.';
                        qrRestoreApplying = false;
                        return;
                    }
                } else {
                    console.error('[QR Restore] Could not extract text, received:', decodedText);
                    statusNode.textContent = 'Failed to read QR code data. Please try again.';
                    qrRestoreApplying = false;
                    return;
                }
            }

            if (qrRestoreApplying) {
                console.log('[QR Restore] Already processing a scan, ignoring duplicate');
                return;
            }

            console.log('[QR Restore] QR code detected, validating...');
            console.log('[QR Restore] Processing decoded text (first 100 chars):', actualText.substring(0, 100));
            stopQrRestoreScanner();
            qrRestoreApplying = true;
            statusNode.textContent = 'QR code detected, validating...';

            var applied = ModuleLearning.handleQrRestorePayload(actualText);
            if (applied) {
                reader.innerHTML = '<div style="padding: 20px; text-align: center; color: #10b981;">Progress restored successfully. You can continue learning from your previous state.</div>';
                console.log('[QR Restore] Progress restored successfully');
                setTimeout(function() {
                    closeQrRestoreModal();
                }, 1500);
            } else {
                reader.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Invalid or unusable QR code. Please try again with a valid backup QR code.</div>';
                qrRestoreApplying = false;
            }
        };

        var onScanError = function(err) {
            // Suppress frequent scanning errors (camera still searching)
            if (err && typeof err === 'string' && err.includes('NotFoundException')) {
                return;
            }
            console.debug('[QR Restore] Scan error:', err);
        };

        statusNode.textContent = 'Point your camera at the QR backup code. Allow camera permissions if prompted.';

        try {
            if (typeof Html5QrcodeScanner !== 'undefined') {
                console.log('[QR Restore] Starting Html5QrcodeScanner');
                qrRestoreScanner = new Html5QrcodeScanner('qr-restore-reader', { fps: 10, qrbox: 250 }, false);
                qrRestoreScanner.render(onScanSuccess, onScanError);
            } else if (typeof Html5Qrcode !== 'undefined') {
                console.log('[QR Restore] Starting Html5Qrcode');
                qrRestoreScanner = new Html5Qrcode('qr-restore-reader');
                qrRestoreScanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: 250 },
                    onScanSuccess,
                    onScanError
                ).catch(function(startErr) {
                    console.error('[QR Restore] Camera start failed:', startErr);
                    var errorMsg = 'Unable to access camera. ';
                    if (startErr.name === 'NotAllowedError') {
                        errorMsg += 'Please allow camera permissions and try again.';
                    } else if (startErr.name === 'NotFoundError') {
                        errorMsg += 'No camera found on this device.';
                    } else {
                        errorMsg += 'Error: ' + startErr.message;
                    }
                    statusNode.textContent = errorMsg;
                    reader.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">' + errorMsg + '</div>';
                });
            }
        } catch (scannerErr) {
            console.error('[QR Restore] Scanner initialization failed:', scannerErr);
            statusNode.textContent = 'Failed to initialize camera. Error: ' + scannerErr.message;
            reader.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Camera initialization failed. Please try again or use a different browser.</div>';
            stopQrRestoreScanner();
        }
    }

    function openQrRestoreModal() {
        var modal = document.getElementById('qr-restore-modal');
        var reader = document.getElementById('qr-restore-reader');
        var statusNode = document.getElementById('qr-restore-status');

        if (!modal || !reader || !statusNode) {
            console.warn('[QR Restore] Modal elements missing');
            return;
        }

        statusNode.textContent = 'Loading scanner...';
        reader.innerHTML = '';
        showQrModal('qr-restore-modal');

        stopQrRestoreScanner();
        qrRestoreApplying = false;

        // Check library availability
        if (typeof Html5Qrcode === 'undefined') {
            statusNode.textContent = 'QR scanner library not available. Please wait for the page to finish loading.';
            return;
        }

        // SUCCESS HANDLER - works for both camera AND file
        var handleQrSuccess = function(decodedText) {
            console.log('[QR Restore] Scan success, raw input:', typeof decodedText, decodedText);

            // Extract actual text if wrapped in object/event
            var actualText = decodedText;
            if (typeof decodedText !== 'string') {
                if (decodedText && decodedText.decodedText) {
                    actualText = decodedText.decodedText;
                } else if (decodedText && decodedText.text) {
                    actualText = decodedText.text;
                } else {
                    console.error('[QR Restore] Cannot extract text from:', decodedText);
                    statusNode.textContent = 'Error: Cannot read QR code data.';
                    return;
                }
            }

            console.log('[QR Restore] Processing text:', actualText.substring(0, 100));

            if (qrRestoreApplying) return;
            qrRestoreApplying = true;

            var applied = ModuleLearning.handleQrRestorePayload(actualText);
            if (applied) {
                setTimeout(function() {
                    closeQrRestoreModal();
                }, 1500);
            } else {
                qrRestoreApplying = false;
            }
        };

        // ERROR HANDLER
        var handleQrError = function(err) {
            // Suppress noisy NotFoundException
            if (err && err.toString && err.toString().indexOf('NotFoundException') === -1) {
                console.debug('[QR Restore] scan error:', err);
            }
        };

        // Create scanner instance
        qrRestoreScanner = new Html5Qrcode('qr-restore-reader');

        // Build custom UI with file upload
        var customUI = document.createElement('div');
        customUI.style.cssText = 'padding: 20px; text-align: center;';
        customUI.innerHTML =
            '<div style="margin-bottom: 20px;">' +
            '  <p style="margin-bottom: 12px; color: var(--text-secondary);">Choose how to scan:</p>' +
            '  <button id="qr-start-camera" class="nav-btn" style="background: #6366f1; color: white; margin: 0 8px; padding: 10px 20px;">📷 Use Camera</button>' +
            '  <button id="qr-choose-file" class="nav-btn" style="background: #10b981; color: white; margin: 0 8px; padding: 10px 20px;">📁 Upload Image</button>' +
            '</div>' +
            '<div id="qr-camera-view" style="display: none; margin-top: 16px; min-height: 200px;"></div>' +
            '<input type="file" id="qr-file-input" accept="image/*" style="display: none;">';

        reader.appendChild(customUI);

        var cameraBtn = document.getElementById('qr-start-camera');
        var fileBtn = document.getElementById('qr-choose-file');
        var fileInput = document.getElementById('qr-file-input');
        var cameraView = document.getElementById('qr-camera-view');

        // CAMERA BUTTON
        if (cameraBtn) {
            cameraBtn.addEventListener('click', function() {
                cameraView.style.display = 'block';
                statusNode.textContent = 'Starting camera...';

                qrRestoreScanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: 250 },
                    handleQrSuccess,
                    handleQrError
                ).then(function() {
                    statusNode.textContent = 'Point camera at QR code.';
                    cameraBtn.disabled = true;
                    cameraBtn.style.opacity = '0.5';
                }).catch(function(err) {
                    console.error('[QR Restore] Camera failed:', err);
                    statusNode.textContent = 'Camera access denied or unavailable.';
                    cameraView.style.display = 'none';
                });
            });
        }

        // FILE BUTTON
        if (fileBtn && fileInput) {
            fileBtn.addEventListener('click', function() {
                fileInput.click();
            });

            fileInput.addEventListener('change', function(event) {
                var file = event.target.files[0];
                if (!file) return;

                statusNode.textContent = 'Reading QR code from image...';

                qrRestoreScanner.scanFile(file, true)
                    .then(function(decodedText) {
                        console.log('[QR Restore] File scan result:', decodedText);
                        handleQrSuccess(decodedText);
                    })
                    .catch(function(err) {
                        console.error('[QR Restore] File scan failed:', err);
                        statusNode.textContent = 'Could not read QR code from image. Make sure it is clear and valid.';
                    });
            });
        }

        statusNode.textContent = 'Choose camera or upload an image.';
    }

    window.openQrBackupModal = openQrBackupModal;
    window.openQrRestoreModal = openQrRestoreModal;

    // Get recommended action for user
    function getNextRecommendedAction() {
      // If placement not done
      if (!State.moduleMastery.placementTest.completed) {
        return {
          type: 'placement',
          message: 'Take the placement test to find your level',
          action: 'Start Placement Test'
        };
      }

      // Find current module (last started but not completed, or recommended)
      for (var i = 0; i < LEARNING_SYSTEM.modules.length; i++) {
        var module = LEARNING_SYSTEM.modules[i];
        var progress = State.moduleMastery.modules[module.id];

        if (progress.unlocked && !progress.completed) {
          // Find next incomplete step
          if (!progress.preTest.completed) {
            return { type: 'module', moduleId: module.id, step: 'preTest', message: 'Start the pre-test for ' + module.title };
          }
          if (!progress.theory.completed) {
            return { type: 'module', moduleId: module.id, step: 'theory', message: 'Learn the theory for ' + module.title };
          }
          if (progress.jokes.analyzed.length < module.jokeIndices.length) {
            return { type: 'module', moduleId: module.id, step: 'jokes', message: 'Analyze examples in ' + module.title };
          }
          if (progress.activities.completed.length < 2) {
            return { type: 'module', moduleId: module.id, step: 'activities', message: 'Complete practice activities in ' + module.title };
          }
          if (!progress.postTest.completed) {
            return { type: 'module', moduleId: module.id, step: 'postTest', message: 'Take the post-test for ' + module.title };
          }
          if (!progress.reflection.completed) {
            return { type: 'module', moduleId: module.id, step: 'reflection', message: 'Complete reflection for ' + module.title };
          }
        }
      }

      return { type: 'complete', message: 'Congratulations! You\'ve completed all modules!' };
    }


    var ModuleModal = {
        state: window.ModuleModal.state,
        focusableElements: [],
        focusTrapHandler: null,
        previouslyFocused: null,
        dialogElement: null,
        overlayElement: null,
        currentView: 'overview',
        currentModule: null,

        show: async function(moduleId) {
            console.log('ModuleModal.show() called with moduleId:', moduleId);

            // Ensure modules are loaded before proceeding
            if (!window.LEARNING_SYSTEM || !Array.isArray(LEARNING_SYSTEM.modules) || LEARNING_SYSTEM.modules.length === 0) {
                console.warn('Module data not loaded yet. Attempting to load now...');
                if (window.DataLoader && window.DataLoader.loadAll) {
                    try {
                        if (!window.DataLoader.isLoaded) {
                            await window.DataLoader.loadAll();
                        }
                    } catch (err) {
                        console.error('Module data failed to load:', err);
                        alert('Module data is still loading. Please try again in a moment.');
                        return;
                    }
                } else {
                    alert('Module data unavailable. Please reload the page.');
                    return;
                }
            }

            var module = LEARNING_SYSTEM.modules.find(function(m) { return m.id === moduleId; });
            if (!module) {
                var availableIds = Array.isArray(LEARNING_SYSTEM.modules)
                    ? LEARNING_SYSTEM.modules.map(function(m) { return m.id; })
                    : [];
                console.error('Module not found in LEARNING_SYSTEM:', moduleId, 'available:', availableIds);
                var message = 'Module "' + moduleId + '" is not available. Please choose another module.';
                if (window.UI && window.UI.toast) {
                    window.UI.toast(message, 'error');
                } else {
                    alert(message);
                }
                Navigation.showSection(moduleId === 'module-learning' ? 'module-learning' : 'guide');
                return;
            }
            console.log('Module found for modal:', module);

            this.currentModule = module;
            if (this.state) this.state.currentModule = module;
            this.currentView = 'overview';
            this.previouslyFocused = document.activeElement;

            var progress = State.moduleMastery.modules[moduleId];
            var masteryPercent = progress ? progress.masteryScore : 0;
            console.log('Progress:', progress, 'Mastery:', masteryPercent + '%');
            var objectives = module.objectives && module.objectives.length ? module.objectives : module.subUnits.map(function(sub) { return sub.focus; });
            var prereqs = (module.prerequisites && module.prerequisites.length) ? module.prerequisites.map(function(pr) {
                var found = LEARNING_SYSTEM.modules.find(function(m) { return m.id === pr; });
                return found ? found.title : pr;
            }) : ['None - start here'];

            // Build sub-units HTML
            var subUnitsHTML = '';
            module.subUnits.forEach(function(sub) {
                subUnitsHTML += '<div style="background:#f9fafb; padding:12px 16px; border-radius:8px; margin-bottom:8px;">' +
                    '<div style="font-weight:600; color:#1f2937;">' + sanitizeHTML(sub.title) + '</div>' +
                    '<div style="font-size:0.85rem; color:#6b7280;">' + sanitizeHTML(sub.focus) + '</div>' +
                    '</div>';
            });

            // Build modal HTML
            var modalHTML = '<div id="module-modal-overlay" role="presentation" aria-hidden="false" tabindex="-1" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); z-index:1000; display:flex; justify-content:center; align-items:center; padding:20px;">' +
                '<div id="module-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="module-modal-title" aria-describedby="module-modal-subtitle" style="background:white; border-radius:20px; max-width:500px; width:100%; max-height:85vh; overflow-y:auto; padding:32px; position:relative; outline:none;">' +

                // Close button
                '<button type="button" aria-label="Close module details" data-action="module-modal-close" style="position:absolute; top:16px; right:16px; background:none; border:none; font-size:24px; cursor:pointer; color:#9ca3af;"><span aria-hidden="true">✕</span></button>' +

                // Header
                '<div style="text-align:center; margin-bottom:24px;">' +
                '<span class="level-badge level-' + module.level.toLowerCase().replace('-', '') + '" style="margin-bottom:12px;">' + sanitizeHTML(module.level) + '</span>' +
                '<h2 id="module-modal-title" style="margin:12px 0 8px; color:#1f2937; font-size:1.5rem;">' + sanitizeHTML(module.title) + '</h2>' +
                '<p id="module-modal-subtitle" style="color:#6b7280; margin:0 0 8px 0;">' + sanitizeHTML(module.subtitle) + '</p>' +
                '<div style="display:inline-block; background:#f0f9ff; color:#1e40af; padding:6px 12px; border-radius:20px; font-size:0.85rem; font-weight:600; border:1px solid #bfdbfe;">⏱ ' + sanitizeHTML(module.estimatedTime) + '</div>' +
                '</div>' +

                // Progress bar
                '<div style="margin-bottom:24px;">' +
                '<div style="display:flex; justify-content:space-between; margin-bottom:8px;">' +
                '<span style="font-size:0.85rem; color:#6b7280;">Your Progress</span>' +
                '<span style="font-size:0.85rem; font-weight:600; color:#6366f1;">' + masteryPercent + '%</span>' +
                '</div>' +
                '<div style="background:#e5e7eb; border-radius:999px; height:8px; overflow:hidden;">' +
                '<div style="background:linear-gradient(90deg, #6366f1, #8b5cf6); height:100%; width:' + masteryPercent + '%; transition:width 0.3s;"></div>' +
                '</div>' +
                '</div>' +

                // Objectives
                '<div style="margin-bottom:16px;">' +
                '<h3 style="font-size:1rem; color:#1f2937; margin-bottom:8px;">Objectives</h3>' +
                '<ul style="color:#4b5563; margin-left:18px;">' + objectives.map(function(obj) { return '<li>' + sanitizeHTML(obj) + '</li>'; }).join('') + '</ul>' +
                '</div>' +

                // Prerequisites
                '<div style="margin-bottom:16px;">' +
                '<h3 style="font-size:1rem; color:#1f2937; margin-bottom:8px;">Prerequisites</h3>' +
                '<div style="display:flex; flex-wrap:wrap; gap:8px;">' +
                    prereqs.map(function(pr) { return '<span style="background:#eef2ff; color:#4338ca; padding:6px 10px; border-radius:999px; font-weight:600;">' + sanitizeHTML(pr) + '</span>'; }).join('') +
                '</div>' +
                '</div>' +

                // Time estimate
                '<div style="display:flex; align-items:center; gap:8px; margin-bottom:20px; padding:12px; background:#f0f9ff; border-radius:8px; border-left:3px solid #3b82f6;">' +
                '<span style="font-weight:600; color:#1e40af;">Time:</span>' +
                '<span style="color:#1e40af; font-weight:500;">' + sanitizeHTML(module.estimatedTime) + '</span>' +
                '</div>' +

                // What you'll learn
                '<h3 style="font-size:1rem; color:#1f2937; margin-bottom:12px;">What You\'ll Learn</h3>' +
                subUnitsHTML +

                // Start button
                '<button type="button" class="module-modal-start-btn" data-action="module-modal-start" data-module-id="' + moduleId + '" style="width:100%; margin-top:24px; padding:14px 24px; background:linear-gradient(135deg, #6366f1, #8b5cf6); color:white; border:none; border-radius:12px; font-size:1rem; font-weight:600; cursor:pointer; transition:transform 0.2s, box-shadow 0.2s;">Start Learning</button>' +

                '</div></div>';

            // Add to body
            var wrapper = document.createElement('div');
            wrapper.innerHTML = modalHTML;
            while (wrapper.firstChild) {
                document.body.appendChild(wrapper.firstChild);
            }
            console.log('Modal HTML added to DOM');

            // Close on overlay click
            var overlay = document.getElementById('module-modal-overlay');
            console.log('Modal overlay element:', overlay);
            overlay.addEventListener('click', function(e) {
                if (e.target === this) ModuleModal.close();
            });
            this.overlayElement = overlay;
            this.dialogElement = document.getElementById('module-modal-dialog');
            this.bindFocusTrap();

            // Close on Escape key
            document.addEventListener('keydown', ModuleModal.handleEscape);
            console.log('ModuleModal.show() complete - modal should be visible');
        },

        bindFocusTrap: function() {
            var dialog = this.dialogElement || document.getElementById('module-modal-dialog');
            if (!dialog) return;
            dialog.setAttribute('tabindex', '-1');
            var focusable = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            this.focusableElements = Array.prototype.filter.call(focusable, function(el) {
                return !el.disabled && el.offsetParent !== null;
            });
            var target = this.focusableElements[0] || dialog;
            target.focus();
            this.focusTrapHandler = this.handleKeydown.bind(this);
            dialog.addEventListener('keydown', this.focusTrapHandler);
        },

        handleKeydown: function(e) {
            if (e.key === 'Tab' && ModuleModal.focusableElements.length) {
                var first = ModuleModal.focusableElements[0];
                var last = ModuleModal.focusableElements[ModuleModal.focusableElements.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                ModuleModal.close();
            }
        },

        close: function() {
            console.log('Closing modal');
            var overlay = document.getElementById('module-modal-overlay');
            console.log('Modal overlay found:', overlay);
            if (overlay) {
                overlay.remove();
                console.log('Modal removed from DOM');
            } else {
                console.log('No modal overlay to remove');
            }
            document.removeEventListener('keydown', ModuleModal.handleEscape);
            if (this.dialogElement && this.focusTrapHandler) {
                this.dialogElement.removeEventListener('keydown', this.focusTrapHandler);
            }
            this.focusableElements = [];
            this.dialogElement = null;
            this.overlayElement = null;
            this.focusTrapHandler = null;
            this.currentModule = null;
            if (this.state) this.state.currentModule = null;
            if (this.previouslyFocused && typeof this.previouslyFocused.focus === 'function') {
                this.previouslyFocused.focus();
            }
        },

        handleEscape: function(e) {
            if (e.key === 'Escape') {
                // If we're in a sub-view, go back to overview instead of closing
                if (ModuleModal.currentView !== 'overview') {
                    ModuleModal.changeView('overview');
                } else {
                    ModuleModal.close();
                }
            }
        },

        changeView: function(viewName) {
            console.log('ModuleModal.changeView() called with view:', viewName);
            this.currentView = viewName;
            this.render();
        },

        render: function() {
            if (!this.dialogElement) {
                console.error('No dialog element to render into');
                return;
            }

            var contentHTML = '';
            if (this.currentView === 'overview') {
                contentHTML = this.getOverviewHTML();
            } else if (this.currentView === 'learning') {
                contentHTML = this.getLearningHTML();
            } else if (this.currentView === 'results') {
                contentHTML = this.getResultsHTML();
            }

            this.dialogElement.innerHTML = contentHTML;

            // Re-bind focus trap after content update
            this.bindFocusTrap();
        },

        getOverviewHTML: function() {
            if (!this.currentModule) return '';

            var module = this.currentModule;
            var moduleId = module.id;
            var progress = State.moduleMastery.modules[moduleId];
            var masteryPercent = progress ? progress.masteryScore : 0;

            var objectives = module.objectives && module.objectives.length ? module.objectives : module.subUnits.map(function(sub) { return sub.focus; });
            var prereqs = (module.prerequisites && module.prerequisites.length) ? module.prerequisites.map(function(pr) {
                var found = LEARNING_SYSTEM.modules.find(function(m) { return m.id === pr; });
                return found ? found.title : pr;
            }) : ['None - start here'];

            var subUnitsHTML = '';
            module.subUnits.forEach(function(sub) {
                subUnitsHTML += '<div style="background:#f9fafb; padding:12px 16px; border-radius:8px; margin-bottom:8px;">' +
                    '<div style="font-weight:600; color:#1f2937;">' + sanitizeHTML(sub.title) + '</div>' +
                    '<div style="font-size:0.85rem; color:#6b7280;">' + sanitizeHTML(sub.focus) + '</div>' +
                    '</div>';
            });

            return '<button type="button" aria-label="Close module details" data-action="module-modal-close" style="position:absolute; top:16px; right:16px; background:none; border:none; font-size:24px; cursor:pointer; color:#9ca3af;"><span aria-hidden="true">×</span></button>' +

                '<div style="text-align:center; margin-bottom:24px;">' +
                '<span class="level-badge level-' + module.level.toLowerCase().replace('-', '') + '" style="margin-bottom:12px;">' + sanitizeHTML(module.level) + '</span>' +
                '<h2 id="module-modal-title" style="margin:12px 0 8px; color:#1f2937; font-size:1.5rem;">' + sanitizeHTML(module.title) + '</h2>' +
                '<p id="module-modal-subtitle" style="color:#6b7280; margin:0;">' + sanitizeHTML(module.subtitle) + '</p>' +
                '</div>' +

                '<div style="margin-bottom:24px;">' +
                '<div style="display:flex; justify-content:space-between; margin-bottom:8px;">' +
                '<span style="font-size:0.85rem; color:#6b7280;">Your Progress</span>' +
                '<span style="font-size:0.85rem; font-weight:600; color:#6366f1;">' + masteryPercent + '%</span>' +
                '</div>' +
                '<div style="background:#e5e7eb; border-radius:999px; height:8px; overflow:hidden;">' +
                '<div style="background:linear-gradient(90deg, #6366f1, #8b5cf6); height:100%; width:' + masteryPercent + '%; transition:width 0.3s;"></div>' +
                '</div>' +
                '</div>' +

                '<div style="margin-bottom:16px;">' +
                '<h3 style="font-size:1rem; color:#1f2937; margin-bottom:8px;">Objectives</h3>' +
                '<ul style="color:#4b5563; margin-left:18px;">' + objectives.map(function(obj) { return '<li>' + sanitizeHTML(obj) + '</li>'; }).join('') + '</ul>' +
                '</div>' +

                '<div style="margin-bottom:16px;">' +
                '<h3 style="font-size:1rem; color:#1f2937; margin-bottom:8px;">Prerequisites</h3>' +
                '<div style="display:flex; flex-wrap:wrap; gap:8px;">' +
                    prereqs.map(function(pr) { return '<span style="background:#eef2ff; color:#4338ca; padding:6px 10px; border-radius:999px; font-weight:600;">' + sanitizeHTML(pr) + '</span>'; }).join('') +
                '</div>' +
                '</div>' +

                '<div style="display:flex; align-items:center; gap:8px; margin-bottom:20px; padding:12px; background:#f0f9ff; border-radius:8px; border-left:3px solid #3b82f6;">' +
                '<span style="font-weight:600; color:#1e40af;">Time:</span>' +
                '<span style="color:#1e40af; font-weight:500;">' + sanitizeHTML(module.estimatedTime) + '</span>' +
                '</div>' +

                '<h3 style="font-size:1rem; color:#1f2937; margin-bottom:12px;">What You\'ll Learn</h3>' +
                subUnitsHTML +

                '<button type="button" class="module-modal-start-btn" data-action="module-modal-start" data-module-id="' + moduleId + '" style="width:100%; margin-top:24px; padding:14px 24px; background:linear-gradient(135deg, #6366f1, #8b5cf6); color:white; border:none; border-radius:12px; font-size:1rem; font-weight:600; cursor:pointer; transition:transform 0.2s, box-shadow 0.2s;">Start Learning</button>';
        },

        getLearningHTML: function() {
            return '<button type="button" aria-label="Back to overview" data-action="module-modal-view" data-view="overview" style="position:absolute; top:16px; left:16px; background:none; border:none; font-size:18px; cursor:pointer; color:#6366f1;">← Back</button>' +
                '<button type="button" aria-label="Close" data-action="module-modal-close" style="position:absolute; top:16px; right:16px; background:none; border:none; font-size:24px; cursor:pointer; color:#9ca3af;">×</button>' +
                '<div style="text-align:center; padding:40px 20px;"><h2 style="color:#1f2937; margin-bottom:16px;">Learning View</h2>' +
                '<p style="color:#6b7280;">This view would contain the learning content, steps, quizzes, etc.</p>' +
                '<p style="color:#6b7280; margin-top:12px;">Currently redirects to the module-learning section.</p></div>';
        },

        getResultsHTML: function() {
            return '<button type="button" aria-label="Back to overview" data-action="module-modal-view" data-view="overview" style="position:absolute; top:16px; left:16px; background:none; border:none; font-size:18px; cursor:pointer; color:#6366f1;">← Back</button>' +
                '<button type="button" aria-label="Close" data-action="module-modal-close" style="position:absolute; top:16px; right:16px; background:none; border:none; font-size:24px; cursor:pointer; color:#9ca3af;">×</button>' +
                '<div style="text-align:center; padding:40px 20px;"><h2 style="color:#1f2937; margin-bottom:16px;">Results View</h2>' +
                '<p style="color:#6b7280;">This view would show quiz/module completion results.</p></div>';
        },

        startModule: function(moduleId) {
            console.log('ModuleModal.startModule called with moduleId:', moduleId);
            // Option 1: Keep modal open and show learning view
            // this.changeView('learning');

            // Option 2: Close modal and navigate to module-learning section (current behavior)
            ModuleModal.close();
            console.log('Modal closed, calling ModuleLearning.start()');
            ModuleLearning.start(moduleId);
        }
    };

    // ========================================
    // MODULE LEARNING
    // ========================================
    var ModuleLearning = {
        currentModule: null,
        currentStep: 0,
        stepConfig: {
            theory: { name: 'Theory', duration: '~5 min', minutes: 5, icon: '📖' },
            jokes: { name: 'Examples', duration: '~4 min', minutes: 4, icon: '💡' },
            activities: { name: 'Practice', duration: '~5 min', minutes: 5, icon: '✍️' },
            postTest: { name: 'Post-Test', duration: '~3 min', minutes: 3, icon: '📝' },
            reflection: { name: 'Reflection', duration: '~2 min', minutes: 2, icon: '🤔' }
        },
        steps: ['theory', 'jokes', 'activities', 'postTest', 'reflection'],
        stepNames: ['Theory', 'Examples', 'Practice', 'Post-Test', 'Reflection'],
        stepDurations: ['~5 min', '~4 min', '~5 min', '~3 min', '~2 min'],
        stepMinutes: [5, 4, 5, 3, 2],
        stepIcons: ['📖', '💡', '✍️', '📝', '🤔'],
        testAnswers: [],
        currentTestType: null,
        masteryThreshold: 80,
        lastScores: { preTest: null, postTest: null },
        currentReflectionMode: 'guided',
        currentReflectionPrompts: [],
        currentReflectionQuickPrompts: [],

        isFoundationalLevel: function(level) {
            var normalized = String(level || '').toUpperCase();
            return normalized.indexOf('A1') !== -1 || normalized.indexOf('A2') !== -1;
        },

        hasPostTest: function(module) {
            return !!(module &&
                module.postTest &&
                Array.isArray(module.postTest.questions) &&
                module.postTest.questions.length > 0);
        },

        buildStepOrderForModule: function(module) {
            var order = ['theory', 'jokes', 'activities'];
            // Always include post-test for all modules
            order.push('postTest');
            order.push('reflection');
            return order;
        },

        syncStepConfigForModule: function(module) {
            this.steps = this.buildStepOrderForModule(module);
            var self = this;
            this.stepNames = [];
            this.stepDurations = [];
            this.stepMinutes = [];
            this.stepIcons = [];

            this.steps.forEach(function(stepId) {
                var meta = self.stepConfig[stepId] || {};
                self.stepNames.push(meta.name || stepId);
                self.stepDurations.push(meta.duration || '~5 min');
                self.stepMinutes.push(typeof meta.minutes === 'number' ? meta.minutes : 0);
                self.stepIcons.push(meta.icon || '•');
            });

            // Log the authoritative step list
            console.log('🔵 ACTIVE stepList for ' + module.id + ':', this.steps);
            console.log('🔵 stepNames:', this.stepNames);
        },

        getReflectionConfig: function(module) {
            var prompts = [];
            if (module && module.reflection && Array.isArray(module.reflection.prompts)) {
                prompts = module.reflection.prompts.filter(function(prompt) {
                    return typeof prompt === 'string' && prompt.trim().length > 0;
                });
            }
            if (prompts.length === 0) {
                prompts = [
                    'What felt most useful in this module?',
                    'Which idea do you want to practice next?'
                ];
            }

            var quickPrompts = [
                {
                    id: 'practice',
                    label: 'What did you practice today?',
                    type: 'multi',
                    options: [
                        'Figurative meaning',
                        'Polite requests',
                        'Being polite',
                        'Culture differences'
                    ]
                },
                {
                    id: 'use',
                    label: 'Where will you use it?',
                    type: 'multi',
                    options: [
                        'Talking with teachers',
                        'Talking with friends',
                        'Emails or messages',
                        'Watching English videos'
                    ]
                },
                {
                    id: 'confidence',
                    label: 'How do you feel now?',
                    type: 'single',
                    options: [
                        'Very confident',
                        'Somewhat confident',
                        'Not sure yet'
                    ]
                }
            ];

            var useCases = [
                { id: 'use-emails', label: 'Writing professional emails' },
                { id: 'use-interviews', label: 'Job interviews' },
                { id: 'use-social', label: 'Social conversations' },
                { id: 'use-media', label: 'Understanding British TV shows' },
                { id: 'use-academic', label: 'Academic writing and presentations' },
                { id: 'use-other', label: 'Other contexts' }
            ];

            return {
                mode: this.isFoundationalLevel(module && module.level) ? 'quick' : 'guided',
                textPrompts: prompts,
                quickPrompts: quickPrompts,
                useCases: useCases
            };
        },

        collectReflectionData: function() {
            var module = this.currentModule;
            var config = this.getReflectionConfig(module);
            var data = {
                mode: config.mode,
                timestamp: new Date().toISOString()
            };

            if (config.mode === 'quick') {
                var selections = {};
                config.quickPrompts.forEach(function(prompt) {
                    selections[prompt.id] = [];
                });

                var inputs = document.querySelectorAll('.reflection-section [data-reflection-group]');
                inputs.forEach(function(input) {
                    var group = input.getAttribute('data-reflection-group');
                    if (!group) return;
                    if (input.type === 'radio') {
                        if (input.checked) {
                            selections[group] = [input.value];
                        }
                        return;
                    }
                    if (input.checked) {
                        selections[group].push(input.value);
                    }
                });

                data.selections = selections;
                return data;
            }

            var responses = [];
            var promptList = Array.isArray(this.currentReflectionPrompts) && this.currentReflectionPrompts.length > 0
                ? this.currentReflectionPrompts
                : config.textPrompts;

            promptList.forEach(function(prompt, idx) {
                var field = document.getElementById('reflection-text-' + idx);
                responses.push({
                    prompt: prompt,
                    response: field ? field.value : ''
                });
            });

            data.textResponses = responses;
            data.useCases = {
                emails: document.getElementById('use-emails') ? document.getElementById('use-emails').checked : false,
                interviews: document.getElementById('use-interviews') ? document.getElementById('use-interviews').checked : false,
                social: document.getElementById('use-social') ? document.getElementById('use-social').checked : false,
                media: document.getElementById('use-media') ? document.getElementById('use-media').checked : false,
                academic: document.getElementById('use-academic') ? document.getElementById('use-academic').checked : false,
                other: document.getElementById('use-other') ? document.getElementById('use-other').checked : false
            };
            data.goal = document.getElementById('reflection-goal') ? document.getElementById('reflection-goal').value : '';

            return data;
        },

        ensureModuleProgress: function(moduleId) {
            if (!State.moduleMastery.modules[moduleId]) {
                State.moduleMastery.modules[moduleId] = {};
            }
            var progress = State.moduleMastery.modules[moduleId];
            progress.unlocked = progress.unlocked === true || moduleId === 'module-1';
            progress.started = !!progress.started;
            progress.completed = !!progress.completed;
            progress.preTest = progress.preTest || { completed: false, score: null, answers: [] };
            progress.theory = progress.theory || { completed: false, sectionsRead: [] };
            progress.jokes = progress.jokes || { analyzed: [], notes: {}, completed: false };
            progress.activities = progress.activities || { completed: [], notes: {}, completedFlag: false };
            progress.postTest = progress.postTest || { completed: false, score: null, answers: [] };
            progress.reflection = progress.reflection || { completed: false, responses: {} };
            progress.masteryScore = typeof progress.masteryScore === 'number' ? progress.masteryScore : 0;
            progress.masteryAchieved = progress.masteryAchieved === true;
            progress.timeSpent = progress.timeSpent || 0;
            progress.lastAccessed = progress.lastAccessed || null;
            progress.completionDate = progress.completionDate || null;
        },

        markStepComplete: function(stepName) {
            var moduleId = this.currentModule ? this.currentModule.id : null;
            if (!moduleId) return;
            this.ensureModuleProgress(moduleId);
            var progress = State.moduleMastery.modules[moduleId];

            switch (stepName) {
                case 'theory':
                    progress.theory.completed = true;
                    break;
                case 'jokes':
                    progress.jokes.completed = true;
                    if (progress.jokes.analyzed.length === 0) {
                        progress.jokes.analyzed.push('completed');
                    }
                    break;
                case 'activities':
                    progress.activities.completedFlag = true;
                    break;
                case 'postTest':
                    progress.postTest.completed = true;
                    if (this.lastScores && this.lastScores.postTest && typeof this.lastScores.postTest.percent === 'number') {
                        progress.postTest.score = this.lastScores.postTest.percent;
                    }
                    break;
                case 'reflection':
                    progress.reflection.completed = true;
                    break;
            }

            Storage.saveMastery();
        },

        updateNextButtonState: function() {
            var nextBtn = document.getElementById('module-next-btn');
            var tooltip = document.getElementById('module-next-tooltip');
            var moduleProgress = this.currentModule ? State.moduleMastery.modules[this.currentModule.id] : null;

            if (!nextBtn || !tooltip) return;

            var step = this.steps[this.currentStep];
            var canProceed = true;
            var tooltipText = '';

            console.log('[updateNextButtonState] current step:', step, 'canProceed initially:', canProceed);

            // Check requirements for each step type
            switch(step) {
                case 'theory':
                    // Theory can always proceed (just reading)
                    canProceed = true;
                    break;

                case 'jokes':
                    // Examples: recommend viewing at least one, but allow skip
                    canProceed = true;
                    break;

                case 'activities':
                    // Practice: allow proceeding to post-test (activities are optional but recommended)
                    canProceed = true;
                    break;

                case 'postTest': {
                    var module = this.currentModule;
                    var questions = (module && module.postTest && Array.isArray(module.postTest.questions))
                        ? module.postTest.questions
                        : [];

                    var answeredCount = Array.isArray(this.testAnswers)
                        ? this.testAnswers.filter(function(ans) {
                            return ans !== null && typeof ans !== 'undefined';
                        }).length
                        : 0;

                    if (questions.length > 0 && answeredCount < questions.length) {
                        canProceed = false;
                        tooltipText = 'Please answer all post-test questions to continue';
                    } else {
                        // Allow proceeding if there are no questions (fallback post-test) or all questions are answered
                        canProceed = true;
                    }

                    console.log('[PostTest gating] questions:', questions.length, 'answered', answeredCount, 'canProceed:', canProceed);
                    break;
                }

                case 'reflection':
                    // Check if reflection has been saved
                    var moduleId = this.currentModule ? this.currentModule.id : null;
                    var moduleProgress = moduleId && State.moduleMastery.modules[moduleId];
                    var reflectionCompleted = moduleProgress && moduleProgress.reflection && moduleProgress.reflection.completed === true;

                    if (!reflectionCompleted) {
                        canProceed = false;
                        tooltipText = 'Please save your reflection before continuing';
                    } else {
                        canProceed = true;
                    }
                    break;
            }

            console.log('[updateNextButtonState] Final canProceed:', canProceed);

            // Update button state
            if (canProceed) {
                nextBtn.disabled = false;
                nextBtn.removeAttribute('disabled');
                nextBtn.setAttribute('aria-disabled', 'false');
                tooltip.textContent = '';
                tooltip.style.display = 'none';
            } else {
                nextBtn.disabled = true;
                nextBtn.setAttribute('disabled', 'disabled');
                nextBtn.setAttribute('aria-disabled', 'true');
                tooltipText = tooltipText || '';
                tooltip.textContent = tooltipText;
                tooltip.style.display = 'block';
            }

            console.log('[updateNextButtonState] step=', step, 'canProceed=', canProceed);
            console.log('[updateNextButtonState] Next button disabled property:', nextBtn.disabled);
            console.log('[updateNextButtonState] Next button disabled attribute:', nextBtn.getAttribute('disabled'));
            console.log('[updateNextButtonState] Next button aria-disabled:', nextBtn.getAttribute('aria-disabled'));
            console.log('[updateNextButtonState] Next button classList:', nextBtn.className);
        },

        renderPreTest: function(container) {
            console.log('renderPreTest() called');
            var module = this.currentModule;
            console.log('Current module:', module);
            console.log('Container:', container);

            var html = '<div style="max-width:700px; margin:0 auto;">';
            html += '<div style="text-align:center; margin-bottom:24px;">';
            html += '<div style="font-size:3rem; margin-bottom:16px;">??</div>';
            html += '<h3 style="margin-bottom:8px;">Pre-Test: What Do You Already Know?</h3>';
            html += '<p style="color:#6b7280;">' + module.preTest.instructions + '</p>';

            // Add encouraging expectation-setting message
            html += '<div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #60a5fa; border-radius: 12px; padding: 16px; margin: 16px auto; text-align: left; max-width: 600px;">';
            html += '<div style="display: flex; gap: 12px; align-items: start;">';
            html += '<div style="font-size: 2rem;">??</div>';
            html += '<div style="color: #1e3a8a;">';
            html += '<strong>Important Reminder:</strong><br>';
            html += '<p style="margin: 8px 0 0 0; font-size: 0.95rem; line-height: 1.5;">This pre-test shows what you know <strong>before learning</strong>. ';
            html += 'Low scores are completely normal and expected! They help us understand where to start. ';
            html += 'There\'s no "passing" or "failing" here—just finding your starting line. 🎯</p>';
            html += '</div></div></div>';

            html += '<div class="progress-bar"><div class="progress-fill" id="module-pretest-progress" style="width:0%">0%</div></div>';
            html += '<div id="module-pretest-result" style="color:#374151; font-weight:600; margin-top:4px;">Answer all questions to see your baseline.</div>';
            html += '</div>';

            this.testAnswers = [];

            module.preTest.questions.forEach(function(q, qIdx) {
                var questionId = 'module-pre-question-' + qIdx;
                html += '<div class="quiz-container" style="margin-bottom:20px;">';
                html += '<div class="quiz-question" id="' + questionId + '">Q' + (qIdx + 1) + ': ' + sanitizeHTML(q.stem) + '</div>';
                html += '<div class="quiz-options" role="radiogroup" aria-labelledby="' + questionId + '">';

                q.options.forEach(function(opt, oIdx) {
                    var tabIndex = oIdx === 0 ? '0' : '-1';
                    html += '<div class="quiz-option" role="radio" aria-checked="false" tabindex="' + tabIndex + '" data-question="' + qIdx + '" data-option="' + oIdx + '">';
                    html += String.fromCharCode(65 + oIdx) + '. ' + sanitizeHTML(opt);
                    html += '</div>';
                });

                html += '</div><div class="quiz-feedback" id="module-pre-feedback-' + qIdx + '" aria-live="polite"></div>';

                html += '</div>';
            });

            html += '</div>';
            container.innerHTML = html;

            // Verify quiz options were created
            var createdOptions = container.querySelectorAll('.quiz-option');
            console.log('renderPreTest() complete. Created', createdOptions.length, 'quiz options');
            console.log('First option element:', createdOptions[0]);
            if (createdOptions[0]) {
                console.log('First option data-question:', createdOptions[0].getAttribute('data-question'));
                console.log('First option data-option:', createdOptions[0].getAttribute('data-option'));
            }

            // Enable interactions
            this.bindQuizOptionEvents(container, 'preTest');
        },

        escapeHTML: function(s) {
            return String(s || '')
                .replaceAll('&', '&amp;')
                .replaceAll('<', '&lt;')
                .replaceAll('>', '&gt;');
        },

        buildTheoryAccordionHTML: function(theorySections) {
            var self = this;
            var clean = (theorySections || [])
                .map(function(section, idx) { return Object.assign({}, section, { _idx: idx }); })
                .filter(function(section) {
                    return section &&
                        String(section.title || '').trim() &&
                        String(section.content || '').trim();
                });

            if (!clean.length) {
                return '<div class="theory-empty">No theory content found for this module.</div>';
            }

            var items = clean.map(function(section, i) {
                var idx = i;
                return (
                    '<div class="accordion-item" data-idx="' + idx + '">' +
                        '<button type="button" class="accordion-header" data-accordion-toggle="module-theory" data-accordion-panel="theory-body-' + idx + '" aria-expanded="false" aria-controls="theory-body-' + idx + '">' +
                            '<span class="accordion-title">' + self.escapeHTML(section.title) + '</span>' +
                            '<span class="accordion-chevron" id="theory-chevron-' + idx + '" aria-hidden="true">▼</span>' +
                        '</button>' +
                        '<div class="accordion-body" id="theory-body-' + idx + '" aria-hidden="true">' +
                            '<div class="theory-content-enhanced">' +
                                section.content +
                            '</div>' +
                        '</div>' +
                    '</div>'
                );
            }).join('');

            return '<div class="theory-accordion">' + items + '</div>';
        },

        pruneEmptyAccordion: function(root) {
            if (!root) return;
            var items = root.querySelectorAll('.accordion-item');
            items.forEach(function(item) {
                var header = item.querySelector('.accordion-header');
                var title = item.querySelector('.accordion-title');
                var body = item.querySelector('.accordion-body');
                var titleText = title && title.textContent ? title.textContent.trim() : '';
                var bodyText = body && body.textContent ? body.textContent.trim() : '';
                var rich = body && body.querySelector('.theory-content-enhanced');
                var richText = rich && rich.textContent ? rich.textContent.trim() : '';
                if (!header || !titleText || (!richText && !bodyText)) {
                    item.remove();
                }
            });
        },

        bindTheoryAccordion: function(root) {
            if (!root) return;
            ensureModuleTheoryAccordionDelegation();
        },

        renderTheory: function(container) {
            var module = this.currentModule;
            var moduleContent = MODULE_THEORY_CONTENT[module.id];

            var html = '<div id="module-content-container">';
            html += '<div style="text-align:center; margin-bottom:20px;">';
            html += '<div style="font-size:3rem; margin-bottom:12px;">🧠</div>';
            html += '<h3 style="margin-bottom:8px;">Theory: Core Concepts</h3>';
            html += '<p style="color:#6b7280;">Take your time - understanding beats speed!</p>';
            html += '</div>';

            html += '<div class="theory-tip">';
            html += '<div class="theory-tip-icon">💡</div>';
            html += '<div class="theory-tip-content">';
            html += '<strong>Learning Tip:</strong>';
            html += '<p>Each section has a simple explanation first, then deeper details. Read the basics, then click "Learn More" if you want full details.</p>';
            html += '</div></div>';

            html += this.buildTheoryAccordionHTML(moduleContent && moduleContent.theorySections);

            html += '<div class="theory-box" style="background: linear-gradient(135deg, #e3f2fd, #bbdefb); border-left: 5px solid var(--success); margin-top: 30px;">';
            html += '<h3 style="text-align: center; color: var(--success);">You\'ve Completed the Core Theory!</h3>';
            html += '<p style="text-align: center; margin-top: 10px;">Now it\'s time to see these concepts in action. Move to the <strong>Joke Collection</strong> or <strong>Activities</strong> to apply what you\'ve learned!</p>';
            html += '</div>';

            html += '</div>';
            container.innerHTML = html;

            // Defensive cleanup: remove empty/broken accordion items
            this.pruneEmptyAccordion(container);

            this.bindTheoryAccordion(container);

            var firstBody = document.getElementById('theory-body-0');
            var firstChevron = document.getElementById('theory-chevron-0');
            var firstHeader = document.querySelector('[aria-controls="theory-body-0"]');

            if (firstBody) {
                firstBody.classList.add('open');
                firstBody.setAttribute('aria-hidden', 'false');
            }
            if (firstChevron) {
                firstChevron.textContent = '▲';
            }
            if (firstHeader) {
                firstHeader.setAttribute('aria-expanded', 'true');
            }

            if (module.id === 'module-6') {
                var analyzerMount = container.querySelector('#gtvh-analyzer-container');
                if (analyzerMount && typeof renderGTVHAnalyzer === 'function') {
                    renderGTVHAnalyzer(analyzerMount);
                }
            }
        },

        toggleTheorySection: function(idx) {
            var body = document.getElementById('theory-body-' + idx);
            var chevron = document.getElementById('theory-chevron-' + idx);
            if (body && chevron) {
                var isOpen = body.classList.contains('open');
                body.classList.toggle('open', !isOpen);
                body.classList.toggle('is-open', !isOpen);
                body.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
                var header = document.querySelector('[aria-controls="theory-body-' + idx + '"]');
                if (header) {
                    header.setAttribute('aria-expanded', (!isOpen).toString());
                }
                chevron.textContent = isOpen ? '▼' : '▲';
            }
        },


        toggleExpandable: function(button) {
            var expandableDetail = button.nextElementSibling;
            if (expandableDetail && expandableDetail.classList.contains('expandable-detail')) {
                var isOpen = expandableDetail.classList.contains('open');
                expandableDetail.classList.toggle('open');

                if (isOpen) {
                    button.innerHTML = '📚 Learn More (Optional)';
                } else {
                    button.innerHTML = '📖 Show Less';
                    // Scroll the expanded content into view smoothly
                    setTimeout(function() {
                        expandableDetail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                }
            }
        },

        toggleLearnMore: function(questionIndex) {
            var learnMoreEl = document.getElementById('learn-more-' + questionIndex);
            var button = event.target;

            if (learnMoreEl) {
                var isHidden = learnMoreEl.style.display === 'none';
                learnMoreEl.style.display = isHidden ? 'block' : 'none';
                button.textContent = isHidden ? '📖 Show Less' : '📚 Learn More';

                if (isHidden) {
                    // Scroll into view
                    setTimeout(function() {
                        learnMoreEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                }
            }
        },

        toggleExampleAnalysis: function(exampleIndex) {
            var analysisEl = document.getElementById('example-analysis-' + exampleIndex);
            var button = event.target;

            if (analysisEl) {
                var isHidden = analysisEl.style.display === 'none';

                if (isHidden) {
                    // Show analysis
                    analysisEl.style.display = 'block';
                    button.innerHTML = '✅ Analysis Shown';
                    button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';

                    // Add a small celebration effect
                    button.style.transform = 'scale(0.98)';
                    setTimeout(function() {
                        button.style.transform = 'scale(1)';
                    }, 150);

                    // Scroll into view
                    setTimeout(function() {
                        analysisEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 200);
                } else {
                    // Hide analysis
                    analysisEl.style.display = 'none';
                    button.innerHTML = '🎭 Analyze This Example';
                    button.style.background = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
                }
            }
        },

        showPostTestResults: function(resultElement, percent, correct, total, questions) {
            // Clear existing content
            resultElement.innerHTML = '';
            resultElement.style.padding = '16px';
            resultElement.style.borderRadius = '12px';
            resultElement.style.marginTop = '16px';
            resultElement.style.lineHeight = '1.6';

            var message = '';
            var bgColor = '';
            var borderColor = '';
            var textColor = '';

            if (percent >= this.masteryThreshold) {
                // Mastery achieved!
                bgColor = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
                borderColor = '#10b981';
                textColor = '#065f46';

                message = '<div style="font-size:1.3em; font-weight:700; margin-bottom:12px;">🏆 Mastery Achieved!</div>';
                message += '<p style="margin-bottom:8px;"><strong>You scored ' + percent + '%</strong> (' + correct + '/' + total + ')</p>';
                message += '<p style="margin-bottom:16px;">Excellent work! You\'ve demonstrated mastery of this module. You\'re ready to move forward!</p>';
                message += '<div style="background:white; padding:12px; border-radius:8px; border-left:4px solid #10b981;">';
                message += '<strong>✨ Next Step:</strong> Continue to the next module or review this one to deepen your understanding.';
                message += '</div>';
            } else {
                // Below mastery threshold - provide detailed breakdown with tiered encouragement
                bgColor = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
                borderColor = '#f59e0b';
                textColor = '#78350f';

                // Tiered encouragement based on score
                var encouragementTitle = '';
                var encouragementMessage = '';

                if (percent >= 70) {
                    // 70-79%: Very close!
                    encouragementTitle = '💪 You\'re Almost There—Just One More Push!';
                    encouragementMessage = 'Great work! You\'re so close to mastery. You need just ' + (this.masteryThreshold - percent) + ' more percentage points!';
                } else if (percent >= 60) {
                    // 60-69%: Good progress
                    encouragementTitle = '🌟 You\'re Learning! Let\'s Build on This Progress!';
                    encouragementMessage = 'You\'re making solid progress! You\'ve grasped the core concepts—now let\'s refine your understanding.';
                } else if (percent >= 50) {
                    // 50-59%: Halfway there
                    encouragementTitle = '🌱 You\'re Halfway There—Keep Growing!';
                    encouragementMessage = 'You\'re building a strong foundation! Every learner progresses at their own pace. Let\'s focus on the areas that need more attention.';
                } else {
                    // Below 50%: Just getting started
                    encouragementTitle = '🎯 You\'re on the Learning Journey—Let\'s Practice Together!';
                    encouragementMessage = 'Learning takes time, and you\'re taking the right steps! Let\'s review the concepts and try again. Every attempt makes you stronger!';
                }

                message = '<div style="font-size:1.2em; font-weight:700; margin-bottom:12px;">' + encouragementTitle + '</div>';
                message += '<p style="margin-bottom:8px;"><strong>You scored ' + percent + '%</strong> (' + correct + '/' + total + ')</p>';
                message += '<p style="margin-bottom:16px;">' + encouragementMessage + ' You need ' + this.masteryThreshold + '% to demonstrate mastery. Let\'s identify what to review:</p>';

                // Analyze which questions were wrong
                var wrongQuestions = [];
                for (var i = 0; i < questions.length; i++) {
                    if (typeof this.testAnswers[i] === 'number' && this.testAnswers[i] !== questions[i].correct) {
                        wrongQuestions.push({
                            number: i + 1,
                            topic: questions[i].topic || 'General concept',
                            question: questions[i].stem
                        });
                    }
                }

                if (wrongQuestions.length > 0) {
                    message += '<div style="background:white; padding:12px; border-radius:8px; margin-bottom:12px;">';
                    message += '<strong style="color:#92400e;">📋 Focus Areas:</strong><br>';
                    message += '<ul style="margin: 8px 0 0 20px; color:#78350f;">';
                    wrongQuestions.forEach(function(q) {
                        message += '<li style="margin-bottom:4px;">Question ' + q.number + ': ' + q.topic + '</li>';
                    });
                    message += '</ul></div>';
                }

                message += '<div style="background:white; padding:12px; border-radius:8px; border-left:4px solid #f59e0b;">';
                message += '<strong style="color:#92400e;">🎯 What to do next:</strong><br>';
                message += '<ol style="margin: 8px 0 0 20px; color:#78350f; line-height:1.8;">';
                message += '<li><strong>Review the Theory section</strong> for concepts you missed (~5 min)</li>';
                message += '<li><strong>Re-analyze the Examples</strong> to see how these concepts work in practice (~3 min)</li>';
                message += '<li><strong>Retake this post-test</strong> (unlimited attempts!) to show your improved understanding</li>';
                message += '</ol></div>';

                // Add peer learning box for common struggles
                message += '<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:12px; margin-top:12px;">';
                message += '<h5 style="color:#991b1b; font-size:0.9em; font-weight:700; margin:0 0 8px 0; display:flex; align-items:center; gap:8px;">👥 You\'re Not Alone!</h5>';
                message += '<p style="color:#7f1d1d; font-size:0.85em; margin:0; line-height:1.6;">';
                if (percent < 50) {
                    message += 'Many learners find pragmatic concepts challenging at first. The most common struggle is understanding the difference between direct and indirect communication. Take your time—breakthroughs often happen on the second or third review!';
                } else if (percent < 70) {
                    message += 'Other learners at your level often struggle with applying politeness strategies in different contexts. This is completely normal! Practice with the examples helps this "click."';
                } else {
                    message += 'You\'re in good company! Many learners score in the 70s on their first attempt. The common challenge at this level is distinguishing subtle implicatures. One more review of the theory usually does the trick!';
                }
                message += '</p></div>';

                message += '<div style="margin-top:12px; text-align:center;">';
                message += '<button type="button" data-action="module-load-step" data-step="0" style="background:#6366f1; color:white; border:none; padding:12px 24px; border-radius:8px; cursor:pointer; font-weight:600; margin-right:8px;">📖 Review Theory</button>';
                message += '<button type="button" data-action="module-load-step" data-step="3" style="background:#10b981; color:white; border:none; padding:12px 24px; border-radius:8px; cursor:pointer; font-weight:600;">🔄 Retake Test</button>';
                message += '</div>';

                message += '<p style="margin-top:16px; text-align:center; font-style:italic; color:#92400e;">You\'ve already learned so much—let\'s get you across the finish line! 🎯</p>';
            }

            // Add benchmarking section
            message += this.generateBenchmarkHTML(percent, correct, total);

            resultElement.innerHTML = message;
            resultElement.style.background = bgColor;
            resultElement.style.border = '2px solid ' + borderColor;
            resultElement.style.color = textColor;
        },

        generateBenchmarkHTML: function(percent, correct, total) {
            // Calculate benchmark statistics
            var preTestScore = this.lastScores.preTest ? this.lastScores.preTest.percent : 0;
            var improvement = percent - preTestScore;

            // Simulated average learner data (in a real app, this would come from a database)
            // These are realistic averages based on educational research
            var avgPostTestScore = 72;
            var avgImprovement = 35;
            var percentile = this.calculatePercentile(percent, avgPostTestScore);

            var html = '<div class="benchmark-container" style="margin-top: 24px;">';
            html += '<div class="benchmark-header">';
            html += '<div class="benchmark-title">📊 How You Compare</div>';
            html += '<div class="benchmark-subtitle">See your progress compared to other learners</div>';
            html += '</div>';

            html += '<div class="benchmark-stats">';

            // Stat 1: Percentile
            html += '<div class="benchmark-stat">';
            html += '<div class="benchmark-stat-value">' + percentile + '%</div>';
            html += '<div class="benchmark-stat-label">Of learners scored lower than you</div>';
            html += '</div>';

            // Stat 2: Improvement
            if (improvement > 0) {
                html += '<div class="benchmark-stat">';
                html += '<div class="benchmark-stat-value">+' + improvement + '%</div>';
                html += '<div class="benchmark-stat-label">Improvement from pre-test</div>';
                html += '</div>';
            }

            // Stat 3: Typical improvement rate
            html += '<div class="benchmark-stat">';
            html += '<div class="benchmark-stat-value">' + avgImprovement + '%</div>';
            html += '<div class="benchmark-stat-label">Average learner improvement</div>';
            html += '</div>';

            html += '</div>';

            // Personalized message based on performance
            var benchmarkMessage = '';
            if (percentile >= 75) {
                benchmarkMessage = '<strong>Outstanding! 🎉</strong> You\'re performing better than most learners at your level. ';
                benchmarkMessage += 'Your dedication is paying off!';
            } else if (percentile >= 50) {
                benchmarkMessage = '<strong>Great work! ✨</strong> You\'re progressing faster than average. ';
                benchmarkMessage += 'Keep up the excellent effort!';
            } else if (percentile >= 25) {
                benchmarkMessage = '<strong>Good progress! 💪</strong> You\'re building your skills steadily. ';
                benchmarkMessage += 'Every learner has their own pace!';
            } else {
                benchmarkMessage = '<strong>You\'re learning! 🌱</strong> Everyone starts somewhere. ';
                benchmarkMessage += 'With practice, you\'ll see significant improvements!';
            }

            if (improvement > avgImprovement) {
                benchmarkMessage += ' Your improvement rate (' + improvement + '%) is above average!';
            }

            html += '<div class="benchmark-message">';
            html += '<p style="margin:0;">' + benchmarkMessage + '</p>';
            html += '</div>';

            html += '</div>';

            return html;
        },

        calculatePercentile: function(score, avgScore) {
            // Simple percentile calculation based on normal distribution
            // In a real app, this would use actual user data
            var stdDev = 15; // Typical standard deviation for test scores
            var zScore = (score - avgScore) / stdDev;

            // Convert z-score to percentile (simplified approximation)
            var percentile = 50 + (zScore * 20);
            percentile = Math.max(5, Math.min(95, Math.round(percentile))); // Clamp between 5-95

            return percentile;
        },

        showPreTestEncouragement: function(resultElement, percent, correct, total) {
            // Clear existing content
            resultElement.innerHTML = '';
            resultElement.style.padding = '16px';
            resultElement.style.borderRadius = '12px';
            resultElement.style.marginTop = '16px';
            resultElement.style.lineHeight = '1.6';

            var message = '';
            var icon = '';
            var bgColor = '';
            var borderColor = '';
            var textColor = '';

            if (percent < 50) {
                // Low score: Encourage growth mindset
                icon = '🌱';
                bgColor = 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)';
                borderColor = '#86efac';
                textColor = '#065f46';
                message = '<div style="font-size:1.2em; font-weight:700; margin-bottom:8px;">' + icon + ' Perfect Starting Point!</div>';
                message += '<p style="margin-bottom:8px;"><strong>You scored ' + percent + '%</strong> (' + correct + '/' + total + ')</p>';
                message += '<p style="margin-bottom:12px;">This is exactly what pre-tests are for! Your score shows you have <strong>room to grow</strong>, which means you\'ll learn a lot from this module. Students who score low on pre-tests often make the biggest improvements!</p>';
                message += '<div style="background:white; padding:12px; border-radius:8px; border-left:4px solid #10b981;">';
                message += '<strong>💪 Remember:</strong> Pre-tests measure where you start, not where you\'ll finish. Let\'s dive in—you\'ve got this!';
                message += '</div>';
            } else if (percent < 70) {
                // Medium score: Build on foundation
                icon = '📚';
                bgColor = 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)';
                borderColor = '#60a5fa';
                textColor = '#1e3a8a';
                message = '<div style="font-size:1.2em; font-weight:700; margin-bottom:8px;">' + icon + ' Great Foundation!</div>';
                message += '<p style="margin-bottom:8px;"><strong>You scored ' + percent + '%</strong> (' + correct + '/' + total + ')</p>';
                message += '<p style="margin-bottom:12px;">You already understand some of this material—nice work! This module will help you <strong>build on what you know</strong> and fill in the gaps. You\'re in a perfect position to make solid progress!</p>';
                message += '<div style="background:white; padding:12px; border-radius:8px; border-left:4px solid #3b82f6;">';
                message += '<strong>⭐ Next Step:</strong> Focus on the areas where you\'re less confident. You\'ll master this!';
                message += '</div>';
            } else {
                // High score: Path to mastery
                icon = '🎯';
                bgColor = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
                borderColor = '#fbbf24';
                textColor = '#78350f';
                message = '<div style="font-size:1.2em; font-weight:700; margin-bottom:8px;">' + icon + ' Impressive Knowledge!</div>';
                message += '<p style="margin-bottom:8px;"><strong>You scored ' + percent + '%</strong> (' + correct + '/' + total + ')</p>';
                message += '<p style="margin-bottom:12px;">Wow! You already understand much of this concept. This module will help you <strong>master it completely</strong> and learn the finer details. You\'re on the path to expertise!</p>';
                message += '<div style="background:white; padding:12px; border-radius:8px; border-left:4px solid #f59e0b;">';
                message += '<strong>🏆 Challenge:</strong> Pay attention to the nuances and advanced examples. You\'re ready for them!';
                message += '</div>';
            }

            resultElement.innerHTML = message;
            resultElement.style.background = bgColor;
            resultElement.style.border = '2px solid ' + borderColor;
            resultElement.style.color = textColor;
        },

        renderJokes: function(container) {
            console.log('🔵 renderJokes called');
            console.log('🔵 currentModule:', this.currentModule);

            var module = this.currentModule;

            // Defensive check: ensure module exists
            if (!module) {
                console.error('❌ CRITICAL: currentModule is null in renderJokes');
                container.innerHTML = '<div style="text-align:center; padding:48px; color:#dc2626;">' +
                    '<h3>⚠️ Error Loading Examples</h3>' +
                    '<p>Module data not found. Please go back and try again.</p>' +
                    '<button type="button" class="btn btn-primary" data-action="nav-section" data-section="guide">Back to Learning Path</button>' +
                    '</div>';
                return;
            }

            var allJokeIndices = [];

            // Defensive check: ensure subUnits exists and is an array
            if (module.subUnits && Array.isArray(module.subUnits)) {
                module.subUnits.forEach(function(sub) {
                    if (sub.jokeIndices && Array.isArray(sub.jokeIndices)) {
                        sub.jokeIndices.forEach(function(idx) {
                            if (allJokeIndices.indexOf(idx) === -1) allJokeIndices.push(idx);
                        });
                    }
                });
            } else {
                console.warn('⚠️ Module ' + module.id + ' has no subUnits, checking for direct jokeIndices');
                // Fallback: check if module has direct jokeIndices property
                if (module.jokeIndices && Array.isArray(module.jokeIndices)) {
                    allJokeIndices = module.jokeIndices.slice();
                    console.log('🔵 Using direct jokeIndices:', allJokeIndices);
                }
            }

            if (allJokeIndices.length === 0) {
                console.warn('⚠️ No examples found for module ' + module.id);
                container.innerHTML = '<div style="text-align:center; padding:48px; color:#f59e0b;">' +
                    '<h3>⚠️ No Examples Available</h3>' +
                    '<p>This module currently has no examples.</p>' +
                    '<button type="button" class="btn btn-primary" data-action="module-next">Continue to Next Step</button>' +
                    '</div>';
                return;
            }
            function normalizeLevel(level) {
                var upper = (level || 'A1').toUpperCase();
                if (upper.indexOf('A1') !== -1) return { label: 'A1', className: 'level-a1' };
                if (upper.indexOf('A2') !== -1) return { label: 'A2', className: 'level-a2' };
                if (upper.indexOf('B2') !== -1) return { label: 'B2', className: 'level-b2' };
                if (upper.indexOf('B1') !== -1) return { label: 'B1', className: 'level-b1' };
                if (upper.indexOf('C1') !== -1) return { label: 'C1', className: 'level-c1' };
                return { label: upper, className: 'level-b1' };
            }

            var html = '<div style="max-width:700px; margin:0 auto;">';
            html += '<div style="text-align:center; margin-bottom:32px;">';
            html += '<div style="font-size:3rem; margin-bottom:16px;">💡</div>';
            html += '<h3 style="margin-bottom:8px;">Examples: See It In Action</h3>';
            html += '<p style="color:#6b7280;">Click "🎭 Analyze This" to actively engage with each example!</p>';
            html += '</div>';

            // Add interactive engagement tip
            html += '<div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #fbbf24; border-radius: 12px; padding: 16px; margin-bottom: 24px;">';
            html += '<div style="display: flex; gap: 12px; align-items: start;">';
            html += '<div style="font-size: 2rem;">🎯</div>';
            html += '<div style="color: #78350f;">';
            html += '<strong>Active Learning Tip:</strong><br>';
            html += '<p style="margin: 8px 0 0 0; font-size: 0.95rem; line-height: 1.5;">';
            html += 'Don\'t just read—<strong>analyze</strong>! For each example, try to figure out the pragmatic meaning BEFORE reading the explanation. ';
            html += 'Active engagement helps you learn faster and remember better! 🧠</p>';
            html += '</div></div></div>';

            allJokeIndices.slice(0, 5).forEach(function(jokeIdx, exampleIndex) {
                var joke = DATA.jokes[jokeIdx];
                if (!joke) return;
                var lvl = normalizeLevel(joke.level);

                html += '<div class="joke-card interactive-example" style="margin-bottom:24px; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; background: white;">';
                html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">';
                html += '<span class="level-badge ' + lvl.className + '">CEFR ' + lvl.label + '</span>';
                html += '<span style="color: #6b7280; font-size: 0.9rem; font-weight: 600;">Example ' + (exampleIndex + 1) + ' of ' + Math.min(5, allJokeIndices.length) + '</span>';
                html += '</div>';

                 html += '<div class="scenario" style="background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); padding: 16px; border-radius: 8px; border-left: 4px solid #6366f1; margin-bottom: 16px;">';
                 html += '<p class="joke-text" style="font-size: 1.05rem; line-height: 1.6; color: #1f2937; margin: 0;">' + sanitizeHTML(joke.text) + '</p>';
                 html += '</div>';

                html += '<div class="analysis-prompt" style="margin-top: 16px;">';
                html += '<button class="analyze-btn" type="button" data-action="module-toggle-example-analysis" data-example-index="' + exampleIndex + '" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; width: 100%; transition: all 0.2s; box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);">';
                html += '🎭 Analyze This Example';
                html += '</button>';

                 html += '<div id="example-analysis-' + exampleIndex + '" class="joke-explanation" style="display: none; margin-top: 16px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 2px solid #86efac; border-radius: 12px; padding: 16px; animation: fadeIn 0.3s ease;">';
                 html += '<h4 style="color: #065f46; margin-bottom: 12px; font-size: 1.1rem;">📚 Pragmatic Analysis:</h4>';
                 html += '<p style="color: #065f46; line-height: 1.7; margin: 0;">' + sanitizeHTML(joke.analysis) + '</p>';

                // Add key takeaway if available
                if (joke.pragmaticConcept || joke.type) {
                    html += '<div style="background: white; padding: 12px; border-radius: 8px; margin-top: 12px; border-left: 4px solid #10b981;">';
                    html += '<strong style="color: #047857;">🔑 Key Concept:</strong><br>';
                     html += '<span style="color: #065f46;">' + sanitizeHTML(joke.pragmaticConcept || joke.type) + '</span>';
                     html += '</div>';
                 }

                html += '</div></div></div>';
            });

            html += '</div>';
            container.innerHTML = html;
        },

        renderActivities: function(container) {
            console.log('🔵 renderActivities called');
            console.log('🔵 currentModule:', this.currentModule);

            var module = this.currentModule;

            // Defensive check: ensure module exists
            if (!module) {
                console.error('❌ CRITICAL: currentModule is null in renderActivities');
                container.innerHTML = '<div style="text-align:center; padding:48px; color:#dc2626;">' +
                    '<h3>⚠️ Error Loading Activities</h3>' +
                    '<p>Module data not found. Please go back and try again.</p>' +
                    '<button type="button" class="btn btn-primary" data-action="nav-section" data-section="guide">Back to Learning Path</button>' +
                    '</div>';
                return;
            }

            console.log('🔵 Module ID:', module.id);
            console.log('🔵 Module has subUnits:', !!module.subUnits);
            console.log('🔵 subUnits:', module.subUnits);

            var allActivityIndices = [];

            // Defensive check: ensure subUnits exists and is an array
            if (module.subUnits && Array.isArray(module.subUnits)) {
                module.subUnits.forEach(function(sub) {
                    if (sub.activityIndices && Array.isArray(sub.activityIndices)) {
                        sub.activityIndices.forEach(function(idx) {
                            if (allActivityIndices.indexOf(idx) === -1) allActivityIndices.push(idx);
                        });
                    }
                });
            } else {
                console.warn('⚠️ Module ' + module.id + ' has no subUnits, checking for direct activityIndices');
                // Fallback: check if module has direct activityIndices property
                if (module.activityIndices && Array.isArray(module.activityIndices)) {
                    allActivityIndices = module.activityIndices.slice();
                    console.log('🔵 Using direct activityIndices:', allActivityIndices);
                }
            }

            console.log('🔵 All activity indices found:', allActivityIndices);

            if (allActivityIndices.length === 0) {
                console.warn('⚠️ No activities found for module ' + module.id);
                container.innerHTML = '<div style="text-align:center; padding:48px; color:#f59e0b;">' +
                    '<h3>⚠️ No Activities Available</h3>' +
                    '<p>This module currently has no practice activities.</p>' +
                    '<button type="button" class="btn btn-primary" data-action="module-next">Continue to Next Step</button>' +
                    '</div>';
                return;
            }

            var html = '<div style="max-width:700px; margin:0 auto;">';
            html += '<div style="text-align:center; margin-bottom:32px;">';
            html += '<div style="font-size:3rem; margin-bottom:16px;">✏️</div>';
            html += '<h3 style="margin-bottom:8px;">Practice: Apply What You Learned</h3>';
            html += '<p style="color:#6b7280;">Complete at least ONE activity to proceed</p>';
            html += '</div>';

            var moduleId = module.id;
            var savedAnswers = this.loadActivityAnswers(moduleId);

            allActivityIndices.slice(0, 4).forEach(function(actIdx) {
                var activity = DATA.activities[actIdx];
                if (!activity) return;
                var lvl = (activity.level || 'A1').toUpperCase();
                var levelClass = 'level-b1';
                if (lvl.indexOf('A1') !== -1) levelClass = 'level-a1';
                else if (lvl.indexOf('A2') !== -1) levelClass = 'level-a2';
                else if (lvl.indexOf('B2') !== -1) levelClass = 'level-b2';
                else if (lvl.indexOf('C1') !== -1) levelClass = 'level-c1';
                var difficultyLabel = (activity.difficulty || 'medium').toUpperCase();

                var activityId = moduleId + '-activity-' + actIdx;
                var savedData = savedAnswers[activityId] || {};
                var savedAnswer = savedData.answer;
                var responseType = activity.responseType || 'text-long';
                var responseLabel = activity.responseLabel || 'Your Response:';
                var responseHint = activity.responseHint || '';
                var exampleAnswer = activity.exampleAnswer || '';
                var isCompleted = savedData.completed || false;
                var savedText = typeof savedAnswer === 'string' ? savedAnswer : '';
                var hasResponse = false;
                if (responseType === 'multi') {
                    hasResponse = Array.isArray(savedAnswer) ? savedAnswer.length > 0 : !!savedAnswer;
                } else if (responseType === 'choice') {
                    hasResponse = !!savedAnswer;
                } else {
                    hasResponse = !!savedText.trim();
                }
                var statusClass = isCompleted ? 'completed' : (hasResponse ? 'attempted' : '');

                html += '<div class="activity-card activity-item ' + statusClass + '" data-activity-id="' + activityId + '" style="margin-bottom:24px; position:relative;">';

                // Completion badge
                if (isCompleted) {
                    html += '<div style="position:absolute; top:16px; right:16px; background:#10b981; color:white; padding:6px 12px; border-radius:20px; font-size:0.85rem; font-weight:600;">✓ Completed</div>';
                }

                html += '<span class="level-badge ' + levelClass + '">CEFR ' + lvl + '</span>';
                html += '<div class="difficulty-stars" aria-label="Difficulty ' + sanitizeHTML(difficultyLabel) + '">' + sanitizeHTML(difficultyLabel) + '</div>';
                html += '<h4>' + sanitizeHTML(activity.title) + '</h4>';
                html += '<p style="color:#6b7280; margin-bottom:4px;"><strong>' + sanitizeHTML(activity.description) + '</strong></p>';
                html += '<p style="background:#f9fafb; padding:12px; border-left:3px solid #6366f1; border-radius:6px; margin:12px 0;"><strong>📝 Task:</strong> ' + sanitizeHTML(activity.task) + '</p>';
                html += '<span class="focus-badge" style="margin-bottom:16px; display:inline-block;">' + sanitizeHTML(activity.pragmaticFocus) + '</span>';

                // Answer input
                html += '<div style="margin-top:16px;">';
                if (responseType === 'choice' || responseType === 'multi') {
                    var choices = activity.choices || [];
                    html += '<div style="display:block; font-weight:600; margin-bottom:8px; color:#374151;">' + sanitizeHTML(responseLabel) + '</div>';
                    if (!choices.length) {
                        html += '<p style="color:#b91c1c;">No choices configured for this activity.</p>';
                    } else {
                        var inputType = responseType === 'multi' ? 'checkbox' : 'radio';
                        var inputName = activityId + '-choice';
                        var savedSelections = [];
                        var savedChoice = '';
                        if (responseType === 'multi') {
                            if (Array.isArray(savedAnswer)) {
                                savedSelections = savedAnswer;
                            } else if (typeof savedAnswer === 'string' && savedAnswer) {
                                savedSelections = [savedAnswer];
                            }
                        } else if (typeof savedAnswer === 'string') {
                            savedChoice = savedAnswer;
                        }
                        choices.forEach(function(choice, choiceIndex) {
                            var inputId = activityId + '-choice-' + choiceIndex;
                            var isChecked = responseType === 'multi'
                                ? savedSelections.indexOf(choice) !== -1
                                : savedChoice === choice;
                            html += '<label for="' + inputId + '" style="display:flex; gap:10px; align-items:flex-start; padding:8px 10px; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:8px; cursor:pointer;">';
                            html += '<input type="' + inputType + '" id="' + inputId + '" name="' + inputName + '" value="' + sanitizeHTML(choice) + '"' + (isChecked ? ' checked' : '') + (isCompleted ? ' disabled' : '') + '>';
                            html += '<span>' + sanitizeHTML(choice) + '</span>';
                            html += '</label>';
                        });
                    }
                } else {
                    var placeholder = activity.placeholder || 'Write your answer here...';
                    html += '<label for="' + activityId + '-answer" style="display:block; font-weight:600; margin-bottom:8px; color:#374151;">' + sanitizeHTML(responseLabel) + '</label>';
                    html += '<textarea id="' + activityId + '-answer" placeholder="' + sanitizeHTML(placeholder) + '" style="width:100%; min-height:120px; padding:12px; border:2px solid #e5e7eb; border-radius:8px; font-family:inherit; font-size:1rem; resize:vertical;" ' + (isCompleted ? 'readonly' : '') + '>' + sanitizeHTML(savedText) + '</textarea>';
                    var wordCount = countWords(savedText);
                    html += '<div id="' + activityId + '-char-count" style="font-size:0.85rem; color:#6b7280; margin-top:4px; text-align:right;">' + wordCount + ' words | ' + savedText.length + ' characters</div>';
                }
                if (responseHint) {
                    html += '<div style="font-size:0.85rem; color:#6b7280; margin-top:6px;">' + sanitizeHTML(responseHint) + '</div>';
                }
                if (exampleAnswer) {
                    html += '<div style="font-size:0.85rem; color:#6b7280; margin-top:6px;"><strong>Example:</strong> ' + sanitizeHTML(exampleAnswer) + '</div>';
                }
                html += '</div>';

                // Feedback area
                html += '<div id="' + activityId + '-feedback" style="margin-top:12px; padding:12px; border-radius:8px; display:none;"></div>';

                // Action buttons
                html += '<div style="margin-top:16px; display:flex; gap:12px; justify-content:flex-end;">';
                if (!isCompleted) {
                    html += '<button type="button" data-action="module-submit-activity" data-module-id="' + moduleId + '" data-activity-index="' + actIdx + '" data-activity-id="' + activityId + '" class="nav-btn" style="padding:10px 24px; background:#6366f1; color:white;">Submit Answer</button>';
                } else {
                    html += '<button type="button" data-action="module-reset-activity" data-module-id="' + moduleId + '" data-activity-id="' + activityId + '" class="nav-btn" style="padding:10px 24px; background:#6b7280; color:white;">Edit Response</button>';
                }
                html += '</div>';

                html += '</div>';
            });

            html += '</div>';
            container.innerHTML = html;

            // Add event listeners for character counting
            allActivityIndices.slice(0, 4).forEach(function(actIdx) {
                var activity = DATA.activities[actIdx];
                if (!activity) return;
                var responseType = activity.responseType || 'text-long';
                if (responseType === 'choice' || responseType === 'multi') return;
                var activityId = moduleId + '-activity-' + actIdx;
                var textarea = document.getElementById(activityId + '-answer');
                if (textarea) {
                    textarea.addEventListener('input', function() {
                        var charCount = document.getElementById(activityId + '-char-count');
                        if (charCount) {
                            charCount.textContent = countWords(this.value) + ' words | ' + this.value.length + ' characters';
                        }
                    });
                }
            });

            // Update next button state
            this.updateNextButtonState();
        },

        loadActivityAnswers: function(moduleId) {
            try {
                var key = 'activity-answers-' + moduleId;
                var saved = safeLocalStorageGet(key, '{}');
                return safeJSONParse(saved, {});
            } catch (e) {
                console.error('Failed to load activity answers:', e);
                return {};
            }
        },

        saveActivityAnswer: function(moduleId, activityId, answer, completed, answerType) {
            try {
                var key = 'activity-answers-' + moduleId;
                var allAnswers = this.loadActivityAnswers(moduleId);
                allAnswers[activityId] = {
                    answer: answer,
                    answerType: answerType || 'text-long',
                    completed: completed,
                    timestamp: new Date().toISOString()
                };
                safeLocalStorageSet(key, JSON.stringify(allAnswers));
                console.log('Saved activity answer for', moduleId, activityId);

                // Sync to mastery structure
                if (State.moduleMastery && State.moduleMastery.modules[moduleId]) {
                    ModuleLearning.ensureModuleProgress(moduleId);
                    var progress = State.moduleMastery.modules[moduleId];
                    if (!Array.isArray(progress.activities.completed)) {
                        progress.activities.completed = [];
                    }
                    if (completed && progress.activities.completed.indexOf(activityId) === -1) {
                        progress.activities.completed.push(activityId);
                    }
                    progress.activities.lastUpdated = new Date().toISOString();
                    progress.activities.completedFlag = progress.activities.completed.length > 0;
                    Storage.saveMastery();
                }
                return true;
            } catch (e) {
                console.error('Failed to save activity answer:', e);
                return false;
            }
        },

        validateActivityAnswer: function(activity, answer) {
            var errors = [];
            var warnings = [];
            var responseType = (activity && activity.responseType) || 'text-long';

            if (responseType === 'choice') {
                if (!answer) {
                    errors.push('Please choose one option.');
                }
                return { valid: errors.length === 0, errors: errors, warnings: warnings, selectionCount: answer ? 1 : 0 };
            }

            if (responseType === 'multi') {
                var selections = Array.isArray(answer) ? answer : (answer ? [answer] : []);
                var minSelections = activity && typeof activity.minSelections === 'number' ? activity.minSelections : 1;
                if (selections.length < minSelections) {
                    errors.push('Please select at least ' + minSelections + ' option' + (minSelections === 1 ? '' : 's') + '.');
                }
                return { valid: errors.length === 0, errors: errors, warnings: warnings, selectionCount: selections.length };
            }

            var text = String(answer || '').trim();
            var allowEmpty = activity && activity.allowEmpty === true;
            if (!text) {
                if (allowEmpty) {
                    return { valid: true, errors: errors, warnings: warnings, wordCount: 0, charCount: 0 };
                }
                errors.push('Please write a short response before submitting.');
                return { valid: false, errors: errors, warnings: warnings };
            }

            var minWords = activity && typeof activity.minWords === 'number'
                ? activity.minWords
                : (responseType === 'text-short' ? 6 : 20);
            var minChars = activity && typeof activity.minChars === 'number'
                ? activity.minChars
                : (responseType === 'text-short' ? 30 : 120);

            if (text.length < minChars) {
                errors.push('Please write at least ' + minChars + ' characters.');
                return { valid: false, errors: errors, warnings: warnings };
            }

            var wordCount = countWords(text);
            if (wordCount < minWords) {
                errors.push('Please write at least ' + minWords + ' words.');
                return { valid: false, errors: errors, warnings: warnings };
            }

            if (text.length > 3000) {
                errors.push('Response too long. Please keep it under 3000 characters.');
                return { valid: false, errors: errors, warnings: warnings };
            }

            if (text.length >= 12) {
                var repetitivePattern = /(.)\1{9,}/;
                if (repetitivePattern.test(text)) {
                    errors.push('Please provide a meaningful response, not repetitive characters.');
                    return { valid: false, errors: errors, warnings: warnings };
                }
            }

            if (text.length >= 15) {
                var nonsensePatterns = [
                    /\b(bla\s*){3,}/i,
                    /\b(lol\s*){3,}/i,
                    /\b(haha\s*){3,}/i,
                    /\b(test\s*){3,}/i,
                    /\b(asdf\s*){2,}/i,
                    /\b(qwer\s*){2,}/i,
                    /\b(xyz\s*){2,}/i
                ];
                for (var i = 0; i < nonsensePatterns.length; i++) {
                    if (nonsensePatterns[i].test(text)) {
                        errors.push('Please provide a thoughtful, meaningful response.');
                        return { valid: false, errors: errors, warnings: warnings };
                    }
                }
            }

            if (wordCount >= 10) {
                var words = text.toLowerCase().trim().split(/\s+/);
                var uniqueWords = {};
                words.forEach(function(word) {
                    uniqueWords[word] = true;
                });
                var uniqueCount = Object.keys(uniqueWords).length;
                if (uniqueCount < 3) {
                    errors.push('Please use a little more varied vocabulary.');
                    return { valid: false, errors: errors, warnings: warnings };
                }
            }

            if (wordCount < minWords + 5) {
                warnings.push('Consider adding a little more detail for extra practice.');
            }

            return {
                valid: true,
                errors: errors,
                warnings: warnings,
                wordCount: wordCount,
                charCount: text.length
            };
        },

        submitActivity: function(moduleId, activityIndex, activityId) {
            var feedbackDiv = document.getElementById(activityId + '-feedback');
            var activity = DATA.activities[activityIndex];

            if (!activity || !feedbackDiv) {
                alert('Error: Activity elements not found');
                return;
            }

            var responseType = activity.responseType || 'text-long';
            var answer = '';
            var textarea = null;

            if (responseType === 'choice') {
                var selected = document.querySelector('input[name="' + activityId + '-choice"]:checked');
                answer = selected ? selected.value : '';
            } else if (responseType === 'multi') {
                var selectedNodes = document.querySelectorAll('input[name="' + activityId + '-choice"]:checked');
                answer = Array.prototype.map.call(selectedNodes, function(node) { return node.value; });
            } else {
                textarea = document.getElementById(activityId + '-answer');
                if (!textarea) {
                    alert('Error: Activity elements not found');
                    return;
                }
                answer = textarea.value.trim();
            }

            var validation = this.validateActivityAnswer(activity, answer);

            if (!validation.valid) {
                feedbackDiv.style.display = 'block';
                feedbackDiv.style.background = '#fee2e2';
                feedbackDiv.style.border = '2px solid #ef4444';
                feedbackDiv.style.color = '#991b1b';
                feedbackDiv.innerHTML = '<strong>Please revise your answer:</strong><ul style="margin:8px 0 0 20px;">' +
                    validation.errors.map(function(err) { return '<li>' + sanitizeHTML(err) + '</li>'; }).join('') +
                    '</ul>';
                return;
            }

            var saved = this.saveActivityAnswer(moduleId, activityId, answer, true, responseType);

            if (!saved) {
                alert('Failed to save your answer. Please try again.');
                return;
            }

            feedbackDiv.style.display = 'block';
            feedbackDiv.style.background = '#d1fae5';
            feedbackDiv.style.border = '2px solid #10b981';
            feedbackDiv.style.color = '#065f46';

            var feedback = '<strong>Excellent work!</strong><br>';
            if (responseType === 'choice') {
                feedback += '<p style="margin:8px 0;">Your choice has been saved.</p>';
            } else if (responseType === 'multi') {
                feedback += '<p style="margin:8px 0;">You selected ' + validation.selectionCount + ' option' + (validation.selectionCount === 1 ? '' : 's') + '.</p>';
            } else {
                feedback += '<p style="margin:8px 0;">Your response has been saved (' + validation.wordCount + ' words, ' + validation.charCount + ' characters).</p>';
            }

            if (validation.warnings.length > 0) {
                feedback += '<p style="margin:8px 0; font-style:italic;">' + sanitizeHTML(validation.warnings.join(' ')) + '</p>';
            }

            feedback += '<p style="margin:8px 0;"><strong>Reflection tip:</strong> Consider how this concept applies to your own communication experiences.</p>';

            feedbackDiv.innerHTML = feedback;

            var activityCard = document.querySelector('.activity-card[data-activity-id="' + activityId + '"]');
            if (activityCard) {
                activityCard.classList.add('completed');
                activityCard.classList.remove('attempted');

                var existingBadge = activityCard.querySelector('[style*="position:absolute"]');
                if (!existingBadge) {
                    var badge = document.createElement('div');
                    badge.style.cssText = 'position:absolute; top:16px; right:16px; background:#10b981; color:white; padding:6px 12px; border-radius:20px; font-size:0.85rem; font-weight:600;';
                    badge.textContent = 'Completed';
                    activityCard.insertBefore(badge, activityCard.firstChild);
                }

                if (responseType === 'choice' || responseType === 'multi') {
                    activityCard.querySelectorAll('input[name="' + activityId + '-choice"]').forEach(function(input) {
                        input.disabled = true;
                    });
                } else if (textarea) {
                    textarea.setAttribute('readonly', 'readonly');
                }

                var submitBtn = activityCard.querySelector('button[data-action="module-submit-activity"]');
                if (submitBtn) {
                    var editBtn = document.createElement('button');
                    editBtn.type = 'button';
                    editBtn.className = 'nav-btn';
                    editBtn.setAttribute('data-action', 'module-reset-activity');
                    editBtn.setAttribute('data-module-id', moduleId);
                    editBtn.setAttribute('data-activity-id', activityId);
                    editBtn.style.cssText = 'padding:10px 24px; background:#6b7280; color:white;';
                    editBtn.textContent = 'Edit Response';
                    submitBtn.replaceWith(editBtn);
                }
            }

            this.updateNextButtonState();

            showAchievementToast('Activity Completed!', 'Great practice work!', 'OK');
        },

        resetActivity: function(moduleId, activityId) {
            if (!confirm('Do you want to edit your response? Your previous answer will be available to modify.')) {
                return;
            }

            var activityCard = document.querySelector('.activity-card[data-activity-id="' + activityId + '"]');
            if (!activityCard) return;

            // Remove completed status
            activityCard.classList.remove('completed');
            activityCard.classList.add('attempted');

            // Remove completion badge
            var badge = activityCard.querySelector('[style*="position:absolute"]');
            if (badge) badge.remove();

            // Enable inputs
            activityCard.querySelectorAll('input[name="' + activityId + '-choice"]').forEach(function(input) {
                input.disabled = false;
            });
            var textarea = activityCard.querySelector('textarea');
            if (textarea) {
                textarea.removeAttribute('readonly');
                textarea.focus();
            }

            // Change button back to submit
            var editBtn = activityCard.querySelector('button[data-action="module-reset-activity"]');
            if (editBtn) {
                var activityIndex = activityId.split('-activity-')[1];
                var submitBtn = document.createElement('button');
                submitBtn.type = 'button';
                submitBtn.className = 'nav-btn';
                submitBtn.setAttribute('data-action', 'module-submit-activity');
                submitBtn.setAttribute('data-module-id', moduleId);
                submitBtn.setAttribute('data-activity-index', activityIndex);
                submitBtn.setAttribute('data-activity-id', activityId);
                submitBtn.style.cssText = 'padding:10px 24px; background:#6366f1; color:white;';
                submitBtn.textContent = 'Submit Answer';
                editBtn.replaceWith(submitBtn);
            }

            // Save as not completed
            var savedAnswers = this.loadActivityAnswers(moduleId);
            if (savedAnswers[activityId]) {
                savedAnswers[activityId].completed = false;
                var key = 'activity-answers-' + moduleId;
                safeLocalStorageSet(key, JSON.stringify(savedAnswers));
            }

            // Hide feedback
            var feedbackDiv = document.getElementById(activityId + '-feedback');
            if (feedbackDiv) {
                feedbackDiv.style.display = 'none';
            }

            // Update next button state
            this.updateNextButtonState();
        },

      renderPostTest: function(container) {
            console.log('Post-Test Rendering Started for module:', this.currentModule ? this.currentModule.id : 'unknown');
            var module = this.currentModule;
            
            if (!module || !module.postTest || !module.postTest.questions || module.postTest.questions.length === 0) {
                console.log('Post-Test: Using fallback (no questions found)');
                // Fallback post-test for modules without questions
                container.innerHTML = '<div style="max-width:700px; margin:0 auto; padding:20px;">' +
                    '<div style="text-align:center; margin-bottom:24px;">' +
                    '<div style="font-size:3rem; margin-bottom:16px;">📝</div>' +
                    '<h3>Post-Test: Module Review</h3>' +
                    '<p style="color:#6b7280;">This module focuses on: ' + (module.subtitle || 'pragmatic language skills') + '</p>' +
                    '</div>' +
                    '<div style="background:#f0f9ff; border:1px solid #bfdbfe; border-radius:10px; padding:20px; margin-bottom:20px;">' +
                    '<h4 style="color:#1e40af; margin-bottom:10px;">What did you learn?</h4>' +
                    '<p style="color:#374151;">Take a moment to reflect on the key concepts from this module:</p>' +
                    '<ul style="color:#374151; margin-left:20px;">' +
                    (module.subUnits ? module.subUnits.map(function(sub) { 
                        return '<li>' + (sub.focus || sub.title) + '</li>'; 
                    }).join('') : '<li>Pragmatic language skills</li>') +
                    '</ul>' +
                    '</div>' +
                    '<div style="text-align:center; color:#6b7280;">' +
                    '<p>Click "Next" to proceed to reflection.</p>' +
                    '</div>' +
                    '</div>';
                return;
            } else {
                console.log('Post-Test: Using regular quiz with', module.postTest.questions.length, 'questions');
            }

            container.style.display = 'block';
            container.style.opacity = '1';

            var html = '<div style="max-width:700px; margin:0 auto;">';
            html += '<div style="text-align:center; margin-bottom:24px;">';
            html += '<div style="font-size:3rem; margin-bottom:16px;">📝</div>';
            html += '<h3>Post-Test: Show What You Learned</h3></div>';

            this.testAnswers = new Array(module.postTest.questions.length).fill(null);

            module.postTest.questions.forEach(function(q, qIdx) {
                var questionText = q.stem || q.question || "Question " + (qIdx + 1);
                html += '<div class="quiz-container" style="margin-bottom:20px; background:white; padding:20px; border-radius:10px; border:1px solid #eee;">';
                html += '<div class="quiz-question" style="font-weight:bold; margin-bottom:10px;">Q' + (qIdx + 1) + ': ' + questionText + '</div>';
                html += '<div class="quiz-options">';
                (q.options || []).forEach(function(opt, oIdx) {
                    html += '<div class="quiz-option" data-question="' + qIdx + '" data-option="' + oIdx + '" style="padding:10px; border:1px solid #ddd; margin-bottom:5px; cursor:pointer; border-radius:5px;">' + opt + '</div>';
                });
                console.log('Post-Test: Added', (q.options || []).length, 'options for question', qIdx);
                html += '</div><div class="quiz-feedback" id="module-post-feedback-' + qIdx + '"></div></div>';
            });

            html += '</div>';
            console.log('Post-Test: Setting container HTML, length:', html.length);
            container.innerHTML = html;
            console.log('Post-Test: Container innerHTML set, container display:', container.style.display, 'opacity:', container.style.opacity);

            if (typeof this.bindQuizOptionEvents === 'function') {
                this.bindQuizOptionEvents(container, 'postTest');
            }
            
            // Update next button state for post-test (to disable if questions need answering)
            this.updateNextButtonState();
        }
    }; // <--- THIS CLOSES THE ModuleLearning OBJECT
    window.ModuleLearning = ModuleLearning;
    window.ModuleModal = ModuleModal;

    // Stable entry point for opening modules
    ModuleLearning.openModule = function (moduleId) {
        console.log('[ModuleLearning.openModule] called with:', moduleId);
        return ModuleLearning.start(moduleId);
    };

    console.log('🚀 Module system fully exported and ready.');

    Object.assign(ModuleLearning, {
        start: function(moduleId) {
            console.log('[ModuleLearning.start] called with moduleId:', moduleId);
            
            // Find the module
            var module = LEARNING_SYSTEM.modules.find(function(m) { return m.id === moduleId; });
            if (!module) {
                console.error('Module not found:', moduleId);
                alert('Module not found: ' + moduleId);
                return;
            }
            
            // Set current module
            this.currentModule = module;

            // Reset completion flags for retake
            var moduleId = module.id;
            if (State.moduleMastery.modules[moduleId]) {
                State.moduleMastery.modules[moduleId].postTest = { completed: false, score: null, answers: [] };
                State.moduleMastery.modules[moduleId].reflection = { completed: false, responses: {} };
                Storage.saveMastery();
            }

            this.currentStep = 0;
            this.testAnswers = [];
            this.currentTestType = null;
            
            // Sync step configuration for this module
            this.syncStepConfigForModule(module);
            
            // Navigate to module-learning section
            if (window.Navigation && typeof Navigation.showSection === 'function') {
                Navigation.showSection('module-learning');
            }
            
            // Load the first step
            this.loadStep(0);
            
            console.log('[ModuleLearning.start] Module initialized:', moduleId);
        },

        loadStep: function(stepIndex) {
            console.log('[ModuleLearning.loadStep] Loading step:', stepIndex, 'of', this.steps.length);
            
            if (!this.currentModule) {
                console.error('No current module set');
                return;
            }
            
            if (stepIndex < 0 || stepIndex >= this.steps.length) {
                console.error('Invalid step index:', stepIndex);
                return;
            }
            
            this.currentStep = stepIndex;
            var stepName = this.steps[stepIndex];
            console.log('Loading step:', stepName, 'at index:', stepIndex);
            
            // Update step indicators
            if (typeof this.updateStepIndicators === 'function') {
                this.updateStepIndicators();
            }
            
            // Get the content container
            var container = document.getElementById('module-step-content');
            if (!container) {
                console.error('module-step-content container not found');
                return;
            }
            
            // Clear previous content
            container.innerHTML = '';
            
            // Render the step content
            switch (stepName) {
                case 'theory':
                    this.renderTheory(container);
                    break;
                case 'jokes':
                    this.renderJokes(container);
                    break;
                case 'activities':
                    this.renderActivities(container);
                    break;
                case 'postTest':
                    console.log('loadStep: Calling renderPostTest for step', stepIndex);
                    this.renderPostTest(container);
                    break;
                case 'reflection':
                    this.renderReflection(container);
                    break;
                default:
                    container.innerHTML = '<div style="text-align:center; padding:40px;"><h3>Unknown Step</h3><p>Step not found: ' + stepName + '</p></div>';
            }
            
            // Update navigation buttons
            this.updateNavigationButtons();
            
            console.log('[ModuleLearning.loadStep] Step loaded:', stepName);
        },

        updateStepIndicators: function() {
            // Update compact steps
            var compactSteps = document.querySelectorAll('.compact-step');
            compactSteps.forEach(function(step, index) {
                step.classList.remove('active', 'completed');
                if (index < this.currentStep) {
                    step.classList.add('completed');
                } else if (index === this.currentStep) {
                    step.classList.add('active');
                }
            }.bind(this));
            
            // Update enhanced step text
            var stepText = document.getElementById('enhanced-step-text');
            if (stepText && this.stepNames && this.stepNames[this.currentStep]) {
                stepText.textContent = 'Step ' + (this.currentStep + 1) + ' of ' + this.stepNames.length + ': ' + this.stepNames[this.currentStep];
            }
            
            // Update progress bar
            var progressFill = document.getElementById('enhanced-progress-fill');
            var percentageText = document.getElementById('enhanced-percentage-text');
            if (progressFill && percentageText && this.steps) {
                var percentage = Math.round(((this.currentStep + 1) / this.steps.length) * 100);
                progressFill.style.width = percentage + '%';
                percentageText.textContent = percentage + '%';
            }
        },

        updateNavigationButtons: function() {
            // Ensure nav buttons container is visible (fixes issue for modules 3-6)
            var navContainer = document.getElementById('module-nav-buttons');
            if (navContainer) {
                navContainer.style.display = 'flex';
            }

            var prevBtn = document.getElementById('module-prev-btn');
            var nextBtn = document.getElementById('module-next-btn');

            if (prevBtn) {
                prevBtn.style.display = this.currentStep > 0 ? 'inline-block' : 'none';
            }

            if (nextBtn) {
                // Always show the Next button - it changes to "Complete Module" on last step
                nextBtn.style.display = 'inline-block';
                nextBtn.style.visibility = 'visible';  // Ensure visibility
                nextBtn.style.opacity = '1';  // Ensure opacity

                // Update button text based on current step
                if (this.currentStep === this.steps.length - 1) {
                    nextBtn.textContent = 'Complete Module ✓';
                } else {
                    nextBtn.textContent = 'Next: ' + this.stepNames[this.currentStep + 1];
                }
            }
        },

        renderReflection: function(container) {
            var module = this.currentModule;
            var config = this.getReflectionConfig(module);
            this.currentReflectionMode = config.mode;
            this.currentReflectionPrompts = config.textPrompts;
            this.currentReflectionQuickPrompts = config.quickPrompts;

            var html = '<div class="reflection-section">';

            // Header
            html += '<div style="text-align:center; margin-bottom:32px;">';
            html += '<div style="font-size:3rem; margin-bottom:16px;">🤔</div>';
            html += '<h3 style="margin-bottom:8px;">Think About Your Learning</h3>';
            html += '<p style="color:#6b7280;">Take a moment to reflect on what you learned before completing the module</p>';
            html += '</div>';

            // Intro box
            html += '<div class="reflection-intro">';
            html += '<div class="reflection-intro-icon">i</div>';
            html += '<div class="reflection-intro-content">';
            html += '<h4>Why Reflect?</h4>';
            html += '<p>Taking time to think about what you learned helps you remember it better and apply it in real situations. ';
            html += 'Your insights here will help you connect theory to practice.</p>';
            html += '</div></div>';

            if (config.mode === 'quick') {
                html += '<p style="color:#6b7280; text-align:center; margin:0 0 24px 0;">Choose any answers. No writing needed.</p>';

                config.quickPrompts.forEach(function(prompt) {
                    html += '<div class="reflection-prompt">';
                    html += '<h4>' + sanitizeHTML(prompt.label) + '</h4>';
                    html += '<div class="reflection-checkboxes">';
                    prompt.options.forEach(function(option, optIdx) {
                        var inputId = 'reflection-' + prompt.id + '-' + optIdx;
                        var inputType = prompt.type === 'single' ? 'radio' : 'checkbox';
                        var inputName = prompt.type === 'single' ? 'reflection-' + prompt.id : inputId;
                        html += '<label><input type="' + inputType + '" name="' + inputName + '" id="' + inputId + '" data-reflection-group="' + prompt.id + '" value="' + sanitizeHTML(option) + '" /> ' + sanitizeHTML(option) + '</label>';
                    });
                    html += '</div></div>';
                });

                html += '<div class="action-plan">';
                html += '<button type="button" data-action="module-save-reflection" style="background:#10b981; color:white; padding:12px 24px; border:none; border-radius:8px; font-weight:600;">Save My Reflection</button>';
                html += '<p style="color:#6b7280; margin-top:12px; font-size:0.9rem;">Required: Save your reflection to continue</p>';
                html += '</div>';
            } else {
                config.textPrompts.forEach(function(prompt, idx) {
                    html += '<div class="reflection-prompt">';
                    html += '<h4>' + sanitizeHTML(prompt) + ' <span style="color:#6b7280; font-weight:400;">(optional)</span></h4>';
                    html += '<textarea id="reflection-text-' + idx + '" data-reflection-text="' + idx + '" placeholder="Optional response..."></textarea>';
                    html += '</div>';
                });

                html += '<div class="reflection-prompt">';
                html += '<h4>Where will you use this skill?</h4>';
                html += '<div class="reflection-checkboxes">';
                config.useCases.forEach(function(option) {
                    html += '<label><input type="checkbox" id="' + option.id + '" /> ' + sanitizeHTML(option.label) + '</label>';
                });
                html += '</div></div>';

                // Pragmatics Scaffold for Module Reflection
                if (window.PragmaticsScaffold && module.scaffold) {
                    html += window.PragmaticsScaffold.render(
                        module.scaffold,
                        { expanded: false, cardId: 'module-reflection-scaffold-' + module.id }
                    );
                }

                html += '<div class="action-plan">';
                html += '<h4>This week, I will <span style="color:#6b7280; font-weight:400;">(optional)</span>:</h4>';
                html += '<input type="text" id="reflection-goal" placeholder="Optional: a small practice goal" />';
                html += '<button type="button" data-action="module-save-reflection" style="background:#10b981; color:white; padding:12px 24px; border:none; border-radius:8px; font-weight:600;">Save My Reflection</button>';
                html += '<p style="color:#6b7280; margin-top:12px; font-size:0.9rem;">Required: Save your reflection to continue</p>';
                html += '</div>';
            }

            html += '</div>';
            container.innerHTML = html;

            // Add event listeners to update next button state as user types
            var self = this;
            setTimeout(function() {
                var fields = container.querySelectorAll('input, textarea');
                fields.forEach(function(field) {
                    field.addEventListener('input', function() {
                        self.updateNextButtonState();
                    });
                    field.addEventListener('change', function() {
                        self.updateNextButtonState();
                    });
                });
            }, 100);
        },

        saveReflection: function() {
            var reflectionData = this.collectReflectionData();

            // Save to State.moduleMastery
            var moduleId = this.currentModule ? this.currentModule.id : null;
            if (moduleId && State.moduleMastery.modules[moduleId]) {
                if (!State.moduleMastery.modules[moduleId].reflectionData) {
                    State.moduleMastery.modules[moduleId].reflectionData = [];
                }
                State.moduleMastery.modules[moduleId].reflectionData.push(reflectionData);
                State.moduleMastery.modules[moduleId].reflection.responses = reflectionData;
                State.moduleMastery.modules[moduleId].reflection.completed = true;
                State.moduleMastery.modules[moduleId].lastAccessed = new Date().toISOString();
                Storage.saveMastery();
            }

            // Show success message
            // showAchievementToast('Reflection Saved!', 'Your insights have been recorded', 'OK'); // Function not found - disabled

            // Update the button to show it was saved
            var button = document.querySelector('[data-action="module-save-reflection"]');
            if (button) {
                button.textContent = 'Reflection Saved';
                button.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                button.disabled = true;
            }

            // Show a confirmation message in the action plan area
            var actionPlan = button && typeof button.closest === 'function' ? button.closest('.action-plan') : null;
            if (actionPlan) {
                var confirmation = document.createElement('div');
                confirmation.style.marginTop = '16px';
                confirmation.style.padding = '12px';
                confirmation.style.background = 'white';
                confirmation.style.borderRadius = '8px';
                confirmation.style.textAlign = 'center';
                confirmation.style.color = '#065f46';
                confirmation.innerHTML = '<strong>Great!</strong> Your reflection has been saved. Click "Next" to complete the module.';
                actionPlan.appendChild(confirmation);
            }

            // Update next button state to enable it
            this.updateNextButtonState();
        },

        selectTestAnswer: function(questionIndex, optionIndex, clickedElement) {
            console.log('📝 selectTestAnswer called:', {
                questionIndex: questionIndex,
                optionIndex: optionIndex,
                currentTestType: this.currentTestType,
                moduleId: this.currentModule ? this.currentModule.id : 'none'
            });

            if (!this.currentTestType) {
                console.error('❌ No currentTestType set');
                return;
            }

            // Ensure testAnswers array exists
            if (!Array.isArray(this.testAnswers)) {
                this.testAnswers = [];
            }

            // Save selected answer
            this.testAnswers[questionIndex] = optionIndex;
            console.log('✅ Answer saved to testAnswers array:', this.testAnswers);

            var isPre = this.currentTestType === 'preTest';
            var questions = isPre ? this.currentModule.preTest.questions : this.currentModule.postTest.questions;
            var question = questions[questionIndex];
            var isCorrect = question && question.correct === optionIndex;

            // Immediately save to mastery tracking
            var moduleId = this.currentModule ? this.currentModule.id : null;
            if (moduleId && State.moduleMastery.modules[moduleId]) {
                if (!State.moduleMastery.modules[moduleId][isPre ? 'preTest' : 'postTest']) {
                    State.moduleMastery.modules[moduleId][isPre ? 'preTest' : 'postTest'] = { answers: [] };
                }
                State.moduleMastery.modules[moduleId][isPre ? 'preTest' : 'postTest'].answers = this.testAnswers.slice();
                Storage.saveMastery();
                console.log('💾 Answer saved to localStorage for', moduleId);
            }

            // Limit selection changes to the current module container
            var container = document.getElementById('module-step-content');
            if (!container) {
                console.error('❌ module-step-content container not found');
                return;
            }

            var options = container.querySelectorAll(
                '.quiz-option[data-question="' + questionIndex + '"]'
            );
            console.log('🔍 Found', options.length, 'options for question', questionIndex);

            options.forEach(function(opt, idx) {
                opt.classList.remove('selected', 'correct', 'incorrect');
                opt.setAttribute('aria-checked', 'false');
                opt.setAttribute('tabindex', idx === optionIndex ? '0' : '-1');
            });

            var target = clickedElement || container.querySelector(
                '.quiz-option[data-question="' + questionIndex + '"][data-option="' + optionIndex + '"]'
            );
            if (target) {
                target.classList.add('selected');
                target.classList.add(isCorrect ? 'correct' : 'incorrect');
                target.setAttribute('aria-checked', 'true');

                // Add visual pulse effect
                target.style.transform = 'scale(1.02)';
                setTimeout(function() {
                    target.style.transform = '';
                }, 200);

                console.log('✨ Visual feedback applied to option');
            } else {
                console.error('❌ Could not find target option element');
            }

            // Immediate feedback with enhanced educational content
            var feedbackId = isPre ? 'module-pre-feedback-' + questionIndex : 'module-post-feedback-' + questionIndex;
            var feedbackEl = document.getElementById(feedbackId);
            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.style.padding = '16px';
                feedbackEl.style.borderRadius = '12px';
                feedbackEl.style.marginTop = '12px';
                feedbackEl.style.lineHeight = '1.6';

                var feedbackHTML = '';

                if (isCorrect) {
                    // Correct answer feedback
                    feedbackEl.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
                    feedbackEl.style.border = '2px solid #10b981';
                    feedbackEl.style.color = '#065f46';

                    var correctFeedback = question.correctFeedback || (question.feedback && question.feedback.correct);
                    var feedbackText = sanitizeHTML(correctFeedback || ('Well done! ' + (question.explanation || '')));

                    feedbackHTML += '<div style="font-size:1.1em; font-weight:700; margin-bottom:8px;">✅ Excellent!</div>';
                    feedbackHTML += '<div style="margin-bottom:12px;">' + feedbackText + '</div>';

                    // Add "Why this works" section if available
                    if (question.whyCorrect) {
                        feedbackHTML += '<div style="background:white; padding:12px; border-radius:8px; margin-top:12px; border-left:4px solid #10b981;">';
                        feedbackHTML += '<strong style="color:#047857;">💡 Why this works:</strong><br>';
                        feedbackHTML += '<span style="color:#065f46;">' + sanitizeHTML(question.whyCorrect) + '</span>';
                        feedbackHTML += '</div>';
                    }
                } else {
                    // Incorrect answer feedback - Enhanced educational format
                    feedbackEl.style.background = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
                    feedbackEl.style.border = '2px solid #f59e0b';
                    feedbackEl.style.color = '#78350f';

                    // Try to get specific feedback for the selected option
                    var incorrectFeedback = null;
                    if (question.incorrectFeedback && Array.isArray(question.incorrectFeedback)) {
                        incorrectFeedback = question.incorrectFeedback[optionIndex];
                    } else if (question.feedback && Array.isArray(question.feedback.incorrect)) {
                        incorrectFeedback = question.feedback.incorrect[optionIndex];
                    }

                    var feedbackText = sanitizeHTML(incorrectFeedback || 'Not quite right.');

                    feedbackHTML += '<div style="font-size:1.1em; font-weight:700; margin-bottom:8px;">🤔 Not Quite!</div>';
                    feedbackHTML += '<div style="margin-bottom:12px;">' + feedbackText + '</div>';

                    // Show the correct answer with explanation
                    var correctOptionText = sanitizeHTML(question.options[question.correct]);
                    var correctAnswerLetter = String.fromCharCode(65 + question.correct);
                    var correctExplanation = sanitizeHTML(question.correctExplanation || question.explanation || 'This is the correct answer.');

                    feedbackHTML += '<div class="feedback-correct-answer">';
                    feedbackHTML += '<div class="feedback-correct-answer-label">✅ The correct answer is ' + correctAnswerLetter + '</div>';
                    feedbackHTML += '<div class="feedback-correct-answer-text">';
                    feedbackHTML += '<strong>"' + correctOptionText + '"</strong><br><br>';
                    feedbackHTML += '<strong>Why?</strong> ' + correctExplanation;
                    feedbackHTML += '</div>';
                    feedbackHTML += '</div>';

                    // Add key concept section if available
                    var keyConcept = question.keyConcept || question.concept;
                    if (keyConcept) {
                        feedbackHTML += '<div class="feedback-key-concept">';
                        feedbackHTML += '<div class="feedback-key-concept-label">💡 Key Concept</div>';
                        feedbackHTML += '<div class="feedback-key-concept-text">' + sanitizeHTML(keyConcept) + '</div>';
                        feedbackHTML += '</div>';
                    }

                    // Add hint section if available
                    if (question.hint) {
                        feedbackHTML += '<div style="background:white; padding:12px; border-radius:8px; margin-top:12px; border-left:4px solid #f59e0b;">';
                        feedbackHTML += '<strong style="color:#92400e;">💡 Hint:</strong><br>';
                        feedbackHTML += '<span style="color:#78350f;">' + sanitizeHTML(question.hint) + '</span>';
                        feedbackHTML += '</div>';
                    }

                    // Add review theory button
                    feedbackHTML += '<button type="button" class="feedback-review-link" data-action="module-load-step" data-step="0" style="margin-top:12px;">';
                    feedbackHTML += '🔄 Review the Theory';
                    feedbackHTML += '</button>';
                }

                // Add "Learn More" section if available
                if (question.learnMore) {
                    feedbackHTML += '<button type="button" class="learn-more-btn" data-action="module-toggle-learn-more" data-question-index="' + questionIndex + '" style="background:#6366f1; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.9em; margin-top:12px; display:inline-flex; align-items:center; gap:6px;">';
                    feedbackHTML += '📚 Learn More';
                    feedbackHTML += '</button>';
                    feedbackHTML += '<div id="learn-more-' + questionIndex + '" style="display:none; background:white; padding:12px; border-radius:8px; margin-top:12px; color:#374151;">';
                    feedbackHTML += sanitizeHTML(question.learnMore);
                    feedbackHTML += '</div>';
                }

                feedbackEl.innerHTML = feedbackHTML;
                console.log('📢 Enhanced feedback displayed');
            }

            this.updateTestProgress(isPre ? 'preTest' : 'postTest');
        },

        bindQuizOptionEvents: function(container, testType) {
            var self = this;
            if (!container) return;
            var options = container.querySelectorAll('.quiz-option');
            options.forEach(function(opt) {
                var q = parseInt(opt.getAttribute('data-question'), 10);
                var o = parseInt(opt.getAttribute('data-option'), 10);
                var handler = function() {
                    if (!Number.isFinite(q) || !Number.isFinite(o)) return;
                    self.currentTestType = testType;
                    self.selectTestAnswer(q, o, opt);
                };
                opt.addEventListener('click', handler);
                opt.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
                        e.preventDefault();
                        handler();
                    }
                });
            });
        },

        updateTestProgress: function(testType) {
            var isPre = testType === 'preTest';
            var questions = isPre ? this.currentModule.preTest.questions : this.currentModule.postTest.questions;
            var answered = this.testAnswers.filter(function(ans) { return typeof ans === 'number'; }).length;
            var correct = 0;
            for (var i = 0; i < questions.length; i++) {
                if (typeof this.testAnswers[i] === 'number' && this.testAnswers[i] === questions[i].correct) {
                    correct++;
                }
            }
            var percent = questions.length ? Math.round((correct / questions.length) * 100) : 0;
            var progressId = isPre ? 'module-pretest-progress' : 'module-posttest-progress';
            var resultId = isPre ? 'module-pretest-result' : 'module-posttest-result';
            var bar = document.getElementById(progressId);
            var result = document.getElementById(resultId);
            if (bar) {
                bar.style.width = percent + '%';
                bar.textContent = percent + '%';
            }
            if (result) {
                if (answered === questions.length) {
                    // Test completed - show encouraging message
                    if (isPre) {
                        // Pre-test: Always encouraging, growth-mindset messaging
                        this.showPreTestEncouragement(result, percent, correct, questions.length);
                    } else {
                        // Post-test: Show detailed results with growth mindset
                        this.showPostTestResults(result, percent, correct, questions.length, questions);
                    }
                } else {
                    result.textContent = 'Answer all questions • ' + correct + '/' + questions.length + ' correct';
                }
            }
            this.lastScores[testType] = { percent: percent, correct: correct, total: questions.length };

            // Update mastery when posttest done
            if (testType === 'postTest' && answered === questions.length) {
                var moduleId = this.currentModule ? this.currentModule.id : null;
                if (moduleId && State.moduleMastery.modules[moduleId]) {
                    State.moduleMastery.modules[moduleId].postTest.completed = true;
                    State.moduleMastery.modules[moduleId].postTest.completedAt = Date.now();
                    State.moduleMastery.modules[moduleId].postTest.score = percent;
                    State.moduleMastery.modules[moduleId].postTest.answers = this.testAnswers.slice();
                    State.moduleMastery.modules[moduleId].masteryScore = percent;
                    State.moduleMastery.modules[moduleId].masteryAchieved = percent >= this.masteryThreshold;
                    Storage.saveMastery();
                    console.log('🔵 POST-TEST COMPLETED and SAVED:', moduleId, 'score:', percent + '%');
                    console.log('🔵 Progress saved to State.moduleMastery.modules[' + moduleId + '].postTest');
                }
            }

            // Update next button state after grading
            this.updateNextButtonState();
        },

        nextStep: function() {
            // Log the active step list at navigation time
            console.log('🔵 nextStep() called - ACTIVE stepList:', this.steps);
            console.log('🔵 steps.length:', this.steps.length);
            console.log('🔵 Current step index:', this.currentStep, '(' + this.steps[this.currentStep] + ')');
            console.log('🔵 Next step will be:', this.steps[this.currentStep + 1]);
            console.log('🔵 Condition check: currentStep < steps.length - 1 ?', this.currentStep, '<', this.steps.length - 1, '=', this.currentStep < this.steps.length - 1);

            // CRITICAL: Verify we're not accidentally skipping postTest
            var currentStepName = this.steps[this.currentStep];
            var nextStepName = this.steps[this.currentStep + 1];
            if (currentStepName === 'activities' && nextStepName !== 'postTest') {
                console.error('🔴 CRITICAL ERROR: After activities, next step should be postTest but is:', nextStepName);
                console.error('🔴 Full steps array:', this.steps);
            } else if (currentStepName === 'activities' && nextStepName === 'postTest') {
                console.log('✅ CORRECT: activities → postTest navigation');
            }

            // Secondary guard: if button is disabled, do nothing
            var nextBtnGuard = document.getElementById('module-next-btn');
            if (nextBtnGuard && nextBtnGuard.disabled) {
                console.log('🛑 nextStep() blocked - button is disabled');
                return;
            }

            // Celebrate completing the current step
            var stepNames = this.stepNames || ['Theory', 'Examples', 'Practice', 'Post-Test', 'Reflection'];
            if (this.currentStep >= 0 && this.currentStep < stepNames.length) {
                showStepCompletionCelebration(stepNames[this.currentStep]);
            }

            // Persist mastery for completed step
            var currentStepName = this.steps[this.currentStep];
            this.markStepComplete(currentStepName);

            if (this.currentStep < this.steps.length - 1) {
                this.loadStep(this.currentStep + 1);
                console.log('🔵 After loadStep - now at step:', this.currentStep, '(' + this.steps[this.currentStep] + ')');
                window.scrollTo(0, 0);
            } else {
                console.log('🔵 Last step reached, calling completeModule()');
                this.completeModule();
            }
        },

        prevStep: function() {
            if (this.currentStep > 0) {
                this.loadStep(this.currentStep - 1);
                window.scrollTo(0, 0);
            }
        },

        completeModule: function() {
            var moduleId = this.currentModule.id;
            this.ensureModuleProgress(moduleId);
            var progress = State.moduleMastery.modules[moduleId] || {};
            var needsPostTest = Array.isArray(this.steps) && this.steps.indexOf('postTest') !== -1;
            var postCompleted = progress.postTest && progress.postTest.completed === true;

            // Guard: require post-test completion if present in the step list
            if (needsPostTest && !postCompleted) {
                console.warn('CompleteModule blocked: postTest not completed for', moduleId);
                alert('Please finish the post-test before completing this module.');
                var postIndex = this.steps.indexOf('postTest');
                if (postIndex !== -1) {
                    this.loadStep(postIndex);
                }
                return;
            }

            var needsReflection = Array.isArray(this.steps) && this.steps.indexOf('reflection') !== -1;
            var reflectionCompleted = progress.reflection && progress.reflection.completed === true;

            // Guard: require reflection completion if present in the step list
            if (needsReflection && !reflectionCompleted) {
                console.warn('CompleteModule blocked: reflection not completed for', moduleId);
                alert('Please complete and save your reflection before finishing this module.');
                var reflectionIndex = this.steps.indexOf('reflection');
                if (reflectionIndex !== -1) {
                    this.loadStep(reflectionIndex);
                }
                return;
            }

            var postScore = this.lastScores.postTest && typeof this.lastScores.postTest.percent === 'number'
                ? this.lastScores.postTest.percent
                : (progress.postTest && typeof progress.postTest.score === 'number' ? progress.postTest.score : 100);
            var achievedMastery = postScore >= this.masteryThreshold;

            if (State.moduleMastery.modules[moduleId]) {
                var moduleProgress = State.moduleMastery.modules[moduleId];
                moduleProgress.completed = true;
                moduleProgress.masteryScore = postScore;
                moduleProgress.masteryAchieved = achievedMastery;
                if (needsPostTest) {
                    moduleProgress.postTest.completed = true;
                    moduleProgress.postTest.completedAt = moduleProgress.postTest.completedAt || Date.now();
                }
                if (this.steps.indexOf('reflection') !== -1) {
                    moduleProgress.reflection.completed = true;
                }
                moduleProgress.completionDate = Date.now();
                Storage.saveMastery();
                try {
                    updateModuleProgressUI();
                } catch (uiErr) {
                    console.warn('updateModuleProgressUI failed (non-blocking):', uiErr);
                }

                if (typeof tryUnlockNextModule === 'function') {
                    try {
                        tryUnlockNextModule(moduleId);
                    } catch (unlockErr) {
                        console.warn('tryUnlockNextModule failed (non-blocking):', unlockErr);
                    }
                }

                if (achievedMastery) {
                    setTimeout(function() {
                        if (typeof checkAndShowGraduation === 'function') {
                            checkAndShowGraduation();
                        }
                    }, 2000);
                }
            }

            if (achievedMastery) {
                if (typeof triggerConfetti === 'function') {
                    triggerConfetti();
                }
                if (typeof showAchievementToast === 'function') {
                    showAchievementToast('Module Mastered!', 'You achieved ' + postScore + '% mastery!', '🏆');
                }
            } else if (typeof showAchievementToast === 'function') {
                showAchievementToast('Module Complete!', 'You scored ' + postScore + '%. Keep practicing!', 'OK');
            }

            if (typeof updateStreak === 'function') {
                updateStreak();
            }

            var currentModuleNumber = parseInt(moduleId.replace('module-', ''), 10);
            var nextModuleId = 'module-' + (currentModuleNumber + 1);
            var hasNextModule = Array.isArray(LEARNING_SYSTEM.modules) && LEARNING_SYSTEM.modules.find(function(m) { return m.id === nextModuleId; });

            var content = document.getElementById('module-step-content');
            if (!content) {
                console.error('[completeModule] module-step-content not found');
                return;
            }
            var html = '<div class="module-complete" style="text-align:center; padding:48px 24px;">' +
                '<div style="font-size:5rem; margin-bottom:24px;">🎉</div>' +
                '<h2 style="color:#10b981; margin-bottom:16px;">Module Complete!</h2>' +
                '<p style="color:#6b7280; margin-bottom:8px;">You scored <strong style="color:#6366f1; font-size:1.5rem;">' + postScore + '%</strong> on the post-test.</p>' +
                '<p style="color:#6b7280; margin-bottom:24px;">' + (achievedMastery ? '🏆 <strong style="color:#10b981;">Mastery threshold met!</strong>' : 'Keep practicing to reach mastery (' + this.masteryThreshold + '%).') + '</p>' +
                '<div class="completion-actions" style="display:flex; flex-wrap:wrap; gap:12px; justify-content:center;">';

            if (hasNextModule) {
                html += '<button type="button" class="next-step-button primary" data-action="module-start" data-module-id="' + nextModuleId + '" style="padding:12px 20px;">Continue to Module ' + (currentModuleNumber + 1) + '</button>';
            }

            html += '<button type="button" class="next-step-button secondary" data-action="module-load-step" data-step="0" style="padding:12px 20px;">Review Theory</button>';
            html += '<button type="button" class="next-step-button secondary" data-action="module-load-step" data-step="3" style="padding:12px 20px;">Retake Post-Test</button>';
            html += '<button type="button" class="nav-btn" data-action="nav-section" data-section="guide" style="padding:12px 20px;">View Learning Path</button>';
            html += '<button type="button" class="nav-btn" data-action="nav-section" data-section="progress" style="padding:12px 20px;">View Progress</button>';
            html += '</div>';
            html += '</div>';

            content.innerHTML = html;

            (function wireCompletionScreenButtons() {
                const container = document.getElementById('module-step-content');
                if (!container) return;

                const bindButtons = () => {
                    // Continue ? start next module
                    container.querySelectorAll('[data-action="module-start"]').forEach(btn => {
                        if (btn.dataset.bound === '1') return;
                        btn.dataset.bound = '1';
                        btn.addEventListener('click', () => {
                            const nextId = btn.getAttribute('data-module-id');
                            if (nextId && window.ModuleLearning && typeof ModuleLearning.start === 'function') {
                                ModuleLearning.start(nextId);
                            }
                        });
                    });

                    // Review / Retake ? jump to a specific step of this module
                    container.querySelectorAll('[data-action="module-load-step"]').forEach(btn => {
                        if (btn.dataset.bound === '1') return;
                        btn.dataset.bound = '1';
                        btn.addEventListener('click', () => {
                            const stepIndex = Number(btn.getAttribute('data-step'));
                            if (!Number.isFinite(stepIndex)) return;

                            const nav = document.getElementById('module-nav-buttons');
                            if (nav) nav.style.display = 'flex';

                            if (ModuleLearning && typeof ModuleLearning.loadStep === 'function') {
                                ModuleLearning.currentStep = stepIndex;
                                ModuleLearning.loadStep(stepIndex);
                                if (typeof ModuleLearning.updateStepIndicators === 'function') {
                                    ModuleLearning.updateStepIndicators();
                                }
                                window.scrollTo(0, 0);
                            }
                        });
                    });

                    // Navigation to other sections (guide/progress/etc.)
                    container.querySelectorAll('[data-action="nav-section"]').forEach(btn => {
                        if (btn.dataset.bound === '1') return;
                        btn.dataset.bound = '1';
                        btn.addEventListener('click', () => {
                            const section = btn.getAttribute('data-section');
                            if (section && window.Navigation && typeof Navigation.showSection === 'function') {
                                Navigation.showSection(section);
                            }
                        });
                    });
                };

                bindButtons();

                if (!container._completionObserver) {
                    const observer = new MutationObserver(() => bindButtons());
                    observer.observe(container, { childList: true, subtree: true });
                    container._completionObserver = observer;
                }
            })();

            var navButtons = document.getElementById('module-nav-buttons');
            if (navButtons) {
                navButtons.style.display = 'none';
            }

            if (window.ProgressModule && typeof ProgressModule.update === 'function') {
                ProgressModule.update();
            }

            if (typeof NavigationBanner !== 'undefined' && NavigationBanner && typeof NavigationBanner.update === 'function') {
                try {
                    NavigationBanner.update();
                } catch (navErr) {
                    console.warn('NavigationBanner.update failed (non-blocking):', navErr);
                }
            }
        },

        exit: function() {
            if (confirm('Exit module? Your progress is saved.')) {
                Navigation.showSection('guide');
            }
        },

        // Stable entry point for external callers (e.g., ModuleModal shim)
        openModule: function(moduleId) {
            console.log('[ModuleLearning] openModule called with id:', moduleId);
            // Use explicit reference to avoid losing context if called unbound
            return ModuleLearning.start(moduleId);
        },

        skipCurrentStep: function(targetStep) {
            var moduleId = this.currentModule.id;
            var currentStepName = this.steps[this.currentStep];

            // Mark current step as completed (but skipped)
            if (State.moduleMastery.modules[moduleId]) {
                // Mark theory as completed if skipping theory
                if (currentStepName === 'theory' && State.moduleMastery.modules[moduleId].theory) {
                    State.moduleMastery.modules[moduleId].theory.completed = true;
                    State.moduleMastery.modules[moduleId].theory.skipped = true;
                }
                // Mark jokes/examples as completed if skipping
                if (currentStepName === 'jokes' && State.moduleMastery.modules[moduleId].jokes) {
                    State.moduleMastery.modules[moduleId].jokes.analyzed = ['skipped'];
                    State.moduleMastery.modules[moduleId].jokes.skipped = true;
                }
                Storage.saveMastery();
            }

            // Show confirmation banner
            var content = document.getElementById('module-step-content');
            var confirmation = document.createElement('div');
            confirmation.className = 'skip-confirmation show';
            confirmation.innerHTML = '<span class="skip-confirmation-icon">✅</span>' +
                '<span class="skip-confirmation-text">Section skipped! Moving to ' +
                (targetStep ? this.steps[targetStep] : 'next step') + '...</span>';

            // Insert at top of content
            content.insertBefore(confirmation, content.firstChild);

            // Remove confirmation after 2 seconds and proceed
            var self = this;
            setTimeout(function() {
                confirmation.remove();
                if (typeof targetStep === 'number') {
                    self.loadStep(targetStep);
                } else {
                    self.nextStep();
                }
                window.scrollTo(0, 0);
            }, 2000);
        },

        skipToStep: function(stepIndex) {
            this.skipCurrentStep(stepIndex);
        },

        // ========================================
        // SPACED REPETITION REVIEW SYSTEM
        // ========================================

        getModulesNeedingReview: function() {
            var now = Date.now();
            var modulesNeedingReview = [];

            // Spaced repetition intervals (in milliseconds)
            var intervals = {
                day1: 24 * 60 * 60 * 1000,      // 1 day
                day3: 3 * 24 * 60 * 60 * 1000,  // 3 days
                day7: 7 * 24 * 60 * 60 * 1000,  // 7 days
                day14: 14 * 24 * 60 * 60 * 1000 // 14 days
            };

            // Check each module
            for (var moduleId in State.moduleMastery.modules) {
                var module = State.moduleMastery.modules[moduleId];

                // Only consider completed modules
                if (module.completed && module.postTest && module.postTest.completed) {
                    var completionTime = module.completionDate || module.postTest.completedAt || 0;
                    var daysSinceCompletion = Math.floor((now - completionTime) / (24 * 60 * 60 * 1000));

                    // Check if module needs review based on spaced repetition schedule
                    var lastReview = module.lastReviewDate || completionTime;
                    var daysSinceReview = Math.floor((now - lastReview) / (24 * 60 * 60 * 1000));

                    // Determine if review is needed
                    var needsReview = false;
                    var reviewReason = '';

                    if (daysSinceReview >= 14) {
                        needsReview = true;
                        reviewReason = 'Due for 2-week review';
                    } else if (daysSinceReview >= 7) {
                        needsReview = true;
                        reviewReason = 'Due for 1-week review';
                    } else if (daysSinceReview >= 3) {
                        needsReview = true;
                        reviewReason = '3-day review recommended';
                    } else if (daysSinceReview >= 1) {
                        needsReview = true;
                        reviewReason = '24-hour review';
                    }

                    if (needsReview) {
                        modulesNeedingReview.push({
                            id: moduleId,
                            title: this.getModuleTitle(moduleId),
                            daysSinceReview: daysSinceReview,
                            masteryScore: module.masteryScore || 0,
                            reviewReason: reviewReason
                        });
                    }
                }
            }

            return modulesNeedingReview;
        },

        getModuleTitle: function(moduleId) {
            var module = LEARNING_SYSTEM.modules.find(function(m) { return m.id === moduleId; });
            return module ? module.title : moduleId;
        },

        updateReviewReminders: function() {
            var container = document.getElementById('review-reminders-container');
            if (!container) return;

            var modulesNeedingReview = this.getModulesNeedingReview();

            if (modulesNeedingReview.length === 0) {
                container.style.display = 'none';
                return;
            }

            // Show the most urgent module (longest time since review)
            var urgentModule = modulesNeedingReview.sort(function(a, b) {
                return b.daysSinceReview - a.daysSinceReview;
            })[0];

            var html = '<div class="review-reminder-container">' +
                '<div class="review-reminder-header">' +
                '<span class="review-reminder-icon">💭</span>' +
                '<span class="review-reminder-title">Quick Review Reminder</span>' +
                '</div>' +
                '<div class="review-reminder-message">' +
                'Remember what you learned in <strong>' + urgentModule.title + '</strong> ';

            if (urgentModule.daysSinceReview === 1) {
                html += 'yesterday';
            } else if (urgentModule.daysSinceReview < 7) {
                html += urgentModule.daysSinceReview + ' days ago';
            } else if (urgentModule.daysSinceReview < 14) {
                html += 'last week';
            } else {
                html += urgentModule.daysSinceReview + ' days ago';
            }

            html += '? Let\'s do a 2-minute refresher!' +
                '</div>' +
                '<div class="review-reminder-stats">' +
                '<div class="review-stat-item">' +
                '<span class="review-stat-label">Days Since Review</span>' +
                '<span class="review-stat-value">' + urgentModule.daysSinceReview + '</span>' +
                '</div>' +
                '<div class="review-stat-item">' +
                '<span class="review-stat-label">Your Score</span>' +
                '<span class="review-stat-value">' + urgentModule.masteryScore + '%</span>' +
                '</div>';

            if (modulesNeedingReview.length > 1) {
                html += '<div class="review-stat-item">' +
                    '<span class="review-stat-label">Total Pending</span>' +
                    '<span class="review-stat-value">' + modulesNeedingReview.length + '</span>' +
                    '</div>';
            }

            html += '</div>' +
                '<div class="review-reminder-actions">' +
                '<button type="button" class="review-btn primary" data-action="module-start-quick-review" data-module-id="' + urgentModule.id + '">' +
                '<span>Start 2-Min Review</span>' +
                '<span>→</span>' +
                '</button>' +
                '<button type="button" class="review-btn secondary" data-action="module-dismiss-review" data-module-id="' + urgentModule.id + '">' +
                'Remind Me Tomorrow' +
                '</button>' +
                '</div>' +
                '</div>';

            container.innerHTML = html;
            container.style.display = 'block';
        },

        startQuickReview: function(moduleId) {
            var module = LEARNING_SYSTEM.modules.find(function(m) { return m.id === moduleId; });
            if (!module) return;

            // Get key points from the module
            var keyPoints = this.getModuleKeyPoints(moduleId);

            // Show quick review modal
            var modal = document.getElementById('quick-review-modal');
            if (!modal) return;

            var html = '<div class="quick-review-content">' +
                '<div class="quick-review-header">' +
                '<h3>Quick Review: ' + sanitizeHTML(module.title) + '</h3>' +
                '<button type="button" class="quick-review-close" data-action="module-close-quick-review">✕</button>' +
                '</div>' +
                '<div class="quick-review-intro">' +
                '<p>Let\'s refresh the key concepts you learned. This will only take 2 minutes!</p>' +
                '</div>' +
                '<div class="quick-review-keypoints">';

            keyPoints.forEach(function(point, index) {
                html += '<div class="review-keypoint">' +
                    '<div class="review-keypoint-number">' + (index + 1) + '</div>' +
                    '<div class="review-keypoint-content">' +
                    '<div class="review-keypoint-title">' + sanitizeHTML(point.title) + '</div>' +
                    '<div class="review-keypoint-description">' + sanitizeHTML(point.description) + '</div>' +
                    '</div>' +
                    '</div>';
            });

            html += '</div>' +
                '<div class="quick-review-actions">' +
                '<button type="button" class="review-action-btn primary" data-action="module-complete-quick-review" data-module-id="' + moduleId + '">' +
                '✓ I Remember This!' +
                '</button>' +
                '<button type="button" class="review-action-btn secondary" data-action="module-retake-module" data-module-id="' + moduleId + '">' +
                '🔄 Retake Full Module' +
                '</button>' +
                '</div>' +
                '</div>';

            modal.innerHTML = html;
            modal.classList.add('show');
        },

        getModuleKeyPoints: function(moduleId) {
            // Get key concepts from the module's theory section
            var module = LEARNING_SYSTEM.modules.find(function(m) { return m.id === moduleId; });
            if (!module || !module.theory) {
                return [
                    { title: 'Key Concept 1', description: 'Review the main theory points from this module.' },
                    { title: 'Key Concept 2', description: 'Practice applying what you learned.' },
                    { title: 'Key Concept 3', description: 'Remember the real-world examples.' }
                ];
            }

            // Extract key points from theory content
            // This is a simplified version - in production, you'd parse the actual theory content
            var keyPoints = [];

            if (module.theory.keyConcepts) {
                module.theory.keyConcepts.forEach(function(concept) {
                    keyPoints.push({
                        title: concept.title || 'Key Concept',
                        description: concept.summary || concept.description || ''
                    });
                });
            }

            // Fallback to generic review points
            if (keyPoints.length === 0) {
                keyPoints = [
                    { title: 'Theory Review', description: 'Recall the main theoretical concepts you learned in this module.' },
                    { title: 'Practical Application', description: 'Think about how you can apply these concepts in real situations.' },
                    { title: 'Examples', description: 'Remember the examples that illustrated these concepts.' }
                ];
            }

            return keyPoints.slice(0, 3); // Limit to 3 key points for quick review
        },

        completeQuickReview: function(moduleId) {
            // Mark review as completed
            if (State.moduleMastery.modules[moduleId]) {
                State.moduleMastery.modules[moduleId].lastReviewDate = Date.now();
                Storage.saveMastery();
            }

            // Show success message
            showAchievementToast('Review Complete!', 'Great job refreshing your knowledge!', '✅');

            // Close modal
            this.closeQuickReview();

            // Update reminders
            this.updateReviewReminders();
        },

        closeQuickReview: function() {
            var modal = document.getElementById('quick-review-modal');
            if (modal) {
                modal.classList.remove('show');
            }
        },

        retakeModule: function(moduleId) {
            this.closeQuickReview();
            this.start(moduleId);
        },

        dismissReviewReminder: function(moduleId) {
            // Postpone review by 1 day
            if (State.moduleMastery.modules[moduleId]) {
                State.moduleMastery.modules[moduleId].lastReviewDate = Date.now();
                Storage.saveMastery();
            }

            // Update reminders display
            this.updateReviewReminders();

            showAchievementToast('Reminder Postponed', 'We\'ll remind you tomorrow!', '⏰');
        }
    });

    // ========================================
    // RESOURCE TABS (for Resources page)
    // ========================================
    const ResourceTabs = {
        switchTab: function(tabName) {
            const allTabs = document.querySelectorAll('.resource-tab');
            const allContents = document.querySelectorAll('.tab-content');

            allTabs.forEach(tab => {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
            });

            allContents.forEach(content => {
                content.classList.remove('active');
            });

            const selectedTab = document.getElementById('tab-btn-' + tabName);
            const selectedContent = document.getElementById('tab-' + tabName);

            if (selectedTab) {
                selectedTab.classList.add('active');
                selectedTab.setAttribute('aria-selected', 'true');
            }

            if (selectedContent) {
                selectedContent.classList.add('active');
            }
        }
    };

    // ========================================
    // EXPOSE TO GLOBAL SCOPE FOR ONCLICK HANDLERS
    // ========================================
    // CRITICAL: These must be exposed to global scope because inline onclick handlers
    // in dynamically created HTML (like the modal) execute in global scope
    // Copy all properties from local ModuleModal to window.ModuleModal
    Object.keys(ModuleModal).forEach(function(key) {
        window.ModuleModal[key] = ModuleModal[key];
    });

    window.ModuleModal.__ready = true;

    // Flush any queued module opens from legacy bridge
    if (Array.isArray(window.__moduleModalQueue) && window.__moduleModalQueue.length) {
        console.log('[module-learning] Flushing', window.__moduleModalQueue.length, 'queued ModuleModal.show calls');
        var queued = window.__moduleModalQueue.slice();
        window.__moduleModalQueue.length = 0;
        queued.forEach(function(moduleId) {
            try {
                window.ModuleModal.show(moduleId);
            } catch (err) {
                console.error('[module-learning] Failed to flush queued show() for', moduleId, err);
            }
        });
    }

    window.ResourceTabs = ResourceTabs;

    // Ensure module navigation buttons are reliably bound
    function bindModuleNavButtons() {
        var prevBtn = document.getElementById('module-prev-btn');
        var nextBtn = document.getElementById('module-next-btn');
        var tooltip = document.getElementById('module-next-tooltip');

        console.log('[bindModuleNavButtons] prev:', !!prevBtn, 'next:', !!nextBtn);

        if (prevBtn && !prevBtn.dataset.bound) {
            prevBtn.dataset.bound = '1';
            console.log('[bindModuleNavButtons] bound prev');
            prevBtn.addEventListener('click', function(e){
                console.log('[MODULE NAV] PREV click', 'step before=', ModuleLearning.currentStep, 'name=', ModuleLearning.steps && ModuleLearning.steps[ModuleLearning.currentStep]);
                ModuleLearning.prevStep();
            });
        }

        if (nextBtn && !nextBtn.dataset.bound) {
            nextBtn.dataset.bound = '1';
            console.log('[bindModuleNavButtons] bound next');
            nextBtn.addEventListener('click', function(e){
                var beforeStep = ModuleLearning.currentStep;
                var beforeName = ModuleLearning.steps && ModuleLearning.steps[beforeStep];
                var upcomingName = ModuleLearning.steps && ModuleLearning.steps[beforeStep + 1];
                console.log('[MODULE NAV] NEXT click', 'step before=', beforeStep, 'name=', beforeName, 'upcoming=', upcomingName, 'disabled=', nextBtn.disabled);
                if (nextBtn.disabled || nextBtn.getAttribute('disabled')) {
                    console.warn('🛑 Next click blocked - button is disabled');
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    return;
                }
                ModuleLearning.nextStep();
                console.log('[MODULE NAV] NEXT click after', 'step=', ModuleLearning.currentStep, 'name=', ModuleLearning.steps && ModuleLearning.steps[ModuleLearning.currentStep]);
            });
        }
    }

    function bindQrBackupButtons() {
        var backupBtn = document.getElementById('qr-backup-btn');
        var restoreBtn = document.getElementById('qr-restore-btn');
        var restoreTextBtn = document.getElementById('qr-restore-text-btn');
        var backupClose = document.getElementById('qr-backup-close');
        var restoreClose = document.getElementById('qr-restore-close');
var backupDownload = document.getElementById('qr-backup-download'); // NEW
        if (backupBtn && !backupBtn.dataset.qrBound) {
            backupBtn.dataset.qrBound = '1';
            backupBtn.addEventListener('click', function() {
                try {
                    openQrBackupModal();
                } catch (err) {
                    console.warn('Failed to open QR backup modal:', err);
                }
            });
        }

        if (restoreBtn && !restoreBtn.dataset.qrBound) {
            restoreBtn.dataset.qrBound = '1';
            restoreBtn.addEventListener('click', function() {
                try {
                    openQrRestoreModal();
                } catch (err) {
                    console.warn('Failed to open QR restore modal:', err);
                }
            });
        }

        
    // Download QR as PNG (uses existing canvas generated by generateQrBackupCode)
    if (backupDownload && !backupDownload.dataset.qrBound) {
        backupDownload.dataset.qrBound = '1';
        backupDownload.addEventListener('click', function () {
            try {
                var container = document.getElementById('qr-backup-code');
                var canvas = container && container.querySelector('canvas');
                var statusNode = document.getElementById('qr-backup-status');

                if (!canvas || !canvas.toDataURL) {
                    if (statusNode) {
                        statusNode.textContent = 'Please generate the QR code first.';
                    }
                    return;
                }

                var dataUrl = canvas.toDataURL('image/png');
                var link = document.createElement('a');
                link.href = dataUrl;
                link.download = 'pragmatics-progress-backup.png';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                if (statusNode) {
                    statusNode.textContent = 'QR image downloaded. You can upload this PNG on another device.';
                }
            } catch (err) {
                console.warn('Failed to download QR backup:', err);
            }
        });
    }

        if (backupClose && !backupClose.dataset.qrBound) {
            backupClose.dataset.qrBound = '1';
            backupClose.addEventListener('click', function() {
                try {
                    closeQrBackupModal();
                } catch (err) {
                    console.warn('Failed to close QR backup modal:', err);
                }
            });
        }

        if (restoreClose && !restoreClose.dataset.qrBound) {
            restoreClose.dataset.qrBound = '1';
            restoreClose.addEventListener('click', function() {
                try {
                    closeQrRestoreModal();
                } catch (err) {
                    console.warn('Failed to close QR restore modal:', err);
                }
            });
        }
    }

    document.addEventListener('DOMContentLoaded', bindModuleNavButtons);
    document.addEventListener('DOMContentLoaded', bindQrBackupButtons);

    // === GLOBAL EXPORTS (MUST BE INSIDE MAIN IIFE) ===
    window.ModuleLearning = ModuleLearning;
    ModuleLearning.buildQrPayload = buildQrPayload;
    ModuleLearning.handleQrRestorePayload = handleQrRestorePayload;
     
// --- START OF REPAIR BLOCK ---
    
    // Stable entry point for opening modules
    ModuleLearning.openModule = function (moduleId) {
        console.log('[ModuleLearning.openModule] called with:', moduleId);
        return ModuleLearning.start(moduleId);
    };

    // Final Safe Exports for Launch
    window.ModuleLearning = ModuleLearning;
    window.ModuleModal = ModuleModal;

    console.log('🚀 Module system fully exported and ready.');
    
})(); // This closes the file correctly.

