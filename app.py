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

load_dotenv()

# Configure Gemini
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

app = Flask(__name__, static_folder='frontend')
CORS(app)

# Configuration
PORT = 5000
HOST = '0.0.0.0'
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Load Whisper Model (Global)
print("Loading Whisper model...")
device = "cuda" if torch.cuda.is_available() else "cpu"
model = whisper.load_model("base", device=device)
print(f"Model loaded on {device}")

@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

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
    
    try:
        tts = gTTS(text=text, lang=lang)
        filename = f"{uuid.uuid4()}.mp3"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        tts.save(filepath)
        
        # Return the URL to the file
        return jsonify({"url": f"/uploads/{filename}"})
    except Exception as e:
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
        
        last_error = None
        for model_name in models_to_try:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                translated_text = response.text.strip()
                return jsonify({"translated_text": translated_text})
            except Exception as e:
                last_error = e
                # If it's a quota issue, we might want to try another model, 
                # but often the quota is shared. We'll try anyway.
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

if __name__ == '__main__':
    print(f"EchoSync AI Backend starting on http://localhost:{PORT}")
    app.run(debug=True, host=HOST, port=PORT)
