// TypeFast - Main Application JavaScript

class TypingTest {
    constructor() {
        this.currentParagraph = '';
        this.currentPosition = 0;
        this.startTime = null;
        this.endTime = null;
        this.isTestActive = false;
        this.errors = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this.wpmHistory = [];
        this.accuracyHistory = [];
        this.soundEnabled = true;
        this.currentTheme = 'coast';
        this.testSettings = {
            mode: 'words',
            timeLimit: 30,
            wordCount: 25,
            language: 'english'
        };
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.charStates = [];
        this.hasAutoScrolled = false;
        this.timerStatEl = null;
        this.charElements = [];
        this.revealObserver = null;
        this.activeTimer = null;
        this.currentPage = 'home';
        this.lastCursorIndex = null;
    this.availableThemes = ['coast', 'harbor', 'nebula', 'ember', 'light', 'dark'];
    // Perf instrumentation (key-to-DOM latency)
    this.perf = { enabled: true, samples: [], maxSamples: 120, lastKeyTs: 0, chipEl: null };
        this.activeAnimations = new Map();
        this.boundGlobalKeydown = null;
        // Idle/timer management
        this.idleTimeoutId = null;
        this.idlePauseMs = 5000; // pause timer if no keys for 5s
    this.isTimerPaused = false;
    this.timeLeft = null; // seconds remaining (time mode)
    // Low-latency: batch stats/UI updates off the hot path
    this.statsIntervalMs = 120;
    this._statsTimerId = null;
        // Preload typing feedback audio
        this.correctAudio = new Audio('assets/audio/right word.mp3');
        this.wrongAudio = new Audio('assets/audio/wrong word.wav');
        try {
            this.correctAudio.preload = 'auto';
            this.wrongAudio.preload = 'auto';
            // Slightly boosted default volume for audibility
            this.correctAudio.volume = 0.5;
            this.wrongAudio.volume = 0.6;
        } catch (_) { /* no-op */ }
        // Audio echo/overlap control
    this.soundClipMs = { correct: 180, wrong: 250 }; // trim playback to short, audible clicks
    this.soundRateLimits = { correct: 50, wrong: 120 }; // min gap between plays per type (ms)
        this.lastSoundTime = { correct: 0, wrong: 0 };
        this.maxPolyphony = 4; // limit overlapping instances
        this.activeSounds = new Set();
        
        this.initializeApp();
    }

