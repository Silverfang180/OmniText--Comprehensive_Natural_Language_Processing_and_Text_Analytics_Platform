import os
import sys
import uvicorn

api_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "apps", "api"))
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from omnitext.main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    print(f"Starting FastAPI server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)