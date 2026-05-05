// EchoSync AI - Premium Intelligence Logic
class EchoSync {
    constructor() {
        this.initLanding();
        this.initSTT();
        this.initTTS();
        this.initVisualizer();
        this.initMetrics();
        this.bindEvents();
    }

    initMetrics() {
        const savedMetrics = localStorage.getItem('echosync_metrics');
        if (savedMetrics) {
            this.metrics = JSON.parse(savedMetrics);
            // Support legacy format or ensure all keys exist
            this.metrics.stt = this.metrics.stt || { total: 0, count: 0 };
            this.metrics.tts = this.metrics.tts || { total: 0, count: 0 };
            this.metrics.ai = this.metrics.ai || { total: 0, count: 0 };
            this.metrics.wordCount = this.metrics.wordCount || 0;
            this.metrics.charCount = this.metrics.charCount || 0;

            // Update UI with saved values
            this.updateMetric('stt-latency', `${(this.metrics.stt.total / (this.metrics.stt.count || 1)).toFixed(2)}s`);
            this.updateMetric('tts-latency', `${(this.metrics.tts.total / (this.metrics.tts.count || 1)).toFixed(2)}s`);
            this.updateMetric('ai-latency', `${(this.metrics.ai.total / (this.metrics.ai.count || 1)).toFixed(2)}s`);
            this.updateMetric('word-count', this.metrics.wordCount);
            this.updateMetric('char-count', this.metrics.charCount);
        } else {
            this.metrics = {
                stt: { total: 0, count: 0 },
                tts: { total: 0, count: 0 },
                ai: { total: 0, count: 0 },
                wordCount: 0,
                charCount: 0
            };
        }
    }

    saveMetrics() {
        localStorage.setItem('echosync_metrics', JSON.stringify(this.metrics));
    }

    initLanding() {
        this.landingScreen = document.getElementById('landing-screen');
        this.dashboardScreen = document.getElementById('dashboard-screen');
        this.getStartedBtn = document.getElementById('get-started');
        this.backBtn = document.getElementById('back-to-landing');
        this.modeSelector = document.getElementById('app-mode');
        this.sttCard = document.getElementById('stt-card');
        this.ttsCard = document.getElementById('tts-card');
        this.modeDescription = document.getElementById('mode-description');
    }

