/**
 * ACTION DISPATCHER
 *
 * Centralized event delegation to replace inline onclick handlers.
 */

(function() {
    'use strict';

    // Temporary diagnostics: enable in console via `window.__CLICK_TRACE__ = true`
    if (typeof window.__CLICK_TRACE__ === 'undefined') window.__CLICK_TRACE__ = false;

    let lastNotReadyToastAt = 0;
    function showBlockedMessage(message, type = 'info') {
        const now = Date.now();
        if (now - lastNotReadyToastAt < 900) return;
        lastNotReadyToastAt = now;

        if (window.UI && typeof window.UI.toast === 'function') {
            window.UI.toast(message, type);
            return;
        }

        const id = 'app-not-ready-toast';
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('div');
            el.id = id;
            el.style.cssText = [
                'position:fixed',
                'left:50%',
                'top:16px',
                'transform:translateX(-50%)',
                'background:#111827',
                'color:#fff',
                'padding:10px 14px',
                'border-radius:10px',
                'font:14px system-ui, sans-serif',
                'box-shadow:0 10px 25px rgba(0,0,0,0.25)',
                'z-index:10001',
                'max-width:calc(100% - 24px)',
                'text-align:center'
            ].join(';');
            document.body.appendChild(el);
        }
        el.textContent = message;
        el.style.display = 'block';
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(() => {
            el.style.display = 'none';
        }, 1200);
    }

    function closestActionTarget(target) {
        const node = target && target.nodeType === 3 ? target.parentElement : target;
        return node && node.closest ? node.closest('[data-action]') : null;
    }

    function safeCall(fn, ...args) {
        try {
            if (typeof fn !== 'function') return;
            const result = fn(...args);
            if (result && typeof result.then === 'function') {
                result.catch((e) => console.error('Action handler async failed:', e));
            }
            return result;
        } catch (e) {
            console.error('Action handler failed:', e);
        }
    }

    function startPlacementAfterNavigation() {
        const run = async () => {
            try {
                if (window.Navigation && typeof window.Navigation.showSection === 'function') {
                    window.Navigation.showSection('placement');
                } else {
                    window.location.hash = '#placement';
                }

                // Give the router a tick to activate the section before starting.
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

                const placementSection = document.getElementById('placement');
                const intro = document.getElementById('placement-intro');
                const quiz = document.getElementById('placement-quiz');
                const questionText = document.getElementById('placement-question-text');

                if (!placementSection || !intro || !quiz || !questionText) {
                    console.error('Placement UI missing required elements', {
                        placementSection: !!placementSection,
                        intro: !!intro,
                        quiz: !!quiz,
                        questionText: !!questionText
                    });
                    showBlockedMessage('Placement UI is missing. Please reload the page.', 'error');
                    return;
                }

                if (!window.PlacementModule || typeof window.PlacementModule.start !== 'function') {
                    console.error('PlacementModule is not available');
                    showBlockedMessage('Placement module failed to load. Please reload.', 'error');
                    return;
                }

                await window.PlacementModule.start();
            } catch (e) {
                console.error('Placement start failed:', e);
                showBlockedMessage('Could not start placement test. Please reload and try again.', 'error');
            }
        };

        run();
    }

    function maybeClickTrace(event, actionEl, action) {
        if (window.__CLICK_TRACE__ !== true) return;

        const rawTarget = event.target;
        const target = rawTarget && rawTarget.nodeType === 3 ? rawTarget.parentElement : rawTarget;
        const fromPoint = (typeof event.clientX === 'number' && typeof event.clientY === 'number')
            ? document.elementFromPoint(event.clientX, event.clientY)
            : null;

        const moduleLike = target && target.closest
            ? target.closest('.model-box[role="button"], .module-card[role="button"], [data-module-id][role="button"]')
            : null;
        const placementLike = target && target.closest
            ? target.closest('#placement-btn, #cta-placement, [data-action="placement-start"]')
            : null;

        console.groupCollapsed('[CLICK TRACE]', action || '(no data-action)');
        console.log('target:', target);
        console.log('closest [data-action]:', actionEl);
        console.log('resolved action:', action);
        console.log('dataset:', actionEl ? actionEl.dataset : null);

        if (fromPoint) {
            console.log('elementFromPoint:', fromPoint);
            if (moduleLike && fromPoint !== target && !fromPoint.closest('.model-box[role="button"], .module-card[role="button"], [data-module-id][role="button"]')) {
                console.warn('Possible overlay intercepting module card click:', fromPoint);
            }
        }

        if (!actionEl && moduleLike) {
            console.warn('Module-card-like element clicked, but no [data-action] found:', moduleLike);
        }
        if (!actionEl && placementLike) {
            console.warn('Placement-button-like element clicked, but no [data-action] found:', placementLike);
        }
        console.groupEnd();
    }

    function handleClick(event) {
        const target = event.target && event.target.nodeType === 3 ? event.target.parentElement : event.target;
        let el = closestActionTarget(target);

        // Fallback: if a module card looks clickable but lost its attributes, recover via selector.
        if (!el && target && target.closest) {
            const moduleCard = target.closest('.model-box[role="button"], .module-card[role="button"], [data-module-id][role="button"]');
            if (moduleCard) {
                // Repair attributes for future clicks.
                if (!moduleCard.getAttribute('data-action')) moduleCard.setAttribute('data-action', 'module-modal-show');
                el = moduleCard;
            }
        }

        const action = el ? el.getAttribute('data-action') : null;
        maybeClickTrace(event, el, action);
        if (!el || !action) return;

        if (window.APP_INIT_FAILED === true) {
            event.preventDefault();
            console.warn('[ACTION BLOCKED] App init failed', action);
            showBlockedMessage('App failed to load. Please reload the page.', 'error');
            return;
        }

        if (window.APP_READY !== true) {
            event.preventDefault();
            console.warn('[ACTION BLOCKED] App not ready', action);
            showBlockedMessage('Loading… please try again in a second.', 'info');
            return;
        }

        // Prevent accidental navigation for action-driven anchors/buttons.
        if (el.tagName === 'A' || el.tagName === 'BUTTON') {
            event.preventDefault();
        }

        switch (action) {
            case 'skip-placement-test': {
                safeCall(window.skipPlacementTest);
                return;
            }
            case 'skip-welcome': {
                safeCall(window.skipWelcome);
                return;
            }
            case 'continue-learning': {
                safeCall(window.continueLearning);
                return;
            }
            case 'show-onboarding': {
                safeCall(window.showOnboarding);
                return;
            }
            case 'accordion-open': {
                const targetId = el.getAttribute('data-target');
                if (!targetId) return;
                const header = document.querySelector('.accordion-header[data-target="' + targetId + '"]');
                if (header) header.click();
                return;
            }
            case 'progress-notice-dismiss': {
                try {
                    localStorage.setItem('dismissedProgressNotice', '1');
                } catch (e) {
                    // ignore
                }
                const banner = document.getElementById('local-progress-warning-banner');
                if (banner) banner.style.display = 'none';
                return;
            }
            case 'certificate-download': {
                safeCall(window.downloadCertificate);
                return;
            }
            case 'certificate-share': {
                safeCall(window.shareCertificate);
                return;
            }
            case 'feedback-form': {
                safeCall(window.showFeedbackForm);
                return;
            }
            case 'page-reload': {
                window.location.reload();
                return;
            }
            case 'dismiss-by-id': {
                const id = el.getAttribute('data-target-id');
                if (!id) return;
                const target = document.getElementById(id);
                if (target) target.style.display = 'none';
                return;
            }
            case 'nav-section': {
                const section = el.getAttribute('data-section');
                if (window.Navigation && typeof window.Navigation.showSection === 'function') {
                    safeCall(window.Navigation.showSection.bind(window.Navigation), section);
                }
                return;
            }
            case 'placement-start': {
                console.log('[ACTION]', action, {
                    APP_READY: window.APP_READY === true,
                    hasNavigation: !!window.Navigation,
                    hasPlacementModule: !!window.PlacementModule,
                    dataLoaded: !!(window.DataLoader && window.DataLoader.isLoaded)
                });
                startPlacementAfterNavigation();
                return;
            }
            case 'placement-next': {
                if (window.PlacementModule && typeof window.PlacementModule.nextQuestion === 'function') {
                    safeCall(window.PlacementModule.nextQuestion.bind(window.PlacementModule));
                }
                return;
            }
            case 'placement-start-learning': {
                if (window.PlacementModule && typeof window.PlacementModule.startLearning === 'function') {
                    safeCall(window.PlacementModule.startLearning.bind(window.PlacementModule));
                }
                return;
            }
            case 'placement-retake': {
                if (window.PlacementModule && typeof window.PlacementModule.retake === 'function') {
                    safeCall(window.PlacementModule.retake.bind(window.PlacementModule));
                }
                return;
            }
            case 'storage-import': {
                safeCall(window.Storage && window.Storage.importProgress);
                return;
            }
            case 'onboarding-show': {
                safeCall(window.OnboardingModule && window.OnboardingModule.show);
                return;
            }
            case 'onboarding-hide': {
                safeCall(window.OnboardingModule && window.OnboardingModule.hide);
                return;
            }
            case 'onboarding-next': {
                safeCall(window.OnboardingModule && window.OnboardingModule.nextStep);
                return;
            }
            case 'onboarding-prev': {
                safeCall(window.OnboardingModule && window.OnboardingModule.prevStep);
                return;
            }
            case 'onboarding-complete': {
                safeCall(window.OnboardingModule && window.OnboardingModule.complete);
                return;
            }
            case 'onboarding-start-placement': {
                if (window.OnboardingModule && typeof window.OnboardingModule.hide === 'function') {
                    safeCall(window.OnboardingModule.hide.bind(window.OnboardingModule));
                }
                if (window.Navigation && typeof window.Navigation.showSection === 'function') {
                    safeCall(window.Navigation.showSection.bind(window.Navigation), 'placement');
                }
                if (window.PlacementModule && typeof window.PlacementModule.start === 'function') {
                    safeCall(window.PlacementModule.start.bind(window.PlacementModule));
                }
                return;
            }
            case 'module-modal-show': {
                console.log('[ACTION]', action, {
                    APP_READY: window.APP_READY === true,
                    moduleId: el.getAttribute('data-module-id'),
                    hasModuleModal: !!window.ModuleModal,
                    dataLoaded: !!(window.DataLoader && window.DataLoader.isLoaded)
                });
                const moduleId = el.getAttribute('data-module-id') || (el.closest('[data-module-id]') && el.closest('[data-module-id]').getAttribute('data-module-id'));
                if (window.ModuleModal && typeof window.ModuleModal.show === 'function') {
                    safeCall(window.ModuleModal.show.bind(window.ModuleModal), moduleId);
                }
                return;
            }
            case 'module-modal-close': {
                if (window.ModuleModal && typeof window.ModuleModal.close === 'function') {
                    safeCall(window.ModuleModal.close.bind(window.ModuleModal));
                }
                return;
            }
            case 'module-modal-start': {
                const moduleId = el.getAttribute('data-module-id');
                if (window.ModuleModal && typeof window.ModuleModal.startModule === 'function') {
                    safeCall(window.ModuleModal.startModule.bind(window.ModuleModal), moduleId);
                }
                return;
            }
            case 'module-modal-view': {
                const view = el.getAttribute('data-view');
                if (window.ModuleModal && typeof window.ModuleModal.changeView === 'function') {
                    safeCall(window.ModuleModal.changeView.bind(window.ModuleModal), view);
                }
                return;
            }
            case 'module-exit': {
                const ok = confirm('Exit module? Your progress is saved.');
                if (ok && window.Navigation && typeof window.Navigation.showSection === 'function') {
                    safeCall(window.Navigation.showSection.bind(window.Navigation), 'guide');
                }
                return;
            }
            case 'module-prev': {
                if (window.ModuleLearning && typeof window.ModuleLearning.prevStep === 'function') {
                    safeCall(window.ModuleLearning.prevStep.bind(window.ModuleLearning));
                }
                return;
            }
            case 'module-next': {
                if (window.ModuleLearning && typeof window.ModuleLearning.nextStep === 'function') {
                    safeCall(window.ModuleLearning.nextStep.bind(window.ModuleLearning));
                }
                return;
            }
            case 'module-load-step': {
                const step = parseInt(el.getAttribute('data-step'), 10);
                if (Number.isFinite(step) && window.ModuleLearning && typeof window.ModuleLearning.loadStep === 'function') {
                    safeCall(window.ModuleLearning.loadStep.bind(window.ModuleLearning), step);
                }
                return;
            }
            case 'module-toggle-expandable': {
                if (window.ModuleLearning && typeof window.ModuleLearning.toggleExpandable === 'function') {
                    safeCall(window.ModuleLearning.toggleExpandable.bind(window.ModuleLearning), el);
                }
                return;
            }
            case 'module-toggle-example-analysis': {
                const idx = parseInt(el.getAttribute('data-example-index'), 10);
                if (Number.isFinite(idx) && window.ModuleLearning && typeof window.ModuleLearning.toggleExampleAnalysis === 'function') {
                    safeCall(window.ModuleLearning.toggleExampleAnalysis.bind(window.ModuleLearning), idx);
                }
                return;
            }
            case 'module-submit-activity': {
                const moduleId = el.getAttribute('data-module-id');
                const activityIndex = parseInt(el.getAttribute('data-activity-index'), 10);
                const activityId = el.getAttribute('data-activity-id');
                if (!moduleId || !Number.isFinite(activityIndex) || !activityId) return;
                if (window.ModuleLearning && typeof window.ModuleLearning.submitActivity === 'function') {
                    safeCall(window.ModuleLearning.submitActivity.bind(window.ModuleLearning), moduleId, activityIndex, activityId);
                }
                return;
            }
            case 'module-reset-activity': {
                const moduleId = el.getAttribute('data-module-id');
                const activityId = el.getAttribute('data-activity-id');
                if (!moduleId || !activityId) return;
                if (window.ModuleLearning && typeof window.ModuleLearning.resetActivity === 'function') {
                    safeCall(window.ModuleLearning.resetActivity.bind(window.ModuleLearning), moduleId, activityId);
                }
                return;
            }
            case 'module-save-reflection': {
                if (window.ModuleLearning && typeof window.ModuleLearning.saveReflection === 'function') {
                    safeCall(window.ModuleLearning.saveReflection.bind(window.ModuleLearning));
                }
                return;
            }
            case 'module-start': {
                const moduleId = el.getAttribute('data-module-id');
                if (window.ModuleLearning && typeof window.ModuleLearning.start === 'function') {
                    safeCall(window.ModuleLearning.start.bind(window.ModuleLearning), moduleId);
                }
                return;
            }
            case 'module-toggle-learn-more': {
                const idx = parseInt(el.getAttribute('data-question-index'), 10);
                if (Number.isFinite(idx) && window.ModuleLearning && typeof window.ModuleLearning.toggleLearnMore === 'function') {
                    safeCall(window.ModuleLearning.toggleLearnMore.bind(window.ModuleLearning), idx);
                }
                return;
            }
            case 'module-start-quick-review': {
                const moduleId = el.getAttribute('data-module-id');
                if (window.ModuleLearning && typeof window.ModuleLearning.startQuickReview === 'function') {
                    safeCall(window.ModuleLearning.startQuickReview.bind(window.ModuleLearning), moduleId);
                }
                return;
            }
            case 'module-dismiss-review': {
                const moduleId = el.getAttribute('data-module-id');
                if (window.ModuleLearning && typeof window.ModuleLearning.dismissReviewReminder === 'function') {
                    safeCall(window.ModuleLearning.dismissReviewReminder.bind(window.ModuleLearning), moduleId);
                }
                return;
            }
            case 'module-close-quick-review': {
                if (window.ModuleLearning && typeof window.ModuleLearning.closeQuickReview === 'function') {
                    safeCall(window.ModuleLearning.closeQuickReview.bind(window.ModuleLearning));
                }
                return;
            }
            case 'module-complete-quick-review': {
                const moduleId = el.getAttribute('data-module-id');
                if (window.ModuleLearning && typeof window.ModuleLearning.completeQuickReview === 'function') {
                    safeCall(window.ModuleLearning.completeQuickReview.bind(window.ModuleLearning), moduleId);
                }
                return;
            }
            case 'module-complete': {
                if (window.ModuleLearning && typeof window.ModuleLearning.completeModule === 'function') {
                    safeCall(window.ModuleLearning.completeModule.bind(window.ModuleLearning));
                }
                return;
            }
            case 'module-retake-module': {
                const moduleId = el.getAttribute('data-module-id');
                if (window.ModuleLearning && typeof window.ModuleLearning.retakeModule === 'function') {
                    safeCall(window.ModuleLearning.retakeModule.bind(window.ModuleLearning), moduleId);
                }
                return;
            }
            case 'activities-toggle-complete': {
                const activityId = el.getAttribute('data-activity-id');
                safeCall(window.ActivitiesModule && window.ActivitiesModule.toggleComplete, activityId);
                return;
            }
            case 'resource-tab': {
                const tab = el.getAttribute('data-tab');
                safeCall(window.ResourceTabs && window.ResourceTabs.switchTab, tab);
                return;
            }
            case 'learn-more-toggle': {
                const content = el.nextElementSibling;
                if (!content) return;
                const expanded = content.classList.toggle('expanded');
                el.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                return;
            }
            case 'reveal-answer': {
                const answer = el.nextElementSibling;
                if (answer) answer.classList.add('revealed');
                el.style.display = 'none';
                return;
            }
            case 'scaffold-toggle': {
                const cardId = el.getAttribute('data-card-id') || el.getAttribute('aria-controls');
                safeCall(window.PragmaticsScaffold && window.PragmaticsScaffold.toggle, cardId);
                return;
            }
            case 'quiz-select-level': {
                const level = el.getAttribute('data-level');
                if (window.QuizModule && typeof window.QuizModule.selectLevel === 'function') {
                    safeCall(window.QuizModule.selectLevel.bind(window.QuizModule), level);
                }
                return;
            }
            case 'quiz-check': {
                if (window.QuizModule && typeof window.QuizModule.checkAnswers === 'function') {
                    safeCall(window.QuizModule.checkAnswers.bind(window.QuizModule));
                }
                return;
            }
            case 'quiz-retry': {
                if (window.QuizModule && typeof window.QuizModule.retryQuiz === 'function') {
                    safeCall(window.QuizModule.retryQuiz.bind(window.QuizModule));
                }
                return;
            }
            case 'gtvh-check': {
                const kr = el.getAttribute('data-kr');
                safeCall(window.checkGTVHAnswer, kr);
                return;
            }
            case 'gtvh-hint': {
                const kr = el.getAttribute('data-kr');
                safeCall(window.showGTVHHint, kr);
                return;
            }
            case 'gtvh-model': {
                const kr = el.getAttribute('data-kr');
                safeCall(window.showGTVHModel, kr);
                return;
            }
            case 'gtvh-check-all': {
                safeCall(window.checkAllGTVH);
                return;
            }
            case 'gtvh-reset': {
                safeCall(window.resetGTVHForm);
                return;
            }
            case 'call-fn': {
                const fnName = el.getAttribute('data-fn');
                const allowed = new Set([
                    'checkSO1', 'checkSO2', 'checkLM1', 'checkLM2',
                    'checkSITA1', 'checkSITA2', 'checkNS1', 'checkNS2',
                    'checkLA1', 'checkLA2', 'checkComplete'
                ]);
                if (!fnName || !allowed.has(fnName)) {
                    console.warn('Blocked function call:', fnName);
                    return;
                }
                safeCall(window[fnName]);
                return;
            }
            default:
                console.warn('Unhandled action:', action, el);
        }
    }

    document.addEventListener('click', handleClick);

    document.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const el = closestActionTarget(event.target);
        if (!el) return;
        // Allow keyboard activation for role="button" elements.
        event.preventDefault();
        el.click();
    });
})();
