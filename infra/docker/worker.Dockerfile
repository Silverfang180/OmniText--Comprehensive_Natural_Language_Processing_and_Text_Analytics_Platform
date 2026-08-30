FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/apps/api

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY apps/api/pyproject.toml /app/apps/api/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e /app/apps/api

# Copy application source code
COPY apps/api /app/apps/api
COPY packages /app/packages

CMD ["python", "apps/api/omnitext/worker/main.py"]
