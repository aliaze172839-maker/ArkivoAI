FROM python:3.10-slim

WORKDIR /app

# ── System dependencies ───────────────────────────────────────────────────────
# poppler-utils محذوف ← لم نعد نحتاجه بعد pymupdf
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ───────────────────────────────────────────────────────
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt \
    && find /usr/local/lib/python3.10 -name "*.pyc" -delete \
    && find /usr/local/lib/python3.10 -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true \
    && find /usr/local/lib/python3.10 -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true

# ── App source ────────────────────────────────────────────────────────────────
COPY . .

CMD ["sh", "-c", "python -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
