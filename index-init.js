/**
 * INDEX INIT
 *
 * Migrated from inline <script> blocks in index.html.
 */

(function() {
    'use strict';

    function initTheoryAccordion() {
        const accordionHeaders = document.querySelectorAll('.accordion-header[data-target]');
        accordionHeaders.forEach(function(header) {
            const targetId = header.getAttribute('data-target');
            const body = targetId ? document.getElementById(targetId) : null;
            if (body) {
                header.setAttribute('aria-expanded', 'false');
                body.setAttribute('aria-hidden', 'true');
            }
        });

        const theorySection = document.getElementById('theory');
        const trackedIds = ['theory-intro-body', 'pragmalinguistic-body', 'sociopragmatic-body', 'humor-theory-body', 'pragmatic-failure-body'];
        const theoryBodies = theorySection
            ? trackedIds.map(function(id) { return theorySection.querySelector('#' + id); }).filter(Boolean)
            : [];
        const theoryHeaders = theorySection
            ? theoryBodies.map(function(body) { return theorySection.querySelector('.accordion-header[data-target=\"' + body.id + '\"]'); }).filter(Boolean)
            : [];
        const toggleAllBtn = document.getElementById('theory-toggle-all');
        const progressText = document.getElementById('theory-progress-text');

        function setBodyState(section, body, open) {
            body.classList.toggle('open', open);
            body.setAttribute('aria-hidden', open ? 'false' : 'true');
            if (section) {
                const header = section.querySelector('.accordion-header[data-target="' + body.id + '"]');
                if (header) {
                    header.setAttribute('aria-expanded', open ? 'true' : 'false');
                }
            }
        }

        function updateProgress() {
            if (!theorySection || !progressText) return;
            const openCount = theoryBodies.filter(function(b) { return b.classList.contains('open'); }).length;
            progressText.textContent = 'Theory ' + openCount + '/' + theoryBodies.length + ' completed';
            if (toggleAllBtn) {
                const allOpen = theoryBodies.length > 0 && openCount === theoryBodies.length;
                toggleAllBtn.textContent = allOpen ? 'Collapse all' : 'Expand all';
                toggleAllBtn.setAttribute('data-state', allOpen ? 'open' : 'closed');
            }
        }

        document.addEventListener('click', function(e) {
            const header = e.target.closest('.accordion-header[data-target]');
            if (!header) return;

            const targetId = header.getAttribute('data-target');
            const body = targetId ? document.getElementById(targetId) : null;
            if (!body) return;

            const section = header.closest('.content-section') || document;
            const isOpen = body.classList.contains('open');

            section.querySelectorAll('.accordion-body.open').forEach(function(openBody) {
                setBodyState(section, openBody, false);
            });
            section.querySelectorAll('.accordion-header[data-target]').forEach(function(h) {
                h.setAttribute('aria-expanded', 'false');
            });

            if (!isOpen) {
                setBodyState(section, body, true);
            }

            if (section === theorySection) {
                updateProgress();
            }
        });

        if (toggleAllBtn && theorySection) {
            toggleAllBtn.addEventListener('click', function() {
                const shouldOpen = toggleAllBtn.getAttribute('data-state') !== 'open';
                theoryBodies.forEach(function(body) {
                    setBodyState(theorySection, body, shouldOpen);
                });
                theoryHeaders.forEach(function(header) {
                    header.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
                });
                updateProgress();
            });
        }

        document.querySelectorAll('.theory-continue-btn').forEach(function(btn) {
            btn.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                if (!theorySection) return;
                const nextId = btn.getAttribute('data-next');
                if (nextId) {
                    const nextHeader = theorySection.querySelector('.accordion-header[data-target="' + nextId + '"]');
                    if (nextHeader) {
                        nextHeader.click();
                        nextHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                } else {
                    theoryBodies.forEach(function(body) { setBodyState(theorySection, body, false); });
                    theoryHeaders.forEach(function(header) { header.setAttribute('aria-expanded', 'false'); });
                    updateProgress();
                }
            });
        });

        updateProgress();
    }

    function forceHideOnboardingModal() {
        const modal = document.getElementById('onboarding-modal');
        if (!modal) return;
        modal.classList.remove('show');
        modal.style.display = 'none';
    }

    document.addEventListener('DOMContentLoaded', function() {
        if (typeof ModuleLearning !== 'undefined') {
            window.ModuleLearning = ModuleLearning;
        }

        initTheoryAccordion();
        forceHideOnboardingModal();

        const teacherModeToggle = document.getElementById('teacher-mode-toggle');
        if (teacherModeToggle) {
            teacherModeToggle.addEventListener('change', function() {
                if (typeof window.toggleTeacherMode === 'function') {
                    window.toggleTeacherMode();
                }
            });
        }

        // Hide the local progress warning banner if the user dismissed it.
        try {
            const dismissed = localStorage.getItem('dismissedProgressNotice') === '1';
            const banner = document.getElementById('local-progress-warning-banner');
            if (dismissed && banner) banner.style.display = 'none';
        } catch (e) {
            // ignore
        }
    });
})();