    // --- Speech to Text (STT) via Whisper Backend ---
    initSTT() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.sttStatus = document.getElementById('stt-status');
        this.sttDot = document.getElementById('stt-dot');
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                await this.transcribeAudio(audioBlob);
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateSTTUI(true, 'Recording...');
            this.startVisualizer(stream);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone. Please ensure permissions are granted.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateSTTUI(false, 'Processing with Whisper...');
            this.stopVisualizer();
        }
    }

    async transcribeAudio(blob) {
        const formData = new FormData();
        formData.append('audio', blob);

        const startTime = performance.now();
        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            const endTime = performance.now();
            
            if (data.text) {
                const textArea = document.getElementById('stt-result');
                textArea.value += data.text + ' ';
                this.updateSTTUI(false, 'System Ready');
                
                // Update Metrics
                const latency = (endTime - startTime) / 1000;
                this.metrics.stt.total += latency;
                this.metrics.stt.count++;
                this.saveMetrics();
                this.updateMetric('stt-latency', `${(this.metrics.stt.total / this.metrics.stt.count).toFixed(2)}s`);
                
                const words = data.text.split(/\s+/).filter(w => w).length;
                this.metrics.wordCount = (this.metrics.wordCount || 0) + words;
                this.saveMetrics();
                this.updateMetric('word-count', this.metrics.wordCount);

                // Auto-analyze sentiment
                this.handleAIAction('tone', 'stt-result', null);

                // --- CONVERSATION MODE LOOP ---
                if (document.getElementById('conversation-toggle').checked) {
                    this.handleConversation(data.text);
                }
            } else {
                this.updateSTTUI(false, 'Error: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Transcription error:', err);
            this.updateSTTUI(false, 'Connection Error');
        }
    }

    updateSTTUI(active, text) {
        const btn = document.getElementById('start-stt');
        if (active) {
            this.sttDot.classList.add('active');
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12"/></svg> Stop`;
            btn.classList.add('recording');
        } else {
            this.sttDot.classList.remove('active');
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg> Start Recording`;
            btn.classList.remove('recording');
        }
        this.sttStatus.textContent = text;
    }

    initTTS() {
        this.synth = window.speechSynthesis;
        this.voices = [];
        this.speakBtn = document.getElementById('speak-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.voiceSelect = document.getElementById('voice-select');
        this.translateSelect = document.getElementById('translate-lang');
        
        this.langCodeMap = {
            'Hindi': 'hi',
            'Telugu': 'te',
            'Tamil': 'ta',
            'Kannada': 'kn',
            'Malayalam': 'ml',
            'Bengali': 'bn',
            'Marathi': 'mr',
            'Gujarati': 'gu',
            'Punjabi': 'pa',
            'Urdu': 'ur',
            'Spanish': 'es',
            'French': 'fr',
            'German': 'de',
            'Italian': 'it',
            'Portuguese': 'pt',
            'Dutch': 'nl',
            'Russian': 'ru',
            'Turkish': 'tr',
            'Japanese': 'ja',
            'Korean': 'ko',
            'Chinese': 'zh',
            'Arabic': 'ar',
            'Vietnamese': 'vi',
            'Thai': 'th',
            'Indonesian': 'id',
            'Greek': 'el',
            'Hebrew': 'he',
            'Polish': 'pl',
            'Swedish': 'sv',
            'Danish': 'da',
            'Finnish': 'fi',
            'Norwegian': 'no',
            'Czech': 'cs',
            'Hungarian': 'hu',
            'Romanian': 'ro',
            'Ukrainian': 'uk',
            'Malay': 'ms',
            'Filipino': 'fil',
            'Khmer': 'km',
            'Lao': 'lo',
            'Burmese': 'my',
            'Nepali': 'ne',
            'Sinhala': 'si',
            'Persian': 'fa',
            'Afrikaans': 'af',
            'Swahili': 'sw'
        };

        const loadVoices = () => {
            this.voices = this.synth.getVoices();
            if (this.voices.length === 0) return;
            this.updateVoiceDropdown();
        };

        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = loadVoices;
        }
        loadVoices();
    }

    updateVoiceDropdown() {
        const targetLang = this.translateSelect.value;
        const currentSelection = this.voiceSelect.value;
        this.voiceSelect.innerHTML = '';

        let filteredVoices = this.voices;
        
        if (targetLang) {
            const langCode = this.langCodeMap[targetLang];
            filteredVoices = this.voices.filter(v => v.lang.toLowerCase().includes(langCode));
            
            // If no voices found for target lang, show all but add a warning or just show all
            if (filteredVoices.length === 0) {
                const opt = document.createElement('option');
                opt.textContent = `No ${targetLang} voices found on system`;
                opt.disabled = true;
                this.voiceSelect.appendChild(opt);
                filteredVoices = this.voices; // Show all as fallback
            }
        }

        filteredVoices.forEach((voice, i) => {
            const originalIndex = this.voices.indexOf(voice);
            const option = document.createElement('option');
            option.value = originalIndex;
            option.textContent = `${voice.name} (${voice.lang})`;
            if (voice.default && !targetLang) option.selected = true;
            this.voiceSelect.appendChild(option);
        });

        // Try to restore selection or pick first available
        if (filteredVoices.length > 0 && !this.voiceSelect.value) {
            this.voiceSelect.selectedIndex = 0;
        }
    }

    async applyPersona(text, persona) {
        if (!persona) return text;
        
        const startTime = performance.now();
        try {
            const response = await fetch('/api/ai-process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'persona', text, persona })
            });
            const data = await response.json();
            const endTime = performance.now();

            // Update Metrics
            const latency = (endTime - startTime) / 1000;
            this.metrics.processing.total += latency;
            this.metrics.processing.count++;
            this.saveMetrics();
            this.updateMetric('tts-latency', `${(this.metrics.processing.total / this.metrics.processing.count).toFixed(2)}s`);

            return data.result || text;
        } catch (err) {
            console.error('Persona error:', err);
            return text;
        }
    }

    async speak(overrideText = null) {
        if (this.synth.speaking) {
            this.synth.cancel();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        let text = overrideText || document.getElementById('tts-input').value;
        const targetLang = document.getElementById('translate-lang').value;
        const persona = document.getElementById('persona-select').value;
        
        if (!text) return;

        this.speakBtn.disabled = true;
        this.speakBtn.textContent = 'Processing...';

        // Only apply persona if we aren't already speaking an AI-generated chat reply
        if (persona && !overrideText) {
            this.speakBtn.textContent = 'Rewriting...';
            text = await this.applyPersona(text, persona);
            document.getElementById('translated-text').value = text;
            this.switchTextPane(document.getElementById('tts-text-toggle'), 'processed');
        }

        let speakText = text;
        const translatedTextArea = document.getElementById('translated-text');

        if (targetLang) {
            const startTime = performance.now();
            try {
                const response = await fetch('/api/translate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, target_lang: targetLang })
                });
                const data = await response.json();
                const endTime = performance.now();

                if (data.translated_text) {
                    speakText = data.translated_text;
                    // Show translated text in the results area
                    translatedTextArea.value = speakText;
                    this.modeDescription.textContent = `Translated to ${targetLang}`;
                    // Auto-switch to Processed tab
                    const ttsToggle = document.getElementById('tts-text-toggle');
                    this.switchTextPane(ttsToggle, 'processed');
                    
                    // Update Metrics
                    const latency = (endTime - startTime) / 1000;
                    this.metrics.processing.total += latency;
                    this.metrics.processing.count++;
                    this.saveMetrics();
                    this.updateMetric('tts-latency', `${(this.metrics.processing.total / this.metrics.processing.count).toFixed(2)}s`);

                    const words = speakText.split(/\s+/).filter(w => w).length;
                    this.metrics.wordCount = (this.metrics.wordCount || 0) + words;
                    this.saveMetrics();
                    this.updateMetric('word-count', this.metrics.wordCount);
                } else {
                    console.warn('Translation returned no text:', data);
                    alert('Translation failed: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                console.error('Translation error:', err);
                alert('Could not connect to translation service.');
            }
        }

        const startTTS = performance.now();
        const utterance = new SpeechSynthesisUtterance(speakText);
        
        // Track TTS Metrics
        utterance.onstart = () => {
            const endTTS = performance.now();
            const ttsLatency = (endTTS - startTTS) / 1000;
            this.metrics.tts.total += ttsLatency;
            this.metrics.tts.count++;
            this.metrics.charCount += speakText.length;
            this.saveMetrics();
            
            this.updateMetric('tts-latency', `${(this.metrics.tts.total / this.metrics.tts.count).toFixed(2)}s`);
            this.updateMetric('char-count', this.metrics.charCount);
        };

        const voiceSelect = document.getElementById('voice-select');
        let selectedVoiceIndex = voiceSelect.value;
        
        // Auto-select voice for target language if translating
        if (targetLang) {
            const langCode = this.langCodeMap[targetLang] || targetLang.substring(0, 2).toLowerCase();
            utterance.lang = langCode; // Set language explicitly

            const bestVoiceIndex = this.voices.findIndex(v => v.lang.toLowerCase().includes(langCode));
            
            if (bestVoiceIndex !== -1) {
                utterance.voice = this.voices[bestVoiceIndex];
                // Update the dropdown UI to show the correct voice
                voiceSelect.value = bestVoiceIndex;
            } else if (selectedVoiceIndex) {
                utterance.voice = this.voices[selectedVoiceIndex];
            }
        } else {
            utterance.lang = 'en-US';
            if (selectedVoiceIndex) {
                utterance.voice = this.voices[selectedVoiceIndex];
            }
        }

        utterance.pitch = document.getElementById('pitch').value;
        utterance.rate = document.getElementById('rate').value;

        this.synth.speak(utterance);
        this.speakBtn.disabled = false;
        this.speakBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Generate Audio`;
        
        // Show stop button while speaking
        this.stopBtn.style.display = 'flex';
        
        utterance.onend = () => {
            this.stopBtn.style.display = 'none';
        };
        utterance.onerror = () => {
            this.stopBtn.style.display = 'none';
        };
    }

    stopSpeaking() {
        this.synth.cancel();
        this.stopBtn.style.display = 'none';
    }



    // --- Audio Visualizer ---
    initVisualizer() {
        this.canvas = document.getElementById('visualizer');
        this.ctx = this.canvas.getContext('2d');
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.animationId = null;
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    }

    async startVisualizer(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);

        this.draw();
    }

    stopVisualizer() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this.audioContext) this.audioContext.close();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw() {
        this.animationId = requestAnimationFrame(() => this.draw());
        this.analyser.getByteFrequencyData(this.dataArray);

        const width = this.canvas.width;
        const height = this.canvas.height;
        this.ctx.clearRect(0, 0, width, height);

        const barWidth = (width / this.dataArray.length) * 0.8;
        const centerX = width / 2;
        
        for (let i = 0; i < this.dataArray.length; i++) {
            const barHeight = (this.dataArray[i] / 255) * height * 0.8;
            
            // Get color from dynamic theme
            const accent = getComputedStyle(document.body).getPropertyValue('--accent-dynamic').trim();
            
            this.ctx.fillStyle = accent;
            this.ctx.globalAlpha = 0.3 + (barHeight/height);
            
            // Draw Symmetric (Mirrored) Bars
            // Right side
            this.ctx.fillRect(centerX + (i * barWidth), height - barHeight, barWidth - 2, barHeight);
            // Left side
            this.ctx.fillRect(centerX - (i * barWidth) - barWidth, height - barHeight, barWidth - 2, barHeight);
        }
        this.ctx.globalAlpha = 1.0;
    }

    async handleAIAction(action, targetId, btn) {
        const targetElement = document.getElementById(targetId);
        const text = targetElement.value.trim();
        
        if (!text) {
            alert('Please provide some text first.');
            return;
        }

        let originalText = '';
        if (btn) {
            originalText = btn.innerHTML;
            btn.innerHTML = `<span class="ai-processing" style="display:inline-block; min-width:60px;">Wait...</span>`;
            btn.disabled = true;
        }

        const startTime = performance.now();
        try {
            const response = await fetch('/api/ai-process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, text })
            });

            const data = await response.json();
            const endTime = performance.now();

            if (data.result) {
                // Don't track 'tone' in avg latency as it's an background/utility call
                if (action !== 'tone') {
                    const latency = (endTime - startTime) / 1000;
                    this.metrics.processing.total += latency;
                    this.metrics.processing.count++;
                    this.saveMetrics();
                    this.updateMetric('tts-latency', `${(this.metrics.processing.total / this.metrics.processing.count).toFixed(2)}s`);
                }

                if (action === 'tone') {
                    try {
                        const toneData = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
                        this.updateUITheme(toneData.category, toneData.label);
                        
                        let badgeId = targetId === 'tts-input' ? 'tts-tone-badge' : 'stt-tone-badge';
                        const badge = document.getElementById(badgeId);
                        badge.textContent = `Tone: ${toneData.label}`;
                        badge.style.display = 'inline-block';
                    } catch (e) {
                        console.error('Tone parsing error:', e, data.result);
                    }
                } else {
                    // Send result to the processed text area
                    const resultTargetId = targetId === 'tts-input' ? 'translated-text' : 'stt-processed-text';
                    document.getElementById(resultTargetId).value = data.result;

                    // Auto-switch to Processed tab
                    const toggleId = targetId === 'tts-input' ? 'tts-text-toggle' : 'stt-text-toggle';
                    this.switchTextPane(document.getElementById(toggleId), 'processed');
                    
                    let badgeId = targetId === 'tts-input' ? 'tts-tone-badge' : 'stt-tone-badge';
                    const b = document.getElementById(badgeId);
                    if (b) b.style.display = 'none';
                }
            } else {
                if (btn) alert('AI Error: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('AI error:', err);
            if (btn) alert('Could not connect to AI service.');
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    }

    updateUITheme(category, label) {
        // Reset themes
        document.body.classList.remove('theme-positive', 'theme-urgent', 'theme-analytical');
        
        // Apply new theme
        if (category === 'positive') document.body.classList.add('theme-positive');
        else if (category === 'urgent') document.body.classList.add('theme-urgent');
        else if (category === 'analytical') document.body.classList.add('theme-analytical');

        // Update Sentiment Badge
        const badge = document.getElementById('sentiment-badge');
        badge.textContent = label;
        badge.style.display = 'inline-block';
        
        // Add a "Pulse" effect to the header
        const header = document.querySelector('.header-top');
        header.style.borderColor = 'var(--accent-dynamic)';
        setTimeout(() => header.style.borderColor = '', 1500);
    }

    async handleConversation(userText) {
        const persona = document.getElementById('persona-select').value;
        const thinkingIndicator = document.getElementById('ai-thinking');
        const processedArea = document.getElementById('stt-processed-text');
        
        thinkingIndicator.classList.remove('hidden');
        processedArea.value = "AI is thinking...";
        
        const startTime = performance.now();
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: userText, persona })
            });
            const data = await response.json();
            const endTime = performance.now();
            
            if (data.reply) {
                // Update AI Metrics
                const latency = (endTime - startTime) / 1000;
                this.metrics.ai.total += latency;
                this.metrics.ai.count++;
                this.saveMetrics();
                this.updateMetric('ai-latency', `${(this.metrics.ai.total / this.metrics.ai.count).toFixed(2)}s`);

                // Show AI reply in the processed area
                processedArea.value = data.reply;
                
                // Switch to processed tab to show the chat
                this.switchTextPane(document.getElementById('stt-text-toggle'), 'processed');
                
                // Automatically speak the reply
                this.speak(data.reply);
            } else {
                processedArea.value = "AI Error: " + (data.error || "Received empty response from brain.");
            }
        } catch (err) {
            console.error('Chat error:', err);
            processedArea.value = "Connection Error: Could not reach the AI brain. Ensure app.py is running.";
        } finally {
            thinkingIndicator.classList.add('hidden');
        }
    }

    // --- Event Binding ---
    bindEvents() {
        this.toggleSidebarBtn = document.getElementById('toggle-sidebar');
        this.sidebar = document.getElementById('sidebar');

        this.toggleSidebarBtn.addEventListener('click', () => {
            this.sidebar.classList.toggle('collapsed');
            // Resize canvas after the 400ms CSS transition
            setTimeout(() => this.resizeCanvas(), 400);
        });

        this.getStartedBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.landingScreen.classList.add('fade-out');
            setTimeout(() => {
                this.landingScreen.style.display = 'none';
                this.dashboardScreen.classList.remove('hidden');
                this.dashboardScreen.style.display = 'flex';
                this.dashboardScreen.classList.add('fade-in');
                this.resizeCanvas(); // Ensure visualizer is correct size
            }, 500);
        });

        // Sidebar Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                const view = item.getAttribute('data-view');
                this.switchView(view);
            });
        });

        // Text Panel Toggles
        document.querySelectorAll('.text-toggle').forEach(toggle => {
            toggle.querySelectorAll('.toggle-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    this.switchTextPane(toggle, pill.getAttribute('data-pane'));
                });
            });
        });

        this.backBtn.addEventListener('click', () => {
            this.dashboardScreen.classList.add('fade-out');
            setTimeout(() => {
                this.dashboardScreen.style.display = 'none';
                this.dashboardScreen.classList.add('hidden');
                this.landingScreen.style.display = 'flex';
                this.landingScreen.classList.remove('fade-out');
                this.landingScreen.classList.add('fade-in');
            }, 500);
        });

        document.getElementById('file-upload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const ttsInput = document.getElementById('tts-input');
            const originalPlaceholder = ttsInput.placeholder;
            ttsInput.placeholder = "Extracting text from file... Please wait.";
            ttsInput.value = "";

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/extract-text', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                
                if (data.text) {
                    ttsInput.value = data.text;
                    ttsInput.placeholder = originalPlaceholder;
                } else {
                    alert('Extraction failed: ' + (data.error || 'Unknown error'));
                    ttsInput.placeholder = originalPlaceholder;
                }
            } catch (err) {
                console.error('Extraction error:', err);
                alert('Could not connect to text extraction service.');
                ttsInput.placeholder = originalPlaceholder;
            }
            
            // Clear input so same file can be uploaded again if needed
            e.target.value = '';
        });

        this.modeSelector.addEventListener('change', (e) => {
            const mode = e.target.value;
            if (mode === 'stt') {
                this.sttCard.classList.remove('hidden');
                this.ttsCard.classList.add('hidden');
                this.modeDescription.textContent = 'Speech to Text Intelligence';
                this.resizeCanvas();
            } else {
                this.sttCard.classList.add('hidden');
                this.ttsCard.classList.remove('hidden');
                this.modeDescription.textContent = 'Generative Voice Synthesis';
            }
        });

        this.translateSelect.addEventListener('change', () => {
            this.updateVoiceDropdown();
        });

        document.getElementById('start-stt').addEventListener('click', () => {
            if (this.isRecording) this.stopRecording();
            else this.startRecording();
        });

        document.getElementById('speak-btn').addEventListener('click', () => this.speak());

        document.getElementById('stop-btn').addEventListener('click', () => this.stopSpeaking());

        document.getElementById('copy-stt').addEventListener('click', () => {
            const textArea = document.getElementById('stt-result');
            textArea.select();
            document.execCommand('copy');
            alert('Copied to clipboard!');
        });

        document.getElementById('clear-stt').addEventListener('click', () => {
            document.getElementById('stt-result').value = '';
        });

        document.querySelectorAll('.ai-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const action = btn.getAttribute('data-action');
                const target = btn.getAttribute('data-target');
                this.handleAIAction(action, target, btn);
            });
        });
    }

    switchView(viewId) {
        // Update Sidebar
        document.querySelectorAll('.nav-item').forEach(nav => {
            nav.classList.remove('active');
            if (nav.getAttribute('data-view') === viewId) nav.classList.add('active');
        });

        // Update Panels
        document.querySelectorAll('.view-panel').forEach(panel => {
            panel.classList.add('hidden');
        });
        document.getElementById(`view-${viewId}`).classList.remove('hidden');

        if (viewId === 'home') this.resizeCanvas();
    }

    updateMetric(id, value) {
        const el1 = document.getElementById(`metric-${id}`);
        const el2 = document.getElementById(`eval-${id}`);
        if (el1) el1.textContent = value;
        if (el2) el2.textContent = value;
    }

    switchTextPane(toggleContainer, paneId) {
        // Update pill states
        toggleContainer.querySelectorAll('.toggle-pill').forEach(p => {
            p.classList.toggle('active', p.getAttribute('data-pane') === paneId);
        });

        // Update text pane visibility
        const panel = toggleContainer.closest('.text-panel') || toggleContainer.closest('.card');
        const wrapper = panel.querySelector('.text-pane-wrapper');
        if (!wrapper) return;
        const panes = wrapper.querySelectorAll('.text-pane');
        const isOriginal = paneId === 'original';
        panes[0].classList.toggle('active', isOriginal);  // first = original
        panes[1].classList.toggle('active', !isOriginal); // second = processed
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new EchoSync();
});
