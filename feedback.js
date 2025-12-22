(function() {
    'use strict';

    // Constants
    const FORMSUBMIT_TOKEN = 'e608f0edcc5416702821e0cb7129580e';
    const FORM_SUBMIT_ENDPOINT = `https://formsubmit.co/ajax/${FORMSUBMIT_TOKEN}`;
    const MAX_NAME_LENGTH = 100;
    const MAX_EMAIL_LENGTH = 254;
    const MAX_MESSAGE_LENGTH = 5000;

    // DOM Elements
    const form = document.getElementById('feedback-form');
    if (!form) {
        console.warn('[Feedback] Form not found');
        return;
    }

    const submitBtn = document.getElementById('feedback-submit-btn');
    const statusSpan = document.getElementById('feedback-status');
    const resultDiv = document.getElementById('feedback-result');
    const nameInput = document.getElementById('feedback-name');
    const emailInput = document.getElementById('feedback-email');
    const typeInput = document.getElementById('feedback-type');
    const messageInput = document.getElementById('feedback-message');
    const honeypotInput = document.getElementById('feedback-honeypot');
// -------------------------------
// 🌐 Global language state (ADD HERE)
// -------------------------------
let currentLanguage = localStorage.getItem('preferredLanguage') || 'en';
function isUzbekLanguage() {
    return currentLanguage === 'uz';
}
    if (!submitBtn || !statusSpan || !resultDiv || !nameInput || !messageInput || !typeInput) {
        console.error('[Feedback] Required form elements not found');
        return;
    }

    // Store original button text
    const originalButtonText = submitBtn.textContent;
    // -------------------------------
    // Language adaptation for the form
    // -------------------------------
    const preferredLanguage = (localStorage.getItem('preferredLanguage') || 'en');
    applyFeedbackLanguage(preferredLanguage);
        // React when the user clicks ENG / UZB buttons
    const languageToggle = document.getElementById('language-toggle');
    if (languageToggle) {
        languageToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.lang-btn');
            if (!btn) return;

            const lang = btn.dataset.lang || 'en';

            // Update the form texts immediately
            applyFeedbackLanguage(lang);
        });
    }


    function applyFeedbackLanguage(lang) {
        const isUzbek = lang === 'uz';

        form.setAttribute('lang', isUzbek ? 'uz' : 'en');

        const nameLabel    = form.querySelector('label[for="feedback-name"]');
        const emailLabel   = form.querySelector('label[for="feedback-email"]');
        const typeLabel    = form.querySelector('label[for="feedback-type"]');
        const messageLabel = form.querySelector('label[for="feedback-message"]');
        const helperEm     = form.querySelector('p em');

        if (!nameLabel || !emailLabel || !typeLabel || !messageLabel) {
            console.warn('[Feedback] Could not find some labels for i18n');
            return;
        }

        if (isUzbek) {
            // UZBEK TEXTS (your current ones)
            nameLabel.textContent    = "Ismingiz *";
            nameInput.placeholder    = "Ismingizni kiriting";

            emailLabel.textContent   = "Elektron pochtangiz (javob uchun ixtiyoriy)";
            if (emailInput) {
                emailInput.placeholder = "sizning.emailingiz@example.com";
            }

            typeLabel.textContent    = "Fikr-mulohaza turi *";
            if (typeInput && typeInput.options.length >= 7) {
                typeInput.options[0].textContent = "Mavzuni tanlang.";
                typeInput.options[1].textContent = "🐛 Xatolik haqida xabar";
                typeInput.options[2].textContent = "💡 Yangi funksiya so'rovi";
                typeInput.options[3].textContent = "📚 Kontent taklifi";
                typeInput.options[4].textContent = "💬 Umumiy fikr-mulohaza";
                typeInput.options[5].textContent = "⚙️ Texnik muammo";
                typeInput.options[6].textContent = "📝 Boshqa";
            }

            messageLabel.textContent = "Xabaringiz *";
            messageInput.placeholder = "Bu yerda batafsil fikr-mulohazalaringizni yozing.";

            if (helperEm) {
                helperEm.textContent =
                    "Ushbu platforma ta'lim maqsadlarida foydalanish uchun mo'ljallangan. " +
                    "Iltimos, fikr-mulohazalaringizni hurmatli, akademik muhitga mos va o'rganishga qaratilgan holda saqlang.";
            }

            submitBtn.textContent = "📤 Fikr-mulohazani yuborish";

        } else {
            // ENGLISH TEXTS
            nameLabel.textContent    = "Your name *";
            nameInput.placeholder    = "Enter your name";

            emailLabel.textContent   = "Email address (optional, for reply)";
            if (emailInput) {
                emailInput.placeholder = "your.email@example.com";
            }

            typeLabel.textContent    = "Feedback type *";
            if (typeInput && typeInput.options.length >= 7) {
                typeInput.options[0].textContent = "Select a topic...";
                typeInput.options[1].textContent = "🐛 Bug report";
                typeInput.options[2].textContent = "💡 Feature request";
                typeInput.options[3].textContent = "📚 Content suggestion";
                typeInput.options[4].textContent = "💬 General feedback";
                typeInput.options[5].textContent = "⚙️ Technical issue";
                typeInput.options[6].textContent = "📝 Other";
            }

            messageLabel.textContent = "Your message *";
            messageInput.placeholder = "Write your feedback here in as much detail as possible.";

            if (helperEm) {
                helperEm.textContent =
                    "This platform is intended for educational use. Please keep your feedback " +
                    "respectful, appropriate for an academic environment, and focused on learning.";
            }

            submitBtn.textContent = "📤 Send feedback";
        }
    }

    console.info('[Feedback] Form initialized. FormSubmit is activated and ready.');

    // Form submission handler
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Check honeypot (spam protection)
        if (honeypotInput && honeypotInput.value.trim() !== '') {
            console.warn('[Feedback] Honeypot triggered - bot submission blocked');
            showSuccess();
            form.reset();
            return;
        }

        // Get and sanitize inputs
        const name = sanitizeInput(nameInput.value, MAX_NAME_LENGTH);
        const email = emailInput ? sanitizeInput(emailInput.value, MAX_EMAIL_LENGTH) : '';
        const feedbackType = typeInput.value;
        const message = sanitizeInput(messageInput.value, MAX_MESSAGE_LENGTH);

        // Validate required fields
        if (!name || !feedbackType || !message) {
            const isUzbek = (localStorage.getItem('preferredLanguage') || 'en') === 'uz';
            const errorMsg = isUzbek
                ? 'Iltimos, barcha majburiy maydonlarni to\'ldiring.'
                : 'Please fill in all required fields.';
            showMessage('error', errorMsg);
            return;
        }

        // Validate email if provided
        if (email && !isValidEmail(email)) {
            const isUzbek = (localStorage.getItem('preferredLanguage') || 'en') === 'uz';
            const errorMsg = isUzbek
                ? 'Iltimos, to\'g\'ri elektron pochta manzilini kiriting yoki bo\'sh qoldiring.'
                : 'Please enter a valid email address or leave it blank.';
            showMessage('error', errorMsg);
            return;
        }

        // Start submission
        setSubmitState('sending');

        try {
            const payload = buildPayload({ name, email, feedbackType, message });
            console.info('[FormSubmit] Sending to:', FORM_SUBMIT_ENDPOINT);
            const success = await sendToFormSubmit(payload);

            if (success) {
                showSuccess();
                form.reset();
            } else {
                showError(message);
            }
        } catch (error) {
            console.error('[Feedback] Unexpected error:', error);
            showError(message);
        } finally {
            setSubmitState('idle');
        }
    });

    /**
     * Send form data to FormSubmit AJAX endpoint
     */
    async function sendToFormSubmit(payload) {
        try {
            const response = await fetch(FORM_SUBMIT_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            // Get response text for diagnostics
            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('[FormSubmit] JSON parse error:', parseError);
                result = null;
            }

            // Log full response for diagnostics
            console.info('[FormSubmit] Response received:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                result: result,
                responseText: responseText.substring(0, 500)
            });

            // Check for errors first
            if (!response.ok) {
                console.error('[FormSubmit] Request failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    responseText: responseText,
                    headers: Object.fromEntries(response.headers.entries())
                });
                return false;
            }

            // Check FormSubmit success response
            // FormSubmit returns: {"success": "true", "message": "..."}
            if (result && (result.success === 'true' || result.success === true)) {
                console.info('[FormSubmit] ✅ Submission successful!');
                return true;
            }

            // Fallback: if status is 2xx and we got valid JSON, assume success
            if (response.ok && result !== null) {
                console.warn('[FormSubmit] Assuming success based on 2xx status (response format may have changed)');
                return true;
            }

            console.error('[FormSubmit] Unexpected response format:', {
                status: response.status,
                result: result,
                responseText: responseText
            });
            return false;

        } catch (error) {
            console.error('[FormSubmit] Network or fetch error:', {
                error: error.message,
                name: error.name,
                stack: error.stack
            });
            return false;
        }
    }

    /**
     * Build FormSubmit payload
     */
    function buildPayload(data) {
        const payload = {
            name: data.name,
            message: data.message,
            feedback_type: data.feedbackType,
            page: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            _subject: 'Platform Feedback',
            _template: 'table',
            _captcha: 'false'
        };

        // Add optional email if provided
        if (data.email) {
            payload.email = data.email;
            payload._replyto = data.email;
        }

        return payload;
    }

    /**
     * Sanitize user input: trim and limit length
     */
    function sanitizeInput(value, maxLength) {
        if (!value) return '';
        return value.trim().substring(0, maxLength);
    }

    /**
     * Simple email validation
     */
    function isValidEmail(email) {
        if (!email) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Set submit button and status state
     */
    function setSubmitState(state) {
        const isUzbek = (localStorage.getItem('preferredLanguage') || 'en') === 'uz';
        switch (state) {
            case 'sending':
                submitBtn.disabled = true;
                submitBtn.textContent = isUzbek ? 'Yuborilmoqda...' : 'Sending...';
                statusSpan.textContent = isUzbek ? 'Sizning fikringiz yuborilmoqda...' : 'Submitting your feedback...';
                statusSpan.style.color = '#3b82f6';
                clearResult();
                break;
            case 'idle':
                submitBtn.disabled = false;
                submitBtn.textContent = originalButtonText;
                statusSpan.textContent = '';
                break;
        }
    }

    /**
     * Show success message
     */
    function showSuccess() {
        const isUzbek = (localStorage.getItem('preferredLanguage') || 'en') === 'uz';
        const message = isUzbek 
            ? 'Rahmat! Sizning fikringiz muvaffaqiyatli yuborildi. ✅'
            : 'Thank you! Your feedback has been sent successfully. ✅';
        showMessage('success', message);
    }

    /**
     * Show error message with copy button
     */
    function showError(originalMessage) {
        const isUzbek = (localStorage.getItem('preferredLanguage') || 'en') === 'uz';
        const messageText = isUzbek
            ? 'Hozir yuborib bo\'lmadi. Iltimos, qayta urinib ko\'ring.'
            : "Couldn't send right now. Please try again.";
        showMessage('error', messageText, {
            showCopyButton: true,
            messageToCopy: originalMessage
        });
    }

    /**
     * Display message with optional copy button
     */
    function showMessage(type, text, options = {}) {
        const colors = {
            success: { bg: '#d1fae5', border: '#10b981', text: '#047857' },
            error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
            info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' }
        };

        const style = colors[type] || colors.info;

        // Clear and style result div
        resultDiv.innerHTML = '';
        resultDiv.style.cssText = `
            padding: 16px;
            background: ${style.bg};
            border: 1px solid ${style.border};
            border-radius: 8px;
            margin-top: 16px;
            display: block;
        `;

        // Create message paragraph
        const messagePara = document.createElement('p');
        messagePara.style.cssText = 'margin: 0; color: ' + style.text + '; font-weight: 500;';
        messagePara.textContent = text;
        resultDiv.appendChild(messagePara);

        // Add copy button if requested
        if (options.showCopyButton && options.messageToCopy) {
            const isUzbek = (localStorage.getItem('preferredLanguage') || 'en') === 'uz';
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.textContent = isUzbek ? '📋 Xabarni nusxalash' : '📋 Copy Message';
            copyBtn.style.cssText = `
                margin-top: 12px;
                padding: 8px 16px;
                background: white;
                border: 1px solid ${style.border};
                border-radius: 6px;
                color: ${style.text};
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
            `;

            copyBtn.addEventListener('click', function() {
                copyToClipboard(options.messageToCopy);
                const isUzbek = (localStorage.getItem('preferredLanguage') || 'en') === 'uz';
                copyBtn.textContent = isUzbek ? '✅ Nusxalandi!' : '✅ Copied!';
                setTimeout(function() {
                    const isUzbek = (localStorage.getItem('preferredLanguage') || 'en') === 'uz';
                    copyBtn.textContent = isUzbek ? '📋 Xabarni nusxalash' : '📋 Copy Message';
                }, 2000);
            });

            resultDiv.appendChild(copyBtn);
        }

        resultDiv.style.display = 'block';
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Copy text to clipboard
     */
    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(function(err) {
                console.error('[Feedback] Clipboard copy failed:', err);
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    /**
     * Fallback clipboard copy using textarea
     */
    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('[Feedback] Fallback copy failed:', err);
        }
        document.body.removeChild(textarea);
    }

    /**
     * Clear result div
     */
    function clearResult() {
        resultDiv.style.display = 'none';
        resultDiv.innerHTML = '';
    }
})();
