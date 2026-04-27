// EchoSync AI - Premium Intelligence Logic
class EchoSync {
    constructor() {
        this.initLanding();
        this.initSTT();
        this.initTTS();
        this.initVisualizer();
        this.bindEvents();
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
                const latency = ((endTime - startTime) / 1000).toFixed(2);
                document.getElementById('metric-stt-latency').textContent = `${latency}s`;
                document.getElementById('metric-word-count').textContent = data.text.split(/\s+/).length;
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
            'Spanish': 'es',
            'French': 'fr',
            'German': 'de',
            'Italian': 'it',
            'Portuguese': 'pt',
            'Russian': 'ru',
            'Japanese': 'ja',
            'Korean': 'ko',
            'Chinese': 'zh',
            'Arabic': 'ar'
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

    async speak() {
        if (this.synth.speaking) {
            this.synth.cancel();
            // Small pause to allow synth to reset
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        let text = document.getElementById('tts-input').value;
        const targetLang = document.getElementById('translate-lang').value;
        
        if (!text) return;

        this.speakBtn.disabled = true;
        this.speakBtn.textContent = 'Processing...';

        // Translation Step
        let speakText = text;
        const translatedGroup = document.getElementById('translated-group');
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
                    // Show translated text in the new area
                    translatedTextArea.value = speakText;
                    translatedGroup.style.display = 'block';
                    this.modeDescription.textContent = `Translated to ${targetLang}`;
                    
                    // Update Metrics
                    const latency = ((endTime - startTime) / 1000).toFixed(2);
                    document.getElementById('metric-tts-latency').textContent = `${latency}s`;
                    document.getElementById('metric-word-count').textContent = speakText.split(/\s+/).length;
                } else {
                    console.warn('Translation returned no text:', data);
                    alert('Translation failed: ' + (data.error || 'Unknown error'));
                }
            } catch (err) {
                console.error('Translation error:', err);
                alert('Could not connect to translation service.');
            }
        }
 else {
            // Hide translation area if no translation selected
            translatedGroup.style.display = 'none';
        }

        const utterance = new SpeechSynthesisUtterance(speakText);
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

        const barWidth = (width / this.dataArray.length);
        let x = 0;

        for (let i = 0; i < this.dataArray.length; i++) {
            const barHeight = (this.dataArray[i] / 255) * height;
            
            this.ctx.fillStyle = `rgba(139, 92, 246, ${0.3 + (barHeight/height)})`;
            this.ctx.fillRect(x, height - barHeight, barWidth - 2, barHeight);
            x += barWidth;
        }
    }

    // --- Event Binding ---
    bindEvents() {
        this.getStartedBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.landingScreen.classList.add('fade-out');
            setTimeout(() => {
                this.landingScreen.style.display = 'none';
                this.dashboardScreen.classList.remove('hidden');
                this.dashboardScreen.style.display = 'block';
                this.dashboardScreen.classList.add('fade-in');
                this.resizeCanvas(); // Ensure visualizer is correct size
            }, 500);
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
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new EchoSync();
});
