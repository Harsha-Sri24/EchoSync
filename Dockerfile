FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=7860

# Install system dependencies (ffmpeg for audio, build tools for whisper)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user (required by HF Spaces)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"

WORKDIR /app

# Install Python dependencies
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download Whisper model to avoid startup timeouts
RUN python -c "import whisper; whisper.load_model('base')"

# Copy project files
COPY --chown=user . .

# Ensure uploads directory exists and is writable
RUN mkdir -p uploads && chmod 777 uploads

# Expose port (HF Spaces default)
EXPOSE 7860

# Run with gunicorn for production stability
CMD ["gunicorn", "--bind", "0.0.0.0:7860", "--timeout", "120", "--workers", "1", "app:app"]
