from flask import Flask, send_from_directory, request, jsonify
from flask_cors import CORS
import os
import whisper
import torch
from gtts import gTTS
import uuid
import subprocess
from google import genai
from dotenv import load_dotenv
import PyPDF2
from docx import Document

load_dotenv(override=True)

# Configure Gemini (Lazy initialization to prevent startup crash)
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key) if api_key else None

app = Flask(__name__, static_folder='frontend')
CORS(app)

# Configuration
PORT = int(os.environ.get("PORT", 7860))
HOST = '0.0.0.0'
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Load Whisper Model (Global)
print("Loading Whisper model...")
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisper.load_model("base", device=device)
print(f"Model loaded on {device}")

# Language name -> gTTS code mapping
LANG_CODE_MAP = {
    'Hindi': 'hi', 'Telugu': 'te', 'Tamil': 'ta', 'Kannada': 'kn',
    'Malayalam': 'ml', 'Bengali': 'bn', 'Marathi': 'mr', 'Gujarati': 'gu',
    'Punjabi': 'pa', 'Urdu': 'ur', 'Spanish': 'es', 'French': 'fr',
    'German': 'de', 'Italian': 'it', 'Portuguese': 'pt', 'Dutch': 'nl',
    'Russian': 'ru', 'Turkish': 'tr', 'Japanese': 'ja', 'Korean': 'ko',
    'Chinese': 'zh-CN', 'Arabic': 'ar', 'Vietnamese': 'vi', 'Thai': 'th',
    'Indonesian': 'id', 'Greek': 'el', 'Hebrew': 'iw', 'Polish': 'pl',
    'Swedish': 'sv', 'Danish': 'da', 'Finnish': 'fi', 'Norwegian': 'no',
    'Czech': 'cs', 'Hungarian': 'hu', 'Romanian': 'ro', 'Ukrainian': 'uk',
    'Malay': 'ms', 'Filipino': 'fil', 'Khmer': 'km', 'Nepali': 'ne',
    'Sinhala': 'si', 'Persian': 'fa', 'Afrikaans': 'af', 'Swahili': 'sw'
}

@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory('frontend', path)

@app.route('/api/status')
def status():
    return {"status": "AudioMind Backend Active", "version": "1.1.0", "device": device}

