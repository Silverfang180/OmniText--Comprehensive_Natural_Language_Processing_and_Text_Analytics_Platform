import os
import sys
import subprocess
import uvicorn

api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "apps", "api"))
sys.path.insert(0, api_dir)

env = os.environ.copy()
env["PYTHONPATH"] = api_dir + os.pathsep + env.get("PYTHONPATH", "")

# Start background database worker process concurrently
print("Launching async database worker subprocess...")
worker_process = subprocess.Popen([sys.executable, "-m", "omnitext.worker.main"], env=env)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting FastAPI server on port {port}...")
    uvicorn.run("omnitext.main:app", host="0.0.0.0", port=port)