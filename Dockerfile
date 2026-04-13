FROM python:3.10

WORKDIR /app

COPY . .

RUN apt-get update && apt-get install -y \
    poppler-utils \
    libgl1

RUN pip install --no-cache-dir -r backend/requirements.txt

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
