FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/apps/api

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy pyproject.toml and source directory
COPY apps/api/pyproject.toml /app/apps/api/
COPY apps/api /app/apps/api
COPY packages /app/packages
COPY app.py /app/app.py

# Install PyTorch CPU and dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -e /app/apps/api

# Run app.py (launches worker + uvicorn on dynamic $PORT)
CMD ["python", "app.py"]

