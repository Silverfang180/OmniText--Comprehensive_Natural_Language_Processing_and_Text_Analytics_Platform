#!/bin/bash

# Start the background worker process in the background
echo "Starting background database worker process..."
python -m omnitext.worker.main &

# Start the FastAPI server on the configured port (defaulting to Hugging Face Spaces port 7860)
echo "Starting FastAPI server on port ${PORT:-7860}..."
exec uvicorn omnitext.main:app --app-dir apps/api --host 0.0.0.0 --port ${PORT:-7860}
