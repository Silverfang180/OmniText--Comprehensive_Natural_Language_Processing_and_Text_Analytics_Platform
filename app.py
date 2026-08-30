import os
import sys
import subprocess
import uvicorn

# Inject apps/api folder into PYTHONPATH so python can locate the omnitext package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "apps", "api")))

# Start background database worker process concurrently
print("Launching async database worker subprocess...")
worker_process = subprocess.Popen([sys.executable, "-m", "omnitext.worker.main"])

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    print(f"Starting FastAPI server on port {port}...")
    uvicorn.run("omnitext.main:app", host="0.0.0.0", port=port)