FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/apps/api \
    PORT=7860

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy pyproject.toml and source directory
COPY apps/api/pyproject.toml /app/apps/api/
COPY apps/api /app/apps/api
COPY packages /app/packages

# Install the Python dependencies and the omnitext package
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e /app/apps/api

# Copy the startup script and make it executable
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose default Hugging Face Spaces port
EXPOSE 7860

# Run uvicorn and background worker using start.sh
CMD ["/app/start.sh"]
