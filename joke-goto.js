(function() {
    function initJokeGoto() {
        var gotoInput = document.getElementById('joke-goto-input');
        var gotoBtn = document.getElementById('joke-goto-btn');
        
        if (!gotoInput || !gotoBtn) return;
        
        gotoBtn.addEventListener('click', function() {
            var n = parseInt(gotoInput.value, 10);
            var total = (window.DATA && window.DATA.jokes) ? window.DATA.jokes.length : 57;
            if (n >= 1 && n <= total) {
                window.JokeModule.renderJoke(n - 1);
                var jokeSection = document.getElementById('joke');
                if (jokeSection) {
                    jokeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                gotoInput.value = '';
            } else {
                alert('Enter 1-' + total);
            }
        });
        
        gotoInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                gotoBtn.click();
            }
        });
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initJokeGoto);
    } else {
        initJokeGoto();
    }
})();