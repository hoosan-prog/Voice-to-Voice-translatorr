/**
 * TilGoVoice - Real-time Ovozli Tarjimon
 * O'zbekcha -> Boshqa tillar
 * 
 * Web Speech API - ovozni aniqlash
 * Flask API - tarjima va TTS
 */

document.addEventListener('DOMContentLoaded', () => {
    // ========================================
    // DOM Elementlar
    // ========================================
    const micBtn = document.getElementById('micBtn');
    const micLabel = document.getElementById('micLabel');
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const charCount = document.getElementById('charCount');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const pulseRing = document.getElementById('pulseRing');
    const targetLangBtn = document.getElementById('targetLangBtn');
    const targetFlag = document.getElementById('targetFlag');
    const targetLangName = document.getElementById('targetLangName');
    const langDropdown = document.getElementById('langDropdown');
    const langSearch = document.getElementById('langSearch');
    const langList = document.getElementById('langList');
    const outputLangLabel = document.getElementById('outputLangLabel');
    const copyBtn = document.getElementById('copyBtn');
    const playBtn = document.getElementById('playBtn');
    const clearBtn = document.getElementById('clearBtn');
    const autoPlayToggle = document.getElementById('autoPlayToggle');
    const audioPlayer = document.getElementById('audioPlayer');
    const historyList = document.getElementById('historyList');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    // ========================================
    // Holat
    // ========================================
    let isRecording = false;
    let recognition = null;
    let currentTargetLang = 'en';
    let languages = {};
    let translationHistory = [];
    let lastAudioUrl = null;
    let debounceTimer = null;
    let currentTranscript = '';
    let finalTranscript = '';

    // ========================================
    // Boshlash
    // ========================================
    init();

    async function init() {
        await loadLanguages();
        setupSpeechRecognition();
        loadHistory();
        setupEventListeners();
    }

    // ========================================
    // Tillarni yuklash
    // ========================================
    async function loadLanguages() {
        try {
            const response = await fetch('/api/languages');
            languages = await response.json();
            renderLanguageList();
        } catch (error) {
            console.error('Tillarni yuklashda xatolik:', error);
            showToast('Tillarni yuklashda xatolik', true);
        }
    }

    function renderLanguageList(filter = '') {
        langList.innerHTML = '';
        const filterLower = filter.toLowerCase();

        Object.entries(languages).forEach(([code, lang]) => {
            if (filter && !lang.name.toLowerCase().includes(filterLower) &&
                !lang.uz_name.toLowerCase().includes(filterLower) &&
                !lang.native.toLowerCase().includes(filterLower)) {
                return;
            }

            const option = document.createElement('div');
            option.className = `lang-option ${code === currentTargetLang ? 'active' : ''}`;
            option.innerHTML = `
                <span class="flag">${lang.flag}</span>
                <div class="lang-option-info">
                    <span class="lang-option-name">${lang.uz_name}</span>
                    <span class="lang-option-native">${lang.native}</span>
                </div>
                <span class="lang-option-check">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </span>
            `;
            option.addEventListener('click', () => selectLanguage(code));
            langList.appendChild(option);
        });
    }

    function selectLanguage(code) {
        currentTargetLang = code;
        const lang = languages[code];
        targetFlag.textContent = lang.flag;
        targetLangName.textContent = lang.uz_name;
        outputLangLabel.textContent = `${lang.uz_name} tarjima`;
        closeLangDropdown();
        renderLanguageList();
        localStorage.setItem('tilgo_target_lang', code);
        showToast(`${lang.uz_name} tiliga o'tkazildi`);
    }

    // ========================================
    // Ovozni aniqlash
    // ========================================
    function setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            showToast('Ovozni aniqlash qo\'llab-quvvatlanmaydi. Chrome brauzeridan foydalaning.', true);
            micBtn.disabled = true;
            micBtn.style.opacity = '0.5';
            micLabel.textContent = 'Qo\'llab-quvvatlanmaydi';
            return;
        }

        recognition = new SpeechRecognition();
        recognition.lang = 'uz-UZ'; // O'zbek tili
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('recording');
            micLabel.textContent = 'Tinglayapman...';
            statusDot.className = 'status-dot recording';
            statusText.textContent = 'Tinglayapman';
            pulseRing.classList.add('active');
            document.querySelector('.input-panel').classList.add('active');
        };

        recognition.onresult = (event) => {
            let interim = '';
            finalTranscript = '';

            for (let i = 0; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interim += transcript;
                }
            }

            currentTranscript = finalTranscript + interim;
            updateInputDisplay(currentTranscript, interim !== '');

            // Tarjimani kechiktirish
            if (finalTranscript) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    translateText(finalTranscript);
                }, 800);
            }
        };

        recognition.onerror = (event) => {
            console.error('Ovoz aniqlash xatoligi:', event.error);
            if (event.error === 'no-speech') {
                showToast('Ovoz aniqlanmadi. Qaytadan urinib ko\'ring.', true);
            } else if (event.error === 'not-allowed') {
                showToast('Mikrofonga ruxsat berilmagan. Brauzer sozlamalaridan ruxsat bering.', true);
            } else if (event.error !== 'aborted') {
                showToast(`Xatolik: ${event.error}`, true);
            }
            stopRecording();
        };

        recognition.onend = () => {
            if (isRecording) {
                try {
                    recognition.start();
                } catch (e) {
                    stopRecording();
                }
            }
        };
    }

    function startRecording() {
        if (!recognition) return;
        finalTranscript = '';
        currentTranscript = '';
        try {
            recognition.start();
        } catch (e) {
            console.error('Ovoz yozishni boshlashda xatolik:', e);
        }
    }

    function stopRecording() {
        isRecording = false;
        if (recognition) {
            try {
                recognition.stop();
            } catch (e) { }
        }
        micBtn.classList.remove('recording');
        micLabel.textContent = 'Bosing va gapiring';
        statusDot.className = 'status-dot';
        statusText.textContent = 'Tayyor';
        pulseRing.classList.remove('active');
        document.querySelector('.input-panel').classList.remove('active');

        // Oxirgi tarjima
        if (currentTranscript.trim()) {
            translateText(currentTranscript.trim());
        }
    }

    function updateInputDisplay(text, hasInterim) {
        if (!text) {
            inputText.innerHTML = '<p class="placeholder-text">Mikrofon tugmasini bosing va o\'zbekcha gapiring...</p>';
            charCount.textContent = '0 belgi';
            return;
        }

        inputText.innerHTML = `<span>${escapeHtml(text)}</span>${hasInterim ? '<span class="typing-cursor"></span>' : ''}`;
        charCount.textContent = `${text.length} belgi`;
    }

    // ========================================
    // Tarjima
    // ========================================
    async function translateText(text) {
        if (!text.trim()) return;

        setStatus('translating', 'Tarjima qilinyapti...');

        try {
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text.trim(),
                    target_lang: currentTargetLang
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Tarjima amalga oshmadi');
            }

            // Tarjimani ko'rsatish
            displayTranslation(data.translated_text);
            lastAudioUrl = data.audio_url;

            // Tarixga qo'shish
            addToHistory({
                original: text.trim(),
                translated: data.translated_text,
                langCode: currentTargetLang,
                langName: data.target_lang_uz_name,
                audioUrl: data.audio_url,
                timestamp: Date.now()
            });

            // Avto-ovoz
            if (autoPlayToggle.checked && data.audio_url) {
                playAudio(data.audio_url);
            }

            setStatus('ready', 'Tayyor');
            document.querySelector('.output-panel').classList.add('has-content');

        } catch (error) {
            console.error('Tarjima xatoligi:', error);
            showToast('Tarjima amalga oshmadi. Internet aloqasini tekshiring.', true);
            setStatus('ready', 'Tayyor');
        }
    }

    function displayTranslation(text) {
        outputText.innerHTML = '';
        const span = document.createElement('span');
        span.style.opacity = '0';
        span.style.transform = 'translateY(8px)';
        span.style.display = 'inline-block';
        span.style.transition = 'all 0.4s ease';
        span.textContent = text;
        outputText.appendChild(span);

        requestAnimationFrame(() => {
            span.style.opacity = '1';
            span.style.transform = 'translateY(0)';
        });
    }

    // ========================================
    // Ovoz ijrosi
    // ========================================
    function playAudio(url) {
        if (!url) {
            showToast('Ovoz mavjud emas', true);
            return;
        }

        audioPlayer.src = url;
        audioPlayer.play().catch(err => {
            console.error('Ovoz ijro etilmadi:', err);
        });

        playBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="4" y="3" width="4" height="12" rx="1" fill="currentColor"/>
                <rect x="10" y="3" width="4" height="12" rx="1" fill="currentColor"/>
            </svg>
        `;

        audioPlayer.onended = () => {
            playBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M4 3l12 6-12 6V3z" fill="currentColor"/>
                </svg>
            `;
        };
    }

    // ========================================
    // Tarix
    // ========================================
    function addToHistory(entry) {
        translationHistory.unshift(entry);
        if (translationHistory.length > 50) {
            translationHistory = translationHistory.slice(0, 50);
        }
        renderHistory();
        saveHistory();
    }

    function renderHistory() {
        if (translationHistory.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.3">
                        <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2"/>
                        <path d="M24 14v10l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <p>Tarjimalaringiz shu yerda paydo bo'ladi</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = translationHistory.map((entry, index) => {
            const lang = languages[entry.langCode] || { flag: '--', uz_name: entry.langName };
            const time = formatTime(entry.timestamp);
            return `
                <div class="history-item" data-index="${index}">
                    <div class="history-texts">
                        <div class="history-original">
                            <span class="history-lang-tag">UZ</span>
                            <span>${escapeHtml(entry.original)}</span>
                        </div>
                        <div class="history-translated">
                            <span class="history-lang-tag target">${entry.langCode.toUpperCase()}</span>
                            <span>${escapeHtml(entry.translated)}</span>
                        </div>
                    </div>
                    <div class="history-actions">
                        ${entry.audioUrl ? `
                        <button class="history-play-btn" data-audio="${entry.audioUrl}" title="Tinglash">
                            <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                                <path d="M4 3l12 6-12 6V3z" fill="currentColor"/>
                            </svg>
                        </button>
                        ` : ''}
                        <span class="history-time">${time}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Tarix play tugmalari
        historyList.querySelectorAll('.history-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                playAudio(btn.dataset.audio);
            });
        });
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Hozir';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} daq. oldin`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} soat oldin`;
        return date.toLocaleDateString('uz-UZ');
    }

    function saveHistory() {
        try {
            localStorage.setItem('tilgo_history', JSON.stringify(translationHistory.slice(0, 50)));
        } catch (e) { }
    }

    function loadHistory() {
        try {
            const saved = localStorage.getItem('tilgo_history');
            if (saved) {
                translationHistory = JSON.parse(saved);
                renderHistory();
            }

            // Saqlangan tilni yuklash
            const savedLang = localStorage.getItem('tilgo_target_lang');
            if (savedLang && languages[savedLang]) {
                selectLanguage(savedLang);
            }
        } catch (e) { }
    }

    // ========================================
    // UI yordamchi funksiyalar
    // ========================================
    function setStatus(status, text) {
        statusDot.className = `status-dot ${status === 'translating' ? 'translating' : status === 'recording' ? 'recording' : ''}`;
        statusText.textContent = text;
    }

    function showToast(message, isError = false) {
        toastMessage.textContent = message;
        const icon = toast.querySelector('.toast-icon');
        if (isError) {
            icon.textContent = '!';
            icon.style.background = 'rgba(239, 68, 68, 0.2)';
            icon.style.color = '#ef4444';
        } else {
            icon.textContent = '+';
            icon.style.background = 'rgba(16, 185, 129, 0.2)';
            icon.style.color = '#10b981';
        }

        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function openLangDropdown() {
        langDropdown.classList.add('open');
        document.querySelector('.chevron').classList.add('open');
        langSearch.focus();
    }

    function closeLangDropdown() {
        langDropdown.classList.remove('open');
        document.querySelector('.chevron').classList.remove('open');
        langSearch.value = '';
        renderLanguageList();
    }

    // ========================================
    // Hodisa tinglovchilar
    // ========================================
    function setupEventListeners() {
        // Mikrofon tugmasi
        micBtn.addEventListener('click', () => {
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        });

        // Til tanlash
        targetLangBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (langDropdown.classList.contains('open')) {
                closeLangDropdown();
            } else {
                openLangDropdown();
            }
        });

        // Til qidirish
        langSearch.addEventListener('input', (e) => {
            renderLanguageList(e.target.value);
        });

        // Tashqarini bosganda yopish
        document.addEventListener('click', (e) => {
            if (!langDropdown.contains(e.target) && !targetLangBtn.contains(e.target)) {
                closeLangDropdown();
            }
        });

        // Nusxa olish
        copyBtn.addEventListener('click', () => {
            const text = outputText.textContent;
            if (text && text !== 'Tarjima shu yerda paydo bo\'ladi...') {
                navigator.clipboard.writeText(text).then(() => {
                    showToast('Nusxa olindi!');
                });
            }
        });

        // Tinglash tugmasi
        playBtn.addEventListener('click', () => {
            if (lastAudioUrl) {
                playAudio(lastAudioUrl);
            } else {
                showToast('Tinglash uchun tarjima mavjud emas', true);
            }
        });

        // Tozalash
        clearBtn.addEventListener('click', () => {
            inputText.innerHTML = '<p class="placeholder-text">Mikrofon tugmasini bosing va o\'zbekcha gapiring...</p>';
            outputText.innerHTML = '<p class="placeholder-text">Tarjima shu yerda paydo bo\'ladi...</p>';
            charCount.textContent = '0 belgi';
            lastAudioUrl = null;
            currentTranscript = '';
            finalTranscript = '';
            document.querySelector('.output-panel').classList.remove('has-content');
        });

        // Tarixni tozalash
        clearHistoryBtn.addEventListener('click', () => {
            translationHistory = [];
            renderHistory();
            saveHistory();
            showToast('Tarix tozalandi');
        });

        // Klaviatura yorliqlari
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                micBtn.click();
            }
        });
    }
});