    initializeApp() {
        this.timerStatEl = document.querySelector('[data-stat="timer"]');
        this.loadSettings();
        this.setupEventListeners();
        this.syncControlsWithSettings();
        this.updateModeUI();
        this.resetTest();
    this.setupScrollAnimations();
    this.setupParallax();

    // Respect deep links (e.g., index.html#test) on first load
    const hash = (window.location.hash || '').replace(/^#/, '');
    const targetId = hash && document.getElementById(`${hash}-page`) ? hash : 'home';
    this.showPage(targetId);
        
        // Ensure test content is visible immediately
        setTimeout(() => {
            if (!this.currentParagraph) {
                this.currentParagraph = "The quick brown fox jumps over the lazy dog. This pangram contains every letter of the alphabet and is perfect for typing practice. Start typing to begin your test!";
                this.renderTextDisplay();
            }
        }, 100);
    }

    setupEventListeners() {
        if (!this.boundGlobalKeydown) {
            this.boundGlobalKeydown = (event) => this.handleGlobalKeydown(event);
            window.addEventListener('keydown', this.boundGlobalKeydown);
        }

        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = e.currentTarget.getAttribute('href') || '';
                // Only hijack in-page links starting with '#'
                if (href.startsWith('#')) {
                    e.preventDefault();
                    const target = href.substring(1);
                    this.toggleThemeSelector(false);
                    this.showPage(target);
                } else {
                    // Allow normal navigation for external pages like games.html
                    this.toggleThemeSelector(false);
                }
            });
        });

        // Typing input
        const typingInput = document.getElementById('typing-input');
        if (typingInput) {
            typingInput.addEventListener('input', (e) => this.handleInput(e));
            typingInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        }

        // Settings
        document.getElementById('time-select')?.addEventListener('change', (e) => {
            this.testSettings.timeLimit = parseInt(e.target.value);
            this.resetTest();
            this.saveSettings();
        });

        document.getElementById('words-select')?.addEventListener('change', (e) => {
            this.testSettings.wordCount = parseInt(e.target.value);
            this.resetTest();
            this.saveSettings();
        });

        document.getElementById('mode-select')?.addEventListener('change', (e) => {
            this.testSettings.mode = e.target.value;
            this.updateModeUI();
            this.resetTest();
            this.saveSettings();
        });

        document.querySelectorAll('.mode-option').forEach(button => {
            button.addEventListener('click', () => {
                const mode = button.dataset.mode;
                if (mode && mode !== this.testSettings.mode) {
                    this.testSettings.mode = mode;
                    const modeSelect = document.getElementById('mode-select');
                    if (modeSelect) {
                        modeSelect.value = mode;
                    }
                    this.updateModeUI();
                    this.resetTest();
                    this.saveSettings();
                }
            });
        });

        document.getElementById('language-select')?.addEventListener('change', (e) => {
            this.testSettings.language = e.target.value;
            this.resetTest();
            this.saveSettings();
        });

        // Sound toggle
        document.getElementById('sound-toggle')?.addEventListener('click', () => {
            this.toggleSound();
            // Ensure typing remains automatic after toggling sound
            if (this.currentPage === 'test') {
                setTimeout(() => document.getElementById('typing-input')?.focus({ preventScroll: true }), 0);
            }
        });

        // Theme toggle
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            this.toggleThemeSelector();
        });

        document.querySelector('.theme-close')?.addEventListener('click', () => {
            this.toggleThemeSelector(false);
        });

        // Theme options
        document.querySelectorAll('.theme-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                this.changeTheme(theme);
            });
        });

        // Control buttons
        document.getElementById('restart-btn')?.addEventListener('click', () => {
            this.resetTest();
        });

        document.getElementById('next-btn')?.addEventListener('click', () => {
            this.nextParagraph();
        });

        // Focus typing input when clicking on text display
        document.getElementById('text-display')?.addEventListener('click', () => {
            this.setSettingsBarHidden(false);
            document.getElementById('typing-input')?.focus();
        });

        // Also unhide when clicking within the test container background
        document.querySelector('.test-container')?.addEventListener('click', (e) => {
            // Avoid toggling when clicking on buttons or selects inside the settings bar
            const bar = document.querySelector('.settings-bar');
            if (bar && bar.contains(e.target)) return;
            if (this.currentPage === 'test') {
                this.setSettingsBarHidden(false);
            }
        });

        // Unhide the settings bar when the pointer moves over the test area (no click required)
        const testContainer = document.querySelector('.test-container');
        if (testContainer) {
            const onPointerReveal = (e) => {
                if (this.currentPage !== 'test') return;
                // Ignore moves originating from the settings bar itself
                const bar = document.querySelector('.settings-bar');
                if (bar && bar.contains(e.target)) return;
                this.setSettingsBarHidden(false);
            };
            testContainer.addEventListener('pointermove', onPointerReveal, { passive: true });
            testContainer.addEventListener('mousemove', onPointerReveal, { passive: true });
            testContainer.addEventListener('mouseenter', onPointerReveal, { passive: true });
            testContainer.addEventListener('touchmove', onPointerReveal, { passive: true });
        }

        // Hide theme selector when clicking outside
        document.addEventListener('click', (e) => {
            const themeSelector = document.getElementById('theme-selector');
            const themeBtn = document.getElementById('theme-toggle');
            if (!themeSelector?.contains(e.target) && !themeBtn?.contains(e.target)) {
                themeSelector?.classList.add('hidden');
            }
        });
    }

    setupScrollAnimations() {
        const elements = document.querySelectorAll('.reveal-on-scroll');
        if (!elements.length) {
            return;
        }

        if (typeof IntersectionObserver === 'undefined') {
            elements.forEach(el => el.classList.add('is-visible'));
            return;
        }

        if (this.revealObserver) {
            this.revealObserver.disconnect();
        }

        this.revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.2,
            rootMargin: '0px 0px -10% 0px'
        });

        this.refreshRevealTargets();
    }

    refreshRevealTargets() {
        const elements = document.querySelectorAll('.reveal-on-scroll');
        if (!elements.length) {
            return;
        }

        if (!this.revealObserver) {
            elements.forEach(el => el.classList.add('is-visible'));
            return;
        }

        elements.forEach(el => {
            if (!el.classList.contains('is-visible')) {
                this.revealObserver.observe(el);
            }
        });
    }

    updateActiveNavLink(pageId) {
        document.querySelectorAll('.nav-link').forEach(link => {
            const matches = link.getAttribute('href') === `#${pageId}`;
            link.classList.toggle('active', matches);
        });
    }

    updateBodyPageClass(pageId) {
        const body = document.body;
        if (!body) {
            return;
        }

        [...body.classList].forEach(cls => {
            if (cls.startsWith('page-')) {
                body.classList.remove(cls);
            }
        });

        body.classList.add(`page-${pageId}`);
    }

    showPage(pageId) {
        if (!pageId || this.currentPage === pageId) {
            return;
        }

        this.toggleThemeSelector(false);

        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        const targetPage = document.getElementById(`${pageId}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            if (targetPage.classList.contains('page')) {
                targetPage.scrollTop = 0;
            }
        }

        window.scrollTo({ top: 0, behavior: 'auto' });
        this.updateBodyPageClass(pageId);

        if (pageId !== 'results') {
            const resultsPage = document.getElementById('results-page');
            resultsPage?.classList.remove('celebration-active');
            const celebrationBanner = document.getElementById('celebration-banner');
            if (celebrationBanner) {
                celebrationBanner.classList.add('hidden');
                celebrationBanner.classList.remove('celebration-visible');
            }
        }

        this.updateActiveNavLink(pageId);
        this.currentPage = pageId;

        if (pageId === 'test') {
            setTimeout(() => {
                this.resetTest();
                document.getElementById('typing-input')?.focus({ preventScroll: true });
            }, 150);
        } else if (pageId === 'results') {
            requestAnimationFrame(() => this.animateResultStats());
        }

        this.refreshRevealTargets();
    }

    generateNewText() {
        // Always ensure we have content to display
        try {
            if (this.testSettings.mode === 'words') {
                this.currentParagraph = this.generateWordBasedText();
            } else if (this.testSettings.mode === 'time') {
                // For time mode, use longer text
                this.currentParagraph = this.getRandomParagraph();
            } else {
                // Quote mode
                this.currentParagraph = this.getRandomParagraph();
            }
        } catch (error) {
            console.error('Error generating text:', error);
            this.currentParagraph = null;
        }

        // Fallback if no content
        if (!this.currentParagraph || this.currentParagraph.length === 0) {
            console.warn('Using fallback text for typing test');
            this.currentParagraph = "The quick brown fox jumps over the lazy dog. This pangram sentence contains every letter of the English alphabet at least once. It is commonly used for testing typewriters and computer keyboards, and in other applications involving text where the use of all letters in the alphabet is desired.";
        }

        this.processTextForLanguage();
        this.charStates = new Array(this.currentParagraph.length).fill('pending');
        const display = document.getElementById('text-display');
        if (display) {
            display.scrollTo({ top: 0, behavior: 'auto' });
            display.style.fontSize = '';
            display.style.textAlign = '';
            display.style.color = '';
            display.style.animation = '';
        }
        this.currentPosition = 0;
        this.hasAutoScrolled = false;
        this.renderTextDisplay();
    }

    generateWordBasedText() {
        const words = this.getWordsForLanguage();
        const selectedWords = [];
        
        for (let i = 0; i < this.testSettings.wordCount; i++) {
            const randomWord = words[Math.floor(Math.random() * words.length)];
            selectedWords.push(randomWord);
        }
        
        return selectedWords.join(' ');
    }

    getWordsForLanguage() {
        const basicWords = [
            'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use',
            'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were', 'what', 'year', 'your', 'work', 'life', 'only', 'think', 'also', 'back', 'after', 'first', 'good', 'know', 'need', 'right', 'other', 'place', 'world', 'great', 'little', 'small', 'where', 'should', 'around', 'under', 'never', 'through', 'before', 'another', 'still', 'might', 'every', 'while', 'against', 'without', 'between', 'important', 'different', 'though', 'example', 'whether'
        ];

        if (this.testSettings.language === 'punctuation' || this.testSettings.language === 'mixed') {
            return basicWords.map(word => {
                if (Math.random() < 0.3) {
                    const punctuation = ['.', ',', '!', '?', ';', ':'][Math.floor(Math.random() * 6)];
                    return word + punctuation;
                }
                return word;
            });
        }

        if (this.testSettings.language === 'numbers' || this.testSettings.language === 'mixed') {
            const numbersAndWords = [...basicWords];
            for (let i = 0; i < 20; i++) {
                numbersAndWords.push(Math.floor(Math.random() * 1000).toString());
            }
            return numbersAndWords;
        }

        return basicWords;
    }

    getRandomParagraph() {
        return paragraphs[Math.floor(Math.random() * paragraphs.length)];
    }

    processTextForLanguage() {
        // Additional processing based on language settings
        if (this.testSettings.language === 'mixed') {
            // Add some numbers and punctuation randomly
            let words = this.currentParagraph.split(' ');
            words = words.map(word => {
                if (Math.random() < 0.1) {
                    return Math.floor(Math.random() * 100).toString();
                }
                if (Math.random() < 0.2) {
                    const punct = ['.', ',', '!', '?'][Math.floor(Math.random() * 4)];
                    return word + punct;
                }
                return word;
            });
            this.currentParagraph = words.join(' ');
        }
    }

    renderTextDisplay(force = false) {
        const textDisplay = document.getElementById('text-display');
        if (!textDisplay) {
            console.warn('Text display element not found');
            return;
        }

        if (!this.currentParagraph || this.currentParagraph.length === 0) {
            console.warn('No paragraph to display');
            this.currentParagraph = "The quick brown fox jumps over the lazy dog. This pangram contains every letter of the alphabet and is perfect for typing practice. Start typing to begin your test!";
            this.charStates = new Array(this.currentParagraph.length).fill('pending');
        }

        if (this.charStates.length !== this.currentParagraph.length) {
            this.charStates = new Array(this.currentParagraph.length).fill('pending');
        }

        if (!force && this.charElements.length === this.currentParagraph.length) {
            this.refreshAllCharacterStates();
            this.syncCursorHighlight();
            return;
        }

        textDisplay.textContent = '';
        const fragment = document.createDocumentFragment();
        this.charElements = [];

        for (let i = 0; i < this.currentParagraph.length; i++) {
            const char = this.currentParagraph[i];
            const span = document.createElement('span');
            span.className = char === ' ' ? 'char space' : 'char';
            span.textContent = char === ' ' ? ' ' : char;
            fragment.appendChild(span);
            this.charElements.push(span);
        }

        textDisplay.appendChild(fragment);
        this.refreshAllCharacterStates();
        this.lastCursorIndex = null;
        this.syncCursorHighlight();
        this.scrollCurrentIntoView(true);
    }

    refreshAllCharacterStates() {
        if (!this.charElements.length) return;
        for (let i = 0; i < this.charStates.length; i++) {
            this.applyCharState(i, this.charStates[i]);
        }
    }

    applyCharState(index, state) {
        const span = this.charElements[index];
        if (!span) return;

        span.classList.remove('correct', 'incorrect', 'incorrect-space');
        if (state === 'correct') {
            span.classList.add('correct');
        } else if (state === 'incorrect') {
            // If this is a space char, use a special class for box styling
            if (span.classList.contains('space')) {
                span.classList.add('incorrect-space');
            } else {
                span.classList.add('incorrect');
            }
        }
    }

    syncCursorHighlight(targetIndex = this.currentPosition) {
        if (!this.charElements.length) {
            this.lastCursorIndex = null;
            return;
        }

        if (this.lastCursorIndex !== null && this.charElements[this.lastCursorIndex]) {
            this.charElements[this.lastCursorIndex].classList.remove('current');
        }

        if (targetIndex === null || targetIndex === undefined) {
            this.lastCursorIndex = null;
            return;
        }

        const highlightIndex = Math.max(0, Math.min(targetIndex, this.charElements.length - 1));
        const targetSpan = this.charElements[highlightIndex];
        if (targetSpan) {
            targetSpan.classList.add('current');
            this.lastCursorIndex = highlightIndex;
        } else {
            this.lastCursorIndex = null;
        }
    }

    setCursorPosition(index, options = {}) {
        const { skipScroll = false } = options;
        const boundedIndex = Math.max(0, Math.min(index, this.charStates.length));
        this.currentPosition = boundedIndex;

        if (!this.charElements.length) {
            return;
        }

        const highlightIndex = boundedIndex >= this.charElements.length && this.charElements.length > 0
            ? this.charElements.length - 1
            : boundedIndex;
        if (highlightIndex >= 0) {
            this.syncCursorHighlight(highlightIndex);
        } else {
            this.syncCursorHighlight(null);
        }

        if (!skipScroll) {
            this.scrollCurrentIntoView();
        }
    }

    advanceCursor() {
        this.setCursorPosition(this.currentPosition + 1);
    }

    updateTextDisplay() {
        this.renderTextDisplay();
        this.scrollCurrentIntoView();
    }

    scrollCurrentIntoView(forceInstant = false) {
        const textDisplay = document.getElementById('text-display');
        if (!textDisplay || !this.charElements.length) return;

        const targetIndex = Math.min(this.currentPosition, this.charElements.length - 1);
        const target = this.charElements[targetIndex];
        if (!target) return;

        const offsetTop = target.offsetTop;
        const visibleHeight = textDisplay.clientHeight;
        const desiredTop = Math.max(0, offsetTop - visibleHeight * 0.4);

        // Only scroll if caret is leaving a comfortable band; avoid smooth scroll per key
        const scrollTop = textDisplay.scrollTop;
        const targetBottom = offsetTop + target.offsetHeight;
        const upperBand = scrollTop + visibleHeight * 0.2;
        const lowerBand = scrollTop + visibleHeight * 0.8;
        if (forceInstant || !this.hasAutoScrolled || offsetTop < upperBand || targetBottom > lowerBand) {
            textDisplay.scrollTo({ top: desiredTop, behavior: 'auto' });
        }

        this.hasAutoScrolled = true;
    }

    handleInput(e) {
        const input = e.target.value;
        if (!input) {
            return;
        }

        const typedChar = input[input.length - 1];
        e.target.value = '';
        // Hide settings bar on first typing interaction
        this.setSettingsBarHidden(true);
        this.processTypedCharacter(typedChar);
    }

    processTypedCharacter(typedChar) {
        if (typeof typedChar !== 'string' || typedChar.length === 0) {
            return;
        }

        if (!this.currentParagraph || !this.currentParagraph.length) {
            return;
        }

        if (!this.isTestActive) {
            this.startTest();
        }

        // Any character typed should reset idle tracking and resume timer if paused
        this.resetIdleTimer();
        if (this.isTimerPaused && this.isTestActive && this.testSettings.mode === 'time') {
            this.resumeTimer();
        }

        if (this.currentPosition >= this.charStates.length) {
            if (this.testSettings.mode !== 'time') {
                this.completeTest();
            }
            return;
        }

        const expectedChar = this.currentParagraph[this.currentPosition];
        const isCorrect = typedChar === expectedChar;

        if (isCorrect) {
            this.charStates[this.currentPosition] = 'correct';
            this.applyCharState(this.currentPosition, 'correct');
            this.correctChars++;
            this.playKeySound();
        } else {
            this.charStates[this.currentPosition] = 'incorrect';
            this.applyCharState(this.currentPosition, 'incorrect');
            this.errors++;
            this.playErrorSound();
        }

        this.totalChars++;
        this.advanceCursor();

        const reachedEnd = this.currentPosition >= this.currentParagraph.length;
        if (reachedEnd) {
            if (this.testSettings.mode === 'time') {
                this.generateNewText();
            } else {
                this.completeTest();
                return;
            }
        }

    this.updateStatsThrottled();
    }

    handleKeyDown(e) {
        // mark perf start for any key interaction in the typing input
        if (this.perf && this.perf.enabled) {
            this.perf.lastKeyTs = performance.now();
        }
        if (e.key === 'Backspace') {
            e.preventDefault();
            this.handleBackspace();
        }
        // Measure key -> DOM latency on the next paint, after DOM updates
        if (this.perf && this.perf.enabled && this.perf.lastKeyTs) {
            requestAnimationFrame(() => {
                const now = performance.now();
                const latency = Math.max(0, now - this.perf.lastKeyTs);
                this.recordLatency(latency);
                this.updatePerfChip();
            });
        }

    // Stats will be updated by throttler; avoid duplicate here
    }

    // Perf helpers
    recordLatency(ms) {
        const p = this.perf;
        if (!p) return;
        p.samples.push(ms);
        if (p.samples.length > p.maxSamples) p.samples.shift();
    }

    ensurePerfChip() {
        const p = this.perf; if (!p || p.chipEl) return;
        const el = document.createElement('div');
        el.id = 'perf-chip';
        el.style.position = 'fixed';
        el.style.bottom = '10px';
        el.style.right = '10px';
        el.style.zIndex = '9999';
        el.style.font = '600 12px Inter, system-ui, sans-serif';
        el.style.padding = '.25rem .45rem';
        el.style.borderRadius = '10px';
        el.style.background = 'rgba(2,6,23,0.55)';
        el.style.border = '1px solid rgba(255,255,255,0.15)';
        el.style.color = '#e2e8f0';
        el.style.backdropFilter = 'blur(4px)';
        el.textContent = 'Latency: -- ms';
        document.body.appendChild(el);
        p.chipEl = el;
    }

    updatePerfChip() {
        const p = this.perf; if (!p || !p.enabled) return;
        this.ensurePerfChip();
        if (!p.chipEl || p.samples.length === 0) return;
        const arr = p.samples.slice();
        const n = arr.length;
        let sum = 0, max = 0; for (const v of arr){ sum += v; if (v>max) max=v; }
        const avg = sum / n;
        const sorted = arr.slice().sort((a,b)=>a-b);
        const p95 = sorted[Math.min(n-1, Math.floor(n*0.95))];
        p.chipEl.textContent = `Latency: ${avg.toFixed(1)} ms avg · ${p95.toFixed(1)} ms p95 · ${max.toFixed(1)} ms max`;
    }

    handleBackspace() {
        if (!this.charStates.length) return;

        const previousIndex = Math.max(0, Math.min(this.currentPosition - 1, this.charStates.length - 1));
        if (previousIndex < 0) return;

        const previousState = this.charStates[previousIndex];

        if (previousState === 'correct') {
            this.correctChars = Math.max(0, this.correctChars - 1);
        } else if (previousState === 'incorrect') {
            this.errors = Math.max(0, this.errors - 1);
        }

        if (this.totalChars > 0) {
            this.totalChars = Math.max(0, this.totalChars - 1);
        }

        this.charStates[previousIndex] = 'pending';
        this.applyCharState(previousIndex, 'pending');
        this.hasAutoScrolled = false;
    this.setCursorPosition(previousIndex);
    this.updateStatsThrottled();
        // Reset idle timer and resume countdown if it was paused
        this.resetIdleTimer();
        if (this.isTimerPaused && this.isTestActive && this.testSettings.mode === 'time') {
            this.resumeTimer();
        }
    }

    handleGlobalKeydown(event) {
        if (this.currentPage !== 'test') {
            return;
        }

        const typingInput = document.getElementById('typing-input');
        if (!typingInput) {
            return;
        }

        const target = event.target;
        const tag = target?.tagName;
        // Avoid duplicate handling when focus is already in our hidden typing input
        if (target === typingInput) {
            return;
        }
        // Allow keystrokes to flow when a button has focus (e.g., sound toggle),
        // but ignore selects/inputs/textarea to not interfere with their typing.
        if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') {
            return;
        }

        if (event.metaKey || event.ctrlKey || event.altKey) {
            return;
        }

        if (event.key === 'Backspace') {
            event.preventDefault();
            typingInput.focus({ preventScroll: true });
            this.handleBackspace();
            return;
        }

        if (event.key === 'Tab' || event.key === 'Escape') {
            return;
        }

        let character = '';
        if (event.key === 'Enter') {
            character = '\n';
        } else if (event.key === ' ' || event.key === 'Spacebar') {
            character = ' ';
        } else if (event.key.length === 1) {
            character = event.key;
        } else {
            return;
        }

        event.preventDefault();
        // Hide settings bar on first key interaction in test page
        this.setSettingsBarHidden(true);
        typingInput.focus({ preventScroll: true });
        this.processTypedCharacter(character);
        // Reset idle timer and resume if paused
        this.resetIdleTimer();
        if (this.isTimerPaused && this.isTestActive && this.testSettings.mode === 'time') {
            this.resumeTimer();
        }
    }

    setSettingsBarHidden(hidden) {
        const bar = document.querySelector('.settings-bar');
        if (!bar) return;
        bar.classList.toggle('is-hidden', !!hidden);
    }

    startTest() {
        this.isTestActive = true;
        this.startTime = Date.now();
         // Do not auto-start screen recording to avoid browser share prompts during typing
        
        if (this.testSettings.mode === 'time') {
            this.startTimer();
        }
        // Begin idle tracking
        this.resetIdleTimer();
    }

    startTimer() {
        const timerDisplay = document.getElementById('timer-display');
        // Initialize remaining time on first start
        if (this.timeLeft == null) {
            this.timeLeft = this.testSettings.timeLimit;
        }
        if (timerDisplay) {
            timerDisplay.textContent = this.timeLeft;
        }

        if (this.activeTimer) {
            clearInterval(this.activeTimer);
        }
        this.isTimerPaused = false;
        this.activeTimer = setInterval(() => {
            if (!this.isTestActive) {
                clearInterval(this.activeTimer);
                this.activeTimer = null;
                return;
            }
            this.timeLeft = Math.max(0, (this.timeLeft ?? 0) - 1);
            if (timerDisplay) {
                timerDisplay.textContent = this.timeLeft;
            }
            if ((this.timeLeft ?? 0) <= 0) {
                clearInterval(this.activeTimer);
                this.activeTimer = null;
                if (this.isTestActive) {
                    this.completeTest();
                }
            }
        }, 1000);
    }

    pauseTimer() {
        if (this.activeTimer) {
            clearInterval(this.activeTimer);
            this.activeTimer = null;
        }
        this.isTimerPaused = true;
    }

    resumeTimer() {
        if (this.testSettings.mode !== 'time' || !this.isTestActive) return;
        if (!this.isTimerPaused) return;
        this.startTimer();
    }

    clearIdleTimer() {
        if (this.idleTimeoutId) {
            clearTimeout(this.idleTimeoutId);
            this.idleTimeoutId = null;
        }
    }

    resetIdleTimer() {
        this.clearIdleTimer();
        if (this.testSettings.mode === 'time' && this.isTestActive) {
            this.idleTimeoutId = setTimeout(() => {
                // Pause countdown after inactivity
                this.pauseTimer();
            }, this.idlePauseMs);
        }
    }

    completeTest() {
        this.isTestActive = false;
        this.endTime = Date.now();
        if (this.activeTimer) {
            clearInterval(this.activeTimer);
            this.activeTimer = null;
        }
        this.clearIdleTimer();
        this.stopRecording();
        this.calculateResults();
        
        // Show completion animation then results
        this.showCompletionAnimation();
        setTimeout(() => {
            this.showResults();
        }, 1500);
    }

    calculateResults() {
        // Compute effective elapsed minutes. In time mode, use countdown delta to avoid
        // inflated WPM caused by very small (end - start) values during idle/pause cycles.
        let elapsedMinutes;
        if (this.testSettings.mode === 'time') {
            const limit = Math.max(1, this.testSettings.timeLimit || 0); // seconds
            const left = Math.max(0, this.timeLeft == null ? 0 : this.timeLeft); // seconds
            const activeSeconds = Math.max(1, limit - left); // at least 1 second
            elapsedMinutes = activeSeconds / 60;
        } else {
            const elapsedMs = Math.max(1, (this.endTime ?? Date.now()) - (this.startTime ?? Date.now()));
            elapsedMinutes = elapsedMs / 1000 / 60;
        }

        const wordsTyped = this.correctChars / 5; // Standard: 5 characters = 1 word
        const wpm = Math.round(wordsTyped / elapsedMinutes);
        const accuracy = this.totalChars > 0 ? Math.round((this.correctChars / this.totalChars) * 100) : 100;
        const raw = Math.round((this.totalChars / 5) / elapsedMinutes);

        this.wpm = Number.isFinite(wpm) ? Math.max(0, wpm) : 0;
        this.accuracy = Number.isFinite(accuracy) ? Math.min(100, Math.max(0, accuracy)) : 100;
        this.rawSpeed = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    }

    showCompletionAnimation() {
        const textDisplay = document.getElementById('text-display');
        if (textDisplay) {
            textDisplay.innerHTML = '<div class="completion-message">🎉 Test Complete! 🎉</div>';
            textDisplay.style.fontSize = '2rem';
            textDisplay.style.textAlign = 'center';
            textDisplay.style.color = 'var(--success-color)';
            textDisplay.style.animation = 'pulse 0.5s ease-in-out 3';
        }
    }

    showResults() {
        const wpmEl = document.getElementById('final-wpm');
        const accuracyEl = document.getElementById('final-accuracy');
        const rawEl = document.getElementById('final-raw');
        const charsEl = document.getElementById('final-chars');

        if (wpmEl) {
            wpmEl.dataset.targetValue = String(this.wpm || 0);
            wpmEl.textContent = '0';
        }

        if (accuracyEl) {
            accuracyEl.dataset.targetValue = String(Number.isFinite(this.accuracy) ? this.accuracy : 100);
            accuracyEl.dataset.suffix = '%';
            accuracyEl.textContent = '0%';
        }

        if (rawEl) {
            rawEl.dataset.targetValue = String(this.rawSpeed || 0);
            rawEl.textContent = '0';
        }

        if (charsEl) {
            charsEl.dataset.correct = String(this.correctChars || 0);
            charsEl.dataset.errors = String(this.errors || 0);
            charsEl.dataset.total = String(this.totalChars || 0);
            charsEl.textContent = '0/0/0';
        }
        
        // Show results page
    this.showPage('results');
        
        // Initialize gauges after navigating
        requestAnimationFrame(() => this.updateGauges());
        // Generate charts with animation
        setTimeout(() => {
            this.generateCharts();
        }, 250);
    }

    updateGauges() {
        const acc = Number.isFinite(this.accuracy) ? Math.max(0, Math.min(100, this.accuracy)) : 100;
        const realAcc = this.totalChars > 0 ? Math.round((this.correctChars / this.totalChars) * 100) : acc;
        const wpm = Number.isFinite(this.wpm) ? Math.max(0, this.wpm) : 0;
        // Duration display rules:
        // - time mode: show configured test length (limit)
        // - words/quote mode: show actual elapsed until completion
        let durationSeconds;
        if (this.testSettings.mode === 'time') {
            durationSeconds = Math.max(1, this.testSettings?.timeLimit || 0);
        } else {
            const elapsedMs = Math.max(1, (this.endTime ?? Date.now()) - (this.startTime ?? Date.now()));
            durationSeconds = Math.round(elapsedMs / 1000);
        }
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = String(durationSeconds % 60).padStart(2, '0');

    const accEl = document.getElementById('gv-accuracy');
    const accRealEl = document.getElementById('gv-accuracy-real');
    const wpmEl = document.getElementById('gv-wpm');
    const durEl = document.getElementById('gv-duration');

    if (accEl) accEl.textContent = `${acc}%`;
    if (accRealEl) accRealEl.textContent = `${realAcc}%`;
    if (wpmEl) wpmEl.textContent = `${wpm}`;
    if (durEl) durEl.textContent = `${minutes}:${seconds}`;

        const speedMax = Number(document.getElementById('g-speed')?.dataset.max || 160);
        const accPct = acc;
        const speedPct = Math.min(100, (wpm / speedMax) * 100);
        const durPct = this.testSettings.mode === 'time'
            ? Math.min(100, (Math.max(1, this.testSettings?.timeLimit || 0) > 0 ? (durationSeconds / Math.max(1, this.testSettings?.timeLimit || 0)) * 100 : 100))
            : 100;

    // Reset to 0 so each results view sweeps from zero
    document.getElementById('g-accuracy')?.style.setProperty('--pct', 0);
    document.getElementById('g-speed')?.style.setProperty('--pct', 0);
    document.getElementById('g-duration')?.style.setProperty('--pct', 0);
    // Animate gauge sweep clockwise
    this.animateGaugeTo('g-accuracy', accPct, 1000);
    this.animateGaugeTo('g-speed', speedPct, 1000);
    this.animateGaugeTo('g-duration', durPct, 1000);
    }

    animateGaugeTo(id, targetPct, duration = 1000) {
        const el = document.getElementById(id);
        if (!el) return;
        const clampedTarget = Math.max(0, Math.min(100, Number(targetPct) || 0));
        const current = Number(el.style.getPropertyValue('--pct')) || 0;
        const start = performance.now();
        const startVal = current;
        const delta = clampedTarget - startVal;

        // cancel any prior animation for this element
        this.cancelAnimation(el);

        const step = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = this.easeOutCubic(t);
            const value = startVal + delta * eased;
            el.style.setProperty('--pct', value);
            if (t < 1) {
                const frameId = requestAnimationFrame(step);
                this.activeAnimations.set(el, frameId);
            } else {
                el.style.setProperty('--pct', clampedTarget);
                this.activeAnimations.delete(el);
            }
        };
        const frameId = requestAnimationFrame(step);
        this.activeAnimations.set(el, frameId);
    }

    setupParallax() {
        const parallaxTargets = [];
        document.querySelectorAll('[data-parallax]')?.forEach(el => parallaxTargets.push(el));
        const onScroll = () => {
            const y = window.scrollY || 0;
            parallaxTargets.forEach(el => {
                const speed = Number(el.dataset.parallax) || 0.15;
                el.style.transform = `translateY(${y * speed}px)`;
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    // celebration banner removed

    generateCharts() {
        this.generateSpeedChart();
        this.generateAccuracyChart();
    }

    generateSpeedChart() {
        const canvas = document.getElementById('speed-chart');
        if (!canvas) return;
        const prepared = this.prepareCanvas(canvas);
        if (!prepared) return;

        const { ctx, width, height } = prepared;
        const styles = (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body)
            ? getComputedStyle(document.body)
            : null;
        const lineColor = styles?.getPropertyValue('--chart-line-color').trim() || '#fefae0';
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Generate sample data (in real implementation, track over time)
        const dataPoints = this.generateSampleSpeedData();

        this.drawChart(ctx, dataPoints, width, height, 'Speed (WPM)', lineColor, styles);
    }

    generateAccuracyChart() {
        const canvas = document.getElementById('accuracy-chart');
        if (!canvas) return;
        const prepared = this.prepareCanvas(canvas);
        if (!prepared) return;

        const { ctx, width, height } = prepared;
        const styles = (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body)
            ? getComputedStyle(document.body)
            : null;
        const lineColor = styles?.getPropertyValue('--chart-secondary-line-color').trim() || '#606c38';
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Generate sample data
        const dataPoints = this.generateSampleAccuracyData();

        this.drawChart(ctx, dataPoints, width, height, 'Accuracy (%)', lineColor, styles);
    }

    drawChart(ctx, dataPoints, width, height, label, color, styles = null) {
        const padding = 40;
        const chartWidth = width - 2 * padding;
        const chartHeight = height - 2 * padding;
        const computedStyles = styles || ((typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) ? getComputedStyle(document.body) : null);
        const gridColor = computedStyles?.getPropertyValue('--chart-grid-color').trim() || 'rgba(226, 232, 240, 0.4)';
        const textColor = computedStyles?.getPropertyValue('--chart-text-color').trim() || '#64748b';
        
        // Draw axes
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        // Draw data line
        if (dataPoints.length > 1) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            dataPoints.forEach((point, index) => {
                const x = padding + (index / (dataPoints.length - 1)) * chartWidth;
                const y = height - padding - (point.value / Math.max(...dataPoints.map(p => p.value))) * chartHeight;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
            
            // Draw points
            ctx.fillStyle = color;
            dataPoints.forEach((point, index) => {
                const x = padding + (index / (dataPoints.length - 1)) * chartWidth;
                const y = height - padding - (point.value / Math.max(...dataPoints.map(p => p.value))) * chartHeight;
                
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
        
        // Add label
        ctx.fillStyle = textColor;
        ctx.font = '14px Inter';
        ctx.fillText(label, padding, 20);
    }

    generateSampleSpeedData() {
        const points = [];
        const hasValidTiming = this.startTime && this.endTime && this.endTime > this.startTime;
        const fallbackDuration = this.testSettings?.timeLimit || 60;
        const testDuration = hasValidTiming ? (this.endTime - this.startTime) / 1000 : fallbackDuration;
        const intervals = Math.min(10, Math.max(3, Math.floor(testDuration / 5)));
        
        for (let i = 0; i <= intervals; i++) {
            const timePoint = (i / intervals) * testDuration;
            const baseSpeed = this.wpm || 30;
            const variation = Math.sin(i * 0.5) * 10 + Math.random() * 10 - 5;
            points.push({
                time: timePoint,
                value: Math.max(0, baseSpeed + variation)
            });
        }
        
        return points;
    }

    generateSampleAccuracyData() {
        const points = [];
        const hasValidTiming = this.startTime && this.endTime && this.endTime > this.startTime;
        const fallbackDuration = this.testSettings?.timeLimit || 60;
        const testDuration = hasValidTiming ? (this.endTime - this.startTime) / 1000 : fallbackDuration;
        const intervals = Math.min(10, Math.max(3, Math.floor(testDuration / 5)));
        
        for (let i = 0; i <= intervals; i++) {
            const timePoint = (i / intervals) * testDuration;
            const baseAccuracy = this.accuracy || 95;
            const variation = Math.cos(i * 0.3) * 5 + Math.random() * 5 - 2.5;
            points.push({
                time: timePoint,
                value: Math.min(100, Math.max(0, baseAccuracy + variation))
            });
        }
        
        return points;
    }

    prepareCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const dpr = window.devicePixelRatio || 1;
        const cssWidth = canvas.clientWidth || canvas.width;
        const cssHeight = canvas.clientHeight || canvas.height;
        const displayWidth = Math.max(1, Math.round(cssWidth * dpr));
        const displayHeight = Math.max(1, Math.round(cssHeight * dpr));

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        return { ctx, width: cssWidth, height: cssHeight };
    }

    animateResultStats() {
        const cards = document.querySelectorAll('.result-card');
        cards.forEach(card => card.classList.remove('is-visible'));
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('is-visible');
            }, index * 80);
        });

        const wpmEl = document.getElementById('final-wpm');
        const accuracyEl = document.getElementById('final-accuracy');
        const rawEl = document.getElementById('final-raw');
        const charsEl = document.getElementById('final-chars');

        if (wpmEl) {
            const target = Number(wpmEl.dataset.targetValue ?? this.wpm ?? 0);
            this.animateNumberValue(wpmEl, target, { duration: 900 });
        }

        if (accuracyEl) {
            const target = Number(accuracyEl.dataset.targetValue ?? this.accuracy ?? 100);
            const suffix = accuracyEl.dataset.suffix || '%';
            this.animateNumberValue(accuracyEl, target, { duration: 900, suffix });
        }

        if (rawEl) {
            const target = Number(rawEl.dataset.targetValue ?? this.rawSpeed ?? 0);
            this.animateNumberValue(rawEl, target, { duration: 900 });
        }

        if (charsEl) {
            const stats = {
                correct: Number(charsEl.dataset.correct ?? this.correctChars ?? 0),
                errors: Number(charsEl.dataset.errors ?? this.errors ?? 0),
                total: Number(charsEl.dataset.total ?? this.totalChars ?? 0)
            };
            this.animateCharBreakdown(charsEl, stats, 1100);
        }
    }

    animateNumberValue(element, targetValue, { suffix = '', duration = 1000, decimals = 0 } = {}) {
        const safeTarget = Number.isFinite(targetValue) ? targetValue : 0;
        const startTime = performance.now();
        this.cancelAnimation(element);

        const step = (now) => {
            const progress = Math.min(1, (now - startTime) / duration);
            const eased = this.easeOutCubic(progress);
            const currentValue = safeTarget * eased;
            const formatted = decimals > 0 ? currentValue.toFixed(decimals) : Math.round(currentValue);
            element.textContent = `${formatted}${suffix}`;

            if (progress < 1) {
                const frameId = requestAnimationFrame(step);
                this.activeAnimations.set(element, frameId);
            } else {
                element.textContent = `${Math.round(safeTarget)}${suffix}`;
                this.activeAnimations.delete(element);
            }
        };

        const frameId = requestAnimationFrame(step);
        this.activeAnimations.set(element, frameId);
    }

    animateCharBreakdown(element, stats, duration = 1100) {
        const safeStats = {
            correct: Math.max(0, Number.isFinite(stats.correct) ? stats.correct : 0),
            errors: Math.max(0, Number.isFinite(stats.errors) ? stats.errors : 0),
            total: Math.max(0, Number.isFinite(stats.total) ? stats.total : 0)
        };

        const startTime = performance.now();
        this.cancelAnimation(element);

        const step = (now) => {
            const progress = Math.min(1, (now - startTime) / duration);
            const eased = this.easeOutCubic(progress);
            const currentCorrect = Math.round(safeStats.correct * eased);
            const currentErrors = Math.round(safeStats.errors * eased);
            const currentTotal = Math.round(safeStats.total * eased);
            element.textContent = `${currentCorrect}/${currentErrors}/${currentTotal}`;

            if (progress < 1) {
                const frameId = requestAnimationFrame(step);
                this.activeAnimations.set(element, frameId);
            } else {
                element.textContent = `${safeStats.correct}/${safeStats.errors}/${safeStats.total}`;
                this.activeAnimations.delete(element);
            }
        };

        const frameId = requestAnimationFrame(step);
        this.activeAnimations.set(element, frameId);
    }

    cancelAnimation(element) {
        if (!element) {
            return;
        }

        const frameId = this.activeAnimations.get(element);
        if (frameId) {
            cancelAnimationFrame(frameId);
            this.activeAnimations.delete(element);
        }
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    updateStatsThrottled() {
        if (this._statsTimerId) return;
        this._statsTimerId = setTimeout(() => {
            this._statsTimerId = null;
            this.updateStats();
        }, this.statsIntervalMs);
    }

    updateStats() {
        if (!this.isTestActive || !this.startTime) return;
        // Use effective elapsed time matching the mode
        let elapsedMinutes;
        if (this.testSettings.mode === 'time') {
            const limit = Math.max(1, this.testSettings.timeLimit || 0);
            const left = Math.max(0, this.timeLeft == null ? limit : this.timeLeft);
            const activeSeconds = Math.max(1, limit - left);
            elapsedMinutes = activeSeconds / 60;
        } else {
            const timeElapsed = (Date.now() - this.startTime) / 1000 / 60;
            elapsedMinutes = Math.max(1 / 60, timeElapsed);
        }

        const wordsTyped = this.correctChars / 5;
        const currentWpm = Math.round(wordsTyped / elapsedMinutes);
        const currentAccuracy = this.totalChars > 0 ? Math.round((this.correctChars / this.totalChars) * 100) : 100;
        
        document.getElementById('wpm-display').textContent = currentWpm;
        document.getElementById('accuracy-display').textContent = currentAccuracy + '%';
        
        if (this.testSettings.mode === 'time') {
            const display = document.getElementById('timer-display');
            const toShow = this.timeLeft != null ? this.timeLeft : this.testSettings.timeLimit;
            if (display) display.textContent = Math.max(0, toShow);
        }
    }

    resetTest() {
        this.isTestActive = false;
        this.currentPosition = 0;
        this.startTime = null;
        this.endTime = null;
        this.errors = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this.wpmHistory = [];
        this.accuracyHistory = [];
        this.charStates = [];
        this.charElements = [];
        this.hasAutoScrolled = false;
        this.lastCursorIndex = null;
        if (this.activeTimer) {
            clearInterval(this.activeTimer);
            this.activeTimer = null;
        }
        this.clearIdleTimer();
        this.isTimerPaused = false;
        this.timeLeft = null;
        this.updateModeUI();
        
        // Reset displays
        document.getElementById('wpm-display').textContent = '0';
        document.getElementById('accuracy-display').textContent = '100%';
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = this.testSettings.mode === 'time' ? this.testSettings.timeLimit : '--';
        }
        
        // Clear input
        const typingInput = document.getElementById('typing-input');
        if (typingInput) {
            typingInput.value = '';
            typingInput.focus();
        }
        
        this.generateNewText();
    }

    nextParagraph() {
        this.resetTest();
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const soundBtn = document.getElementById('sound-toggle');
        if (soundBtn) {
            soundBtn.textContent = this.soundEnabled ? '🔊' : '🔇';
            soundBtn.classList.toggle('active', this.soundEnabled);
        }
        // If disabling sound, immediately stop any active audio to avoid lingering tails
        if (!this.soundEnabled && this.activeSounds && this.activeSounds.size) {
            try {
                this.activeSounds.forEach(a => { try { a.pause(); } catch(_) {} });
                this.activeSounds.clear();
            } catch(_) { /* no-op */ }
        }
        this.saveSettings();
    }

    playKeySound() {
        if (!this.soundEnabled) return;
        this.playHtmlAudio(this.correctAudio, 0.35, 'correct');
    }

    playErrorSound() {
        if (!this.soundEnabled) return;
        this.playHtmlAudio(this.wrongAudio, 0.5, 'wrong');
    }

    // Helper to play short UI sounds with low latency, overlap safety, and fallback
    playHtmlAudio(baseAudio, volume = 0.4, type = 'correct') {
        if (!baseAudio) return;
        try {
            const now = performance.now();
            const minGap = this.soundRateLimits?.[type] ?? 40;
            if (now - (this.lastSoundTime?.[type] || 0) < minGap) return; // throttle

            if (this.activeSounds.size >= this.maxPolyphony) return; // cap overlap

            const a = baseAudio.cloneNode(true);
            a.volume = Math.max(0, Math.min(1, volume));
            a.currentTime = 0;
            // Slightly faster playback tightens the feel; optional
            // a.playbackRate = type === 'wrong' ? 1.0 : 1.1;

            this.activeSounds.add(a);
            a.addEventListener('ended', () => this.activeSounds.delete(a), { once: true });

            // Ensure immediate playback on user-driven key events
            let started = false;
            const p = a.play();
            if (p && typeof p.then === 'function') {
                p.then(() => { started = true; }).catch(() => {
                    // Autoplay or other media error: fallback to a tiny beep
                    this.playBeepFallback(type, volume);
                });
            }

            // Clip the sound after it actually starts playing so it remains audible
            const clip = Math.max(50, this.soundClipMs?.[type] ?? 120);
            let clipped = false;
            const scheduleClip = () => {
                if (clipped) return;
                clipped = true;
                setTimeout(() => {
                    try { a.pause(); } catch (_) {}
                    this.activeSounds.delete(a);
                }, clip);
            };
            a.addEventListener('playing', scheduleClip, { once: true });
            // Fallback: if 'playing' never fires promptly, clip after a safe upper bound
            setTimeout(() => {
                if (!started) {
                    // If we never started, fire fallback beep to ensure audible feedback
                    this.playBeepFallback(type, volume);
                }
                scheduleClip();
            }, 400);

            this.lastSoundTime[type] = now;
        } catch (_) {
            // Swallow errors to avoid interrupting typing flow
        }
    }

    // Minimal beep fallback using WebAudio for guaranteed tiny click
    playBeepFallback(type = 'correct', volume = 0.4) {
        if (!this.soundEnabled) return;
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);
            const now = ctx.currentTime;
            const freq = type === 'wrong' ? 420 : 900;
            const dur = type === 'wrong' ? 0.08 : 0.05; // 80ms / 50ms
            o.frequency.setValueAtTime(freq, now);
            g.gain.setValueAtTime(Math.max(0, Math.min(1, volume)) * 0.4, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + dur);
            o.start(now);
            o.stop(now + dur);
            // Auto-close context shortly after to free resources
            setTimeout(() => { try { ctx.close(); } catch(_) {} }, Math.ceil(dur * 1000) + 50);
        } catch(_) { /* ignore */ }
    }

    toggleThemeSelector(forceState = null) {
        const themeSelector = document.getElementById('theme-selector');
        if (!themeSelector) return;

        const shouldShow = forceState === null ? themeSelector.classList.contains('hidden') : forceState;
        themeSelector.classList.toggle('hidden', !shouldShow);
    }

    changeTheme(theme) {
        if (!this.availableThemes.includes(theme)) {
            theme = this.availableThemes[0];
        }

        this.currentTheme = theme;

        const body = document.body;
        if (body) {
            [...body.classList].forEach(cls => {
                if (cls.startsWith('theme-')) {
                    body.classList.remove(cls);
                }
            });
            body.classList.add(`theme-${theme}`);
        }
        
        // Update active theme option
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
            if (option.dataset.theme === theme) {
                option.classList.add('active');
            }
        });
        
        // Hide theme selector
        document.getElementById('theme-selector')?.classList.add('hidden');
        
        this.saveSettings();
        this.generateCharts();
    }

    startRecording() {
        // Note: Screen recording requires user permission and HTTPS
        // This is a placeholder implementation
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({ video: true })
                    .then(stream => {
                        this.mediaRecorder = new MediaRecorder(stream);
                        this.recordedChunks = [];
                        
                        this.mediaRecorder.addEventListener('dataavailable', (event) => {
                            if (event.data.size > 0) {
                                this.recordedChunks.push(event.data);
                            }
                        });
                        
                        this.mediaRecorder.start();
                    })
                    .catch(err => {
                        console.warn('Screen recording not available:', err);
                    });
            }
        } catch (err) {
            console.warn('Recording not supported:', err);
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.mediaRecorder.addEventListener('stop', () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                
                const videoElement = document.getElementById('test-recording');
                const videoMessage = document.getElementById('video-message');
                
                if (videoElement && videoMessage) {
                    videoElement.src = url;
                    videoElement.style.display = 'block';
                    videoMessage.style.display = 'none';
                }
            });
        }
    }

    loadSettings() {
        try {
            const settings = localStorage.getItem('typefast-settings');
            if (settings) {
                const parsed = JSON.parse(settings);
                this.soundEnabled = parsed.soundEnabled !== false;
                const storedTheme = parsed.theme && this.availableThemes.includes(parsed.theme)
                    ? parsed.theme
                    : this.availableThemes[0];
                this.currentTheme = storedTheme;
                this.testSettings = { ...this.testSettings, ...parsed.testSettings };
                
                // Apply loaded settings
                this.changeTheme(this.currentTheme);
            }
        } catch (err) {
            console.warn('Could not load settings:', err);
        }
    }

    syncControlsWithSettings() {
        const timeSelect = document.getElementById('time-select');
        if (timeSelect) {
            timeSelect.value = String(this.testSettings.timeLimit);
        }

        const wordsSelect = document.getElementById('words-select');
        if (wordsSelect) {
            wordsSelect.value = String(this.testSettings.wordCount);
        }

        const modeSelect = document.getElementById('mode-select');
        if (modeSelect) {
            modeSelect.value = this.testSettings.mode;
        }

        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.value = this.testSettings.language;
        }

        const soundBtn = document.getElementById('sound-toggle');
        if (soundBtn) {
            soundBtn.classList.toggle('active', this.soundEnabled);
            soundBtn.textContent = this.soundEnabled ? '🔊' : '🔇';
        }

        this.syncModeButtons();
    }

    updateModeUI() {
        if (!this.timerStatEl) {
            this.timerStatEl = document.querySelector('[data-stat="timer"]');
        }

        if (this.testSettings.mode === 'time') {
            this.timerStatEl?.classList.remove('hidden');
        } else {
            this.timerStatEl?.classList.add('hidden');
        }

        this.syncModeButtons();
    }

    syncModeButtons() {
        const modeButtons = document.querySelectorAll('.mode-option');
        modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === this.testSettings.mode);
        });
    }

    saveSettings() {
        try {
            const settings = {
                soundEnabled: this.soundEnabled,
                theme: this.currentTheme,
                testSettings: this.testSettings
            };
            localStorage.setItem('typefast-settings', JSON.stringify(settings));
        } catch (err) {
            console.warn('Could not save settings:', err);
        }
    }
}

// Global functions for HTML onclick handlers
function startTypingTest() {
    typingTest.showPage('test');
}

function showComingSoon() {
    alert('This feature is coming soon!');
}

function retakeTest() {
    typingTest.showPage('test');
}

function goHome() {
    typingTest.showPage('home');
}

function shareResults() {
    const results = `FastTyping Fingers Results: ${typingTest.wpm || 0} WPM, ${typingTest.accuracy || 100}% Accuracy`;
    
    if (navigator.share) {
        navigator.share({
            title: 'FastTyping Fingers Results',
            text: results,
            url: window.location.href
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(results).then(() => {
            alert('Results copied to clipboard!');
        }).catch(() => {
            alert(`Results: ${results}`);
        });
    }
}

// Initialize the application when DOM is loaded
let typingTest;

function initializeTypingTest() {
    typingTest = new TypingTest();
}

// Multiple initialization attempts to ensure it works
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTypingTest);
} else {
    // DOM is already loaded
    initializeTypingTest();
}

// Fallback initialization
window.addEventListener('load', () => {
    if (!typingTest) {
        console.warn('TypingTest fallback initialization');
        initializeTypingTest();
    }

});
