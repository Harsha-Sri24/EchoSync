# EchoSync AI - Generative Speech & Intelligence

**EchoSync AI** is a premium, cyber-minimalist web application that bridges the gap between speech, documents, and intelligence. It combines state-of-the-art foundation models like **OpenAI Whisper** and **Google Gemini 2.0 Flash** into a seamless, high-performance productivity suite.

## ✨ Features

- **🧠 Whisper STT Intelligence**: High-accuracy Speech-to-Text transcription powered by OpenAI's Whisper model.
- **🌍 AI Translation Engine**: Real-time translation into 15+ global languages (Hindi, Telugu, Spanish, Arabic, etc.) using Gemini 2.0 Flash.
- **📄 Document-to-Voice**: Seamlessly import **PDF, DOCX, and TXT** files to extract text for instant synthesis or translation.
- **🗣️ Generative TTS Suite**: Crystal-clear speech synthesis with full control over **Rate, Pitch, and Voice selection**.
- **📊 Evaluation Dashboard**: Built-in performance monitoring showing real-time latency (s), word counts, and system status for model evaluation.
- **🖼️ Glassmorphic UI**: A stunning, modern design with interactive audio visualizers and a responsive dual-column layout.
- **⏯️ Full Control**: Dedicated **Stop** functionality and real-time transcription status indicators.

## 🛠️ Technology Stack

- **Backend**: Python 3.13 + Flask
- **Foundation Models**: 
  - **OpenAI Whisper** (Speech-to-Text)
  - **Google Gemini 2.0 Flash** (Translation Intelligence)
- **Frontend**: Vanilla JavaScript + CSS3 (Glassmorphism)
- **Audio Processing**: Web Audio API (Visualization) + Web Speech API (Synthesis)
- **Dependencies**: FFMPEG (Audio conversion), PyPDF2, python-docx

## 🚀 Getting Started

### Prerequisites
- **Python 3.13+**
- **FFMPEG** (Must be installed and in your system PATH)
- **Gemini API Key** (Add to `.env`)

### Installation

1. **Clone the repository**:
   ```bash
   git clone [your-repo-link]
   cd EchoSync
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up Environment**:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the Application**:
   ```bash
   py app.py
   ```

5. **Access the App**:
   Open your browser and navigate to `http://localhost:5000`.

## 📈 Evaluation & Metrics

EchoSync AI is designed for model evaluation. The **AI Performance Metrics** panel provides live data on:
- **STT Latency**: Time taken for Whisper to process audio.
- **Intelligence Latency**: Time taken for Gemini to translate text.
- **Prompt Alignment**: Context-aware translation accuracy.

## 🛡️ License

Built for the Hands-on Challenge: Foundation Models for Audio and Speech.

---
*Created with ❤️ by EchoSync Team*
