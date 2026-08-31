---
title: OmniText Backend API
emoji: 🧠
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# OmniText · NLP & Text Intelligence


OmniText is a modern, high-contrast text intelligence platform designed to deliver practical NLP insights directly to users. It integrates seven core text intelligence capabilities with robust model benchmarking, fine-tuning evaluations, and secure workspace isolation.

---

## 🚀 Live Demos & Deployments
* **Frontend Application:** Hosted on [Vercel](https://vercel.com) (Free Tier)
* **Backend API & Engine:** Hosted on [Hugging Face Spaces](https://huggingface.co) (Free CPU Space)

---

## 🎨 System Design & Architecture

OmniText is built as a highly optimized monorepo splitting frontend and backend operations:

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                     │
│               (Hosted on Vercel - Free CDN)             │
└───────────┬─────────────────────────────────────────────┘
            │ HTTPS API Calls
            ▼
┌─────────────────────────────────────────────────────────┐
│              FastAPI Backend Container                  │
│       (Hosted on Hugging Face Spaces - Free CPU)        │
│                                                         │
│  ┌──────────────────────┐     ┌──────────────────────┐  │
│  │   Uvicorn API Server │     │  Database-Backed     │  │
│  │                      │     │  Polling Worker      │  │
│  └──────────┬───────────┘     └──────────┬───────────┘  │
└─────────────┼────────────────────────────┼──────────────┘
              │                            │
              ▼                            ▼
   ┌──────────────────────────────────────────────────┐
   │             Shared DB (SQLite/Postgres)          │
   └──────────────────────────────────────────────────┘
```

### 1. Hybrid Single-Container Backend
To support a completely free deployment model, the FastAPI server and the asynchronous task worker execute concurrently inside a single container via a custom startup script (`start.sh`).

### 2. Database-Backed Polling Worker
Instead of requiring heavy message brokers like RabbitMQ or Redis, the backend utilizes a database-backed task queue. A simple background worker thread polls the `jobs` database table, executing heavy operations (document chunking, embeddings, fine-tuning) asynchronously.

### 3. v4.1 Warm Editorial Design System
Designed to mimic a premium paper-editorial look:
* **Typography:** `Fraunces` for title headers, `Inter` for interfaces, and `JetBrains Mono` for latency/confidence indicators.
* **Palette:** Warm paper light canvas (`#FAF9F6`), warm charcoal dark mode canvas (`#16151A`), and Ink-Teal (`#2B4A47` / `#5FA39C`) highlights.
* **Shadows:** Flat design with hairline borders (`border border-border-default`) rather than drop shadows.

---

## ⚙️ Deploying for Free

### 1. Backend: Hugging Face Spaces (Docker)
1. Create a new Space on Hugging Face and select **Docker** as the SDK.
2. Push this repository's code to the Space.
3. Configure the Space Environment Variables (Settings):
   * `API_PORT` = `7860`
   * `API_ENV` = `production`
   * `API_DATABASE_URL` = `sqlite+aiosqlite:///omnitext.db` (Default: ephemeral storage) OR `postgresql+asyncpg://...` (Supabase / Neon free cloud Postgres for persistent storage).

### 2. Frontend: Vercel (Next.js)
1. Import your repository into Vercel.
2. Set the Root Directory to `apps/web`.
3. Set the Environment Variable:
   * `NEXT_PUBLIC_API_URL` = `https://<your-username>-<your-space-name>.hf.space`

---

## 🛠️ Local Development Setup

### Prerequisites
* Python 3.12+
* Node.js 18+

### Step 1: Install Dependencies
```bash
# Install frontend packages
npm install --prefix apps/web

# Install API packages locally
pip install -e apps/api
```

### Step 2: Start Dev Servers
```bash
# Run Next.js app on port 3000
npm run dev:web

# Run FastAPI API server on port 8001
npm run dev:api

# Run Celery-style background worker
npm run dev:worker
```

---

## 🧠 Case Study: Hybrid CPU Inference & Model Sizing
Running deep learning models on standard free-tier CPU constraints usually results in either out-of-memory crashes or unusable response times (exceeding 5–10 seconds). 

OmniText solves this through a curated selection of distilled models:

| Task | Selected Model | Size (MB) | Avg Latency (CPU) |
|---|---|---|---|
| **Text Classification** | `typeform/distilbert-base-uncased-mnli` | 268 MB | ~60ms |
| **Summarization** | `sshleifer/distilbart-cnn-6-6` | 306 MB | ~400ms |
| **Sentiment Analysis** | `distilbert-base-uncased-finetuned-sst-2` | 268 MB | ~40ms |
| **Named Entities (NER)** | `dslim/bert-base-NER` | 433 MB | ~60ms |
| **Semantic Search** | `sentence-transformers/all-MiniLM-L6-v2` | 90 MB | ~15ms |

### Key Optimization Decisions:
1. **Memory Ceiling Mitigation:** Replaced heavy baseline models like `facebook/bart-large-mnli` (1.6 GB) with distilled DistilBERT MNLI equivalents (268 MB), reducing cold startup footprint and eliminating Windows/Linux virtual memory allocation errors.
2. **Text Chunking Pipeline:** Integrates a character-word token partitioner to split documents into maximum 400-word blocks with sliding margins, enabling zero-truncation long document processing.
