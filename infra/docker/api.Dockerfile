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

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "omnitext.main:app", "--app-dir", "apps/api", "--host", "0.0.0.0", "--port", "8000"]