@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files['audio']
    filename = f"{uuid.uuid4()}.webm"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    audio_file.save(filepath)
    
    # Convert WebM to WAV (Whisper prefers WAV/MP3)
    wav_path = filepath.replace('.webm', '.wav')
    try:
        subprocess.run(['ffmpeg', '-i', filepath, wav_path, '-y'], check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        return jsonify({"error": f"FFmpeg conversion failed: {e.stderr.decode()}"}), 500
    
    try:
        result = model.transcribe(wav_path)
        text = result['text']
        return jsonify({"text": text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        # Cleanup
        if os.path.exists(filepath): os.remove(filepath)
        if os.path.exists(wav_path): os.remove(wav_path)

@app.route('/api/synthesize', methods=['POST'])
def synthesize():
    data = request.json
    text = data.get('text')
    lang = data.get('lang', 'en')
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    # Map language name to gTTS code if needed
    if lang in LANG_CODE_MAP:
        lang = LANG_CODE_MAP[lang]
    
    # Clean up old audio files (older than 5 minutes)
    import time
    now = time.time()
    for f in os.listdir(UPLOAD_FOLDER):
        fpath = os.path.join(UPLOAD_FOLDER, f)
        if f.endswith('.mp3') and os.path.isfile(fpath):
            if now - os.path.getmtime(fpath) > 300:
                try:
                    os.remove(fpath)
                except:
                    pass
    
    try:
        tts = gTTS(text=text, lang=lang)
        filename = f"{uuid.uuid4()}.mp3"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        tts.save(filepath)
        
        # Return the URL to the file
        return jsonify({"url": f"/uploads/{filename}"})
    except Exception as e:
        print(f"TTS Synthesis error: {e}", flush=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/translate', methods=['POST'])
def translate():
    data = request.json
    text = data.get('text')
    target_lang = data.get('target_lang')
    
    if not text or not target_lang:
        return jsonify({"error": "Missing text or target language"}), 400
    
    try:
        prompt = f"Translate the following English text to {target_lang}. Return ONLY the translated text, no other comments: {text}"
        
        # List of models to try in order of preference
        models_to_try = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest']
        
        # Use the failover client list
        if not clients:
            return jsonify({"error": "No API keys configured. Please add GEMINI_API_KEY to secrets."}), 500

        last_error = None
        for current_client in clients:
            for model_name in models_to_try:
                try:
                    response = current_client.models.generate_content(
                        model=model_name,
                        contents=prompt
                    )
                    translated_text = response.text.strip()
                    return jsonify({"translated_text": translated_text})
                except Exception as e:
                    last_error = e
                    continue
                
        # If we get here, all models failed
        error_msg = str(last_error)
        if "503" in error_msg or "UNAVAILABLE" in error_msg:
            return jsonify({"error": "The translation AI is currently experiencing high demand. Please wait a few seconds and click Generate again."}), 503
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            return jsonify({"error": "AI Translation Quota Exceeded. Please try again in a few minutes or use English mode."}), 429
        return jsonify({"error": error_msg}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/extract-text', methods=['POST'])
def extract_text():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    filename = str(uuid.uuid4()) + "_" + file.filename
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    text = ""
    try:
        ext = filename.split('.')[-1].lower()
        if ext == 'pdf':
            with open(filepath, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text() + "\n"
        elif ext == 'docx':
            doc = Document(filepath)
            for para in doc.paragraphs:
                text += para.text + "\n"
        elif ext == 'txt':
            with open(filepath, 'r', encoding='utf-8') as f:
                text = f.read()
        else:
            return jsonify({"error": "Unsupported file format. Use PDF, DOCX, or TXT."}), 400
        
        return jsonify({"text": text.strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)

# Initialize multiple clients for failover
api_keys = [
    os.getenv("GEMINI_API_KEY"),
    os.getenv("BACKUP_API_KEY"),
    os.getenv("TERTIARY_API_KEY")
]
clients = [genai.Client(api_key=key) for key in api_keys if key]

def get_ai_response(prompt, model_names=['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-flash-latest']):
    """Helper with API key failover logic"""
    for client in clients:
        for model_name in model_names:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                return response.text.strip()
            except Exception as e:
                err_str = str(e)
                print(f"Error with model {model_name}: {err_str}", flush=True)
                # Only retry with next client/model if it's a 429 (Quota) error
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    continue
                else:
                    # For other errors, we might want to skip this model but not necessarily the client
                    continue
    return None

@app.route('/api/ai-process', methods=['POST'])
def ai_process():
    data = request.json
    action = data.get('action')
    text = data.get('text')
    
    if not text or not action:
        return jsonify({"error": "Missing text or action"}), 400
        
    try:
        from datetime import datetime
        current_date = datetime.now().strftime("%B %d, %Y")
        
        if action == 'summarize':
            prompt = f"Current Date: {current_date}. Provide a concise summary of the following text:\n\n{text}"
        elif action == 'polish':
            prompt = f"Current Date: {current_date}. Fix any grammatical errors, remove filler words (like um, uh), and structure this text professionally while keeping the exact original meaning. Return ONLY the polished text:\n\n{text}"
        elif action == 'tone':
            # Tone analysis needs specific JSON format
            if not clients:
                return jsonify({"result": '{"label": "Neutral", "category": "analytical"}'})
                
            current_client = clients[0] # Try with primary first
            prompt = f"Analyze the tone and sentiment of the following text. Respond with ONLY a single JSON object containing 'label' (2-4 words) and 'category' (one of: positive, urgent, analytical):\n\n{text}"
            try:
                response = current_client.models.generate_content(model='gemini-2.0-flash', contents=prompt)
                result_text = response.text.strip()
                if "```json" in result_text:
                    result_text = result_text.split("```json")[1].split("```")[0].strip()
                elif "```" in result_text:
                    result_text = result_text.split("```")[1].split("```")[0].strip()
                return jsonify({"result": result_text})
            except:
                # Basic fallback for tone
                return jsonify({"result": '{"label": "Neutral", "category": "analytical"}'})
        elif action == 'persona':
            persona = data.get('persona', 'standard')
            prompts = {
                'shakespearean': "Rewrite the following text in the style of William Shakespeare. Use Early Modern English (thou, hath, etc.) but keep the core meaning intact. Return ONLY the rewritten text:",
                'cyberpunk': "Rewrite the following text in a gritty, futuristic cyberpunk slang style (mentioning neon, data, chrome, glitches). Return ONLY the rewritten text:",
                'corporate': "Rewrite the following text in highly professional corporate buzzword-heavy jargon (synergy, stakeholders, deliverables). Return ONLY the rewritten text:",
                'pirate': "Rewrite the following text like a salty sea pirate from the 1700s. Use terms like 'Ahoy', 'Matey', 'Bilge-rat'. Return ONLY the rewritten text:",
                'toddler': "Rewrite the following text in the simple, excited, and slightly clumsy language of a 3-year-old toddler. Return ONLY the rewritten text:",
                'philosopher': "Rewrite the following text as a deep, stoic, and contemplative philosophical meditation. Return ONLY the rewritten text:"
            }
            persona_prompt = prompts.get(persona, f"Current Date: {current_date}. Rewrite this text clearly:")
            prompt = f"Current Date: {current_date}. {persona_prompt}\n\n{text}"
        else:
            return jsonify({"error": "Invalid action"}), 400
            
        result = get_ai_response(prompt)
        if result:
            return jsonify({"result": result})
        return jsonify({"error": "AI processing failed"}), 500
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    text = data.get('text')
    persona = data.get('persona', 'standard')
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
        
    try:
        from datetime import datetime
        current_date = datetime.now().strftime("%B %d, %Y")
        
        prompts = {
            'shakespearean': "You are William Shakespeare. Respond to the user in Early Modern English. Be poetic and dramatic.",
            'cyberpunk': "You are a hacker in a dystopian future. Use gritty cyberpunk slang (chrome, deck, corp). Be brief and cynical.",
            'corporate': "You are a high-level executive. Use business buzzwords and talk about ROI and synergy. Be overly professional.",
            'pirate': "You are a salty sea pirate. Use pirate slang (arr, matey, landlubber). Be boisterous and mention treasure.",
            'toddler': "You are a curious 3-year-old. Use simple words and be very excited about everything.",
            'philosopher': "You are a stoic philosopher. Give deep, thoughtful, and slightly detached advice."
        }
        
        system_prompt = prompts.get(persona, "You are a helpful AI assistant. Be brief and conversational.")
        context = f"Current Date: {current_date}. IMPORTANT: You HAVE a voice and are speaking directly to the user via Text-to-Speech. Do NOT say you cannot speak or sing. If asked to sing, provide lyrics and say 'Here is a song for you!'"
        full_prompt = f"{system_prompt}\n{context}\n\nUser says: {text}\n\nYour response:"
        
        reply = get_ai_response(full_prompt)
        if reply:
            return jsonify({"reply": reply})
            
        return jsonify({"error": "AI response failed. All keys exhausted."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # When running locally via 'python app.py'
    print(f"EchoSync AI Backend starting in local mode on http://localhost:{PORT}")
    app.run(debug=False, host=HOST, port=PORT)
