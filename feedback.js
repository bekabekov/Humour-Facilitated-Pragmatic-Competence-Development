(function () {
    'use strict';

    // ====== CONFIG ======
    const FORMSUBMIT_TOKEN = 'e608f0edcc5416702821e0cb7129580e';
    const FORM_SUBMIT_ENDPOINT = `https://formsubmit.co/ajax/${FORMSUBMIT_TOKEN}`;
    const MAX_NAME_LENGTH = 100;
    const MAX_EMAIL_LENGTH = 254;
    const MAX_MESSAGE_LENGTH = 5000;

    // ====== DOM ELEMENTS ======
    const form = document.getElementById('feedback-form');
    if (!form) {
        console.warn('[Feedback] Form not found');
        return;
    }

    const submitBtn    = document.getElementById('feedback-submit-btn');
    const statusSpan   = document.getElementById('feedback-status');
    const resultDiv    = document.getElementById('feedback-result');
    const nameInput    = document.getElementById('feedback-name');
    const emailInput   = document.getElementById('feedback-email');
    const typeInput    = document.getElementById('feedback-type');
    const messageInput = document.getElementById('feedback-message');
    const honeypotInput = document.getElementById('feedback-honeypot');

    if (!submitBtn || !statusSpan || !resultDiv || !nameInput || !messageInput || !typeInput) {
        console.error('[Feedback] Required form elements not found');
        return;
    }

    const originalButtonText = submitBtn.textContent;

    // === feedback card (заголовок + синий параграф) ===
    const feedbackBox = form.closest('.theory-box');
    const feedbackHeading = feedbackBox
        ? (feedbackBox.querySelector('h3[lang="en"]') ||
           feedbackBox.querySelector('h3[lang="uz"]') ||
           feedbackBox.querySelector('h3'))
        : null;

    const feedbackIntro = feedbackBox
        ? (feedbackBox.querySelector('p[lang="en"]') ||
           feedbackBox.querySelector('p[lang="uz"]') ||
           feedbackBox.querySelector('p'))
        : null;

    // ====== GLOBAL LANGUAGE STATE ======
    let currentLanguage = localStorage.getItem('preferredLanguage') || 'en';
    function isUzbekLanguage() {
        return currentLanguage === 'uz';
    }

    console.info('[Feedback] Form initialized. FormSubmit is activated and ready.');

    // ====== LANGUAGE APPLY ======
    function applyFeedbackLanguage(lang) {
        currentLanguage = lang || 'en';
        localStorage.setItem('preferredLanguage', currentLanguage);

        const isUzbek = isUzbekLanguage();
        form.setAttribute('lang', isUzbek ? 'uz' : 'en');

        // --- Заголовок и синий текст ---
        if (feedbackHeading && feedbackIntro) {
            if (isUzbek) {
                feedbackHeading.textContent = "📝 Fikr va mulohazalaringiz bilan bo'lishing";
                feedbackIntro.textContent =
                    "Sizning fikr va mulohazalaringiz platformani yanada takomillashtirishda biz uchun katta ahamiyatga ega. " +
                    "Loyiha bo'yicha o'z takliflaringizni bildiring yoki foydalanish jarayonida duch kelgan texnik muammolar va kamchiliklar haqida bizga xabar bering.";
            } else {
                feedbackHeading.textContent = "📝 Share Your Feedback";
                feedbackIntro.textContent =
                    "We value your input! Please share your thoughts, suggestions, or report any issues you encounter.";
            }
        }

        // --- Лейблы и плейсхолдеры формы ---
        const nameLabel    = form.querySelector('label[for="feedback-name"]');
        const emailLabel   = form.querySelector('label[for="feedback-email"]');
        const typeLabel    = form.querySelector('label[for="feedback-type"]');
        const messageLabel = form.querySelector('label[for="feedback-message"]');
        const helperEm     = form.querySelector('p em');

        if (!nameLabel || !emailLabel || !typeLabel || !messageLabel) {
            console.warn('[Feedback] Some labels not found for i18n');
        }

        if (isUzbek) {
            if (nameLabel)    nameLabel.textContent    = "Ismingiz *";
            nameInput.placeholder = "Ismingizni kiriting";

            if (emailLabel)   emailLabel.textContent   = "Elektron pochtangiz (javob uchun ixtiyoriy)";
            if (emailInput)   emailInput.placeholder   = "sizning.emailingiz@example.com";

            if (typeLabel)    typeLabel.textContent    = "Fikr-mulohaza turi *";
            if (typeInput && typeInput.options.length >= 7) {
                typeInput.options[0].textContent = "Mavzuni tanlang...";
                typeInput.options[1].textContent = "🐛 Xatolik haqida xabar";
                typeInput.options[2].textContent = "💡 Yangi funksiya so'rovi";
                typeInput.options[3].textContent = "📚 Kontent taklifi";
                typeInput.options[4].textContent = "💬 Umumiy fikr-mulohaza";
                typeInput.options[5].textContent = "⚙️ Texnik muammo";
                typeInput.options[6].textContent = "📝 Boshqa";
            }

            if (messageLabel) messageLabel.textContent = "Xabaringiz *";
            messageInput.placeholder =
                "Bu yerda batafsil fikr-mulohazalaringizni yozing...";

            if (helperEm) {
                helperEm.textContent =
                    "Ushbu platforma ta'lim maqsadlarida foydalanish uchun mo'ljallangan. " +
                    "Iltimos, fikr-mulohazalaringizni hurmatli, akademik muhitga mos va o'rganishga qaratilgan holda saqlang.";
            }

            submitBtn.textContent = "📤 Fikr-mulohazani yuborish";
        } else {
            if (nameLabel)    nameLabel.textContent    = "Your name *";
            nameInput.placeholder = "Enter your name";

            if (emailLabel)   emailLabel.textContent   = "Email address (optional, for reply)";
            if (emailInput)   emailInput.placeholder   = "your.email@example.com";

            if (typeLabel)    typeLabel.textContent    = "Feedback type *";
            if (typeInput && typeInput.options.length >= 7) {
                typeInput.options[0].textContent = "Select a topic...";
                typeInput.options[1].textContent = "🐛 Bug report";
                typeInput.options[2].textContent = "💡 Feature request";
                typeInput.options[3].textContent = "📚 Content suggestion";
                typeInput.options[4].textContent = "💬 General feedback";
                typeInput.options[5].textContent = "⚙️ Technical issue";
                typeInput.options[6].textContent = "📝 Other";
            }

            if (messageLabel) messageLabel.textContent = "Your message *";
            messageInput.placeholder =
                "Write your feedback here in as much detail as possible.";

            if (helperEm) {
                helperEm.textContent =
                    "This platform is intended for educational use. Please keep your feedback " +
                    "respectful, appropriate for an academic environment, and focused on learning.";
            }

            submitBtn.textContent = "📤 Send feedback";
        }

        // Если сейчас уже показано успешное сообщение – перерисовать его на новом языке
        if (resultDiv && resultDiv.style.display === 'block' && resultDiv.dataset.type === 'success') {
            showSuccess(); // переиспользуем функцию ниже
        }
    }

    // применяем язык при загрузке
    applyFeedbackLanguage(currentLanguage);

    // слушаем переключатель языка
    const languageToggle = document.getElementById('language-toggle');
    if (languageToggle) {
        languageToggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.lang-btn');
            if (!btn) return;
            const lang = btn.dataset.lang || 'en';
            applyFeedbackLanguage(lang);
        });
    }

    // ====== FORM SUBMIT ======
    form.addEventListener('submit', async function (e) {
        e.preventDefault();

        // honeypot
        if (honeypotInput && honeypotInput.value.trim() !== '') {
            console.warn('[Feedback] Honeypot triggered - bot submission blocked');
            showSuccess();
            form.reset();
            return;
        }

        const name  = sanitizeInput(nameInput.value, MAX_NAME_LENGTH);
        const email = emailInput ? sanitizeInput(emailInput.value, MAX_EMAIL_LENGTH) : '';
        const type  = typeInput.value;
        const msg   = sanitizeInput(messageInput.value, MAX_MESSAGE_LENGTH);

        if (!name || !type || !msg) {
            const isUzbek = isUzbekLanguage();
            const errorMsg = isUzbek
                ? "Iltimos, barcha majburiy maydonlarni to'ldiring."
                : "Please fill in all required fields.";
            showMessage('error', errorMsg);
            return;
        }

        if (email && !isValidEmail(email)) {
            const isUzbek = isUzbekLanguage();
            const errorMsg = isUzbek
                ? "Iltimos, to'g'ri elektron pochta manzilini kiriting."
                : "Please enter a valid email address.";
            showMessage('error', errorMsg);
            return;
        }

        const payload = {
            name,
            email,
            type,
            message: msg,
            _subject: 'New feedback from LearnWithHumour platform',
            _template: 'box'
        };

        await submitFeedback(payload);
    });

    // ====== SUBMIT & MESSAGES ======
    async function submitFeedback(payload) {
        setSubmitState('sending');

        try {
            const res = await fetch(FORM_SUBMIT_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                throw new Error('Network response was not ok');
            }

            showSuccess();
            form.reset();
        } catch (err) {
            console.error('[Feedback] Submission error:', err);
            const isUzbek = isUzbekLanguage();
            const errorMsg = isUzbek
                ? "Kutilmagan xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring."
                : "An unexpected error occurred. Please try again later.";
            showMessage('error', errorMsg);
        } finally {
            setSubmitState('idle');
        }
    }

    function setSubmitState(state) {
        const isUzbek = isUzbekLanguage();
        if (state === 'sending') {
            submitBtn.disabled = true;
            submitBtn.textContent = isUzbek ? 'Yuborilmoqda...' : 'Sending...';
            statusSpan.textContent = isUzbek
                ? 'Sizning fikringiz yuborilmoqda...'
                : 'Submitting your feedback...';
            statusSpan.style.color = '#3b82f6';
            clearResult();
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = originalButtonText;
            statusSpan.textContent = '';
        }
    }

    function showSuccess() {
        const isUzbek = isUzbekLanguage();
        const msg = isUzbek
            ? "Rahmat! Sizning fikringiz muvaffaqiyatli yuborildi. ✅"
            : "Thank you! Your feedback has been sent successfully. ✅";
        showMessage('success', msg);
    }

    function showMessage(type, text) {
        if (!resultDiv) return;

        resultDiv.dataset.type = type;
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '';

        const p = document.createElement('p');
        p.textContent = text;
        p.style.margin = '0';
        p.style.padding = '12px 16px';
        p.style.borderRadius = '8px';
        p.style.fontSize = '0.95rem';
        p.style.lineHeight = '1.5';

        if (type === 'success') {
            p.style.backgroundColor = '#dcfce7';
            p.style.color = '#166534';
            p.style.border = '1px solid #22c55e';
        } else {
            p.style.backgroundColor = '#fee2e2';
            p.style.color = '#b91c1c';
            p.style.border = '1px solid #f97373';
        }

        resultDiv.appendChild(p);
    }

    // ====== UTILS ======
    function sanitizeInput(value, maxLength) {
        if (!value) return '';
        let cleaned = value.replace(/<[^>]*>/g, '');
        cleaned = cleaned.substring(0, maxLength);
        return cleaned.trim();
    }

    function isValidEmail(email) {
        if (!email) return true;
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    function clearResult() {
        if (!resultDiv) return;
        resultDiv.style.display = 'none';
        resultDiv.innerHTML = '';
        delete resultDiv.dataset.type;
    }
})();
