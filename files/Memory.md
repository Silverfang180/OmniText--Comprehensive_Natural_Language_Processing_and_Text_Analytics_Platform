# OmniText — Engineering Memory (v3, Final)

| | |
|---|---|
| **Document owner** | Engineering |
| **Status** | Living document — initialized at v3.0 scope lock (pre-implementation) |
| **Purpose** | Concise persistent context for future sessions. Read this first. |
| **Related documents** | `PRD.md`, `Architecture.md`, `Rules.md`, `Phases.md`, `Design.md`, `DECISIONS.md` |

---

## 1. Product Purpose

OmniText is a practical NLP/text-intelligence application — not an enterprise platform, not a shallow model demo. Built by one developer, sized to actually ship, useful to a real visitor in seconds. See `PRD.md` §1–2.

## 2. Final Seven Capabilities (locked, `DECISIONS.md` ADR-010)

Summarization · Sentiment Analysis · Named Entity Recognition (fine-tuned) · Text Classification · Keyword Extraction · Semantic Search · Extractive QA.

**Quick Analysis (no login)** covers only the five single-document tasks: Summarization, Sentiment, NER, Classification, Keyword Extraction. **Semantic Search and Extractive QA are Document Intelligence workflows**, not Quick Analysis — they operate over a document/context rather than a pasted string, and only require an account to *persist* a dataset across sessions, not to use the capability with directly-supplied context.

**Explicitly not in V2:** Emotion Detection, Language Detection, standalone Similarity Search — deferred, not designed against.

## 3. Architecture Summary

Modular monolith (`DECISIONS.md` ADR-003): one Next.js frontend, one FastAPI backend + worker process, PostgreSQL + pgvector, object storage. No microservices, no Redis/Celery, no dedicated vector DB, no MLflow. `TaskAdapter` interface is the extension point. Services layer sits between API routers and the ML layer and is where ownership/authorization logic lives. Full detail: `Architecture.md`.

## 4. Stack

Next.js/React/TypeScript/Tailwind/shadcn/TanStack Query · FastAPI/Python · Hugging Face Transformers + Sentence Transformers · PostgreSQL + pgvector · Docker + GitHub Actions. See `DECISIONS.md` ADR-001–004, 008–009 for rationale.

## 5. Security Model

Simple authentication (email/password + API key), one account type, no RBAC/orgs/SSO. Data isolation is enforced through ownership checks at a single shared point, on every protected endpoint, without exception — this is the actual security requirement, not role complexity. `Architecture.md` §11, `Rules.md` §7, `DECISIONS.md` ADR-013.

## 6. ML Strategy

Hybrid (`DECISIONS.md` ADR-005): benchmark all 7 tasks with ≥2 candidates each, using the metric appropriate to that task (`PRD.md` §9). Fine-tune NER only (ADR-006), and only after that task's benchmark baseline exists (ADR-007 — Phase 6 before Phase 7, no exceptions).

## 7. Benchmarking

Real, user-visible product screen, not a dev artifact. Task → metric mapping is fixed in `PRD.md` §9 and must not be substituted ad hoc.

## 8. Semantic Search

Sentence Transformers embeddings + pgvector, chunked at document ingestion. No RAG orchestration layer, no separate vector DB.

## 9. Extractive QA

Question + context/document in, answer span + source passage out. Not a chatbot, not agentic. Handles over-length context explicitly (narrow via search, or inform the user) — never silently truncates.

## 10. Current Phase / Implementation State

**Phase:** Phase 3 (NLP Expansion + Accounts) COMPLETE.
**Active State:**
- Real NLP task adapters implemented for all five single-document capabilities: **Summarization** (`sshleifer/distilbart-cnn-6-6`), **Sentiment Analysis** (`distilbert-base-uncased-finetuned-sst-2-english`), **Named Entity Recognition (NER)** (`dslim/bert-base-NER`), **Zero-Shot Text Classification** (`facebook/bart-large-mnli`), and **Keyword & Keyphrase Extraction** (`all-MiniLM-L6-v2`).
- Task-aware sliding-window **chunking and aggregation module** (`apps/api/omnitext/ml/chunking/chunker.py`) active to handle over-length inputs safely for all five tasks.
- Relational schema defined and deployed: `users`, `api_keys`, and `analyses` tables in SQLite/PostgreSQL.
- JWT and Developer API Key authentication + middleware handlers implemented under `apps/api/omnitext/core/security.py` and `apps/api/omnitext/api/v1/deps.py`.
- Strict ownership verification active for analyses; accessing unauthorized data results in HTTP 404.
- Frontend Auth (Login/Register), settings (API Key management), expanded NLP capabilities (Classification & Keywords with customizable labels), and saved analyses history view fully integrated and compiled in Next.js production.
- Backend tests expanded to 20/20 passing unit/integration tests covering auth, token verification, chunking, and database persistence/isolation.

## 11. Selected Models

Phase 3 interim default models loaded:
- Summarization: `sshleifer/distilbart-cnn-6-6`
- Sentiment: `distilbert-base-uncased-finetuned-sst-2-english`
- NER: `dslim/bert-base-NER`
- Zero-Shot Classification: `facebook/bart-large-mnli`
- Keyword Extraction: `all-MiniLM-L6-v2`

## 12. Risks (carried from `Phases.md`)

- Interim model choices in Phase 2 must not be treated as final (mitigated by explicit interim flags until Phase 6 benchmark).
- Auth/authorization scope creep beyond FR-70–72 in Phase 3 — bounded by Non-Goals.
- Chunking correctness harder than expected per task — dedicated tests required before Phase 3 is complete (mitigated by full pytest coverage).
- Embedding/search performance at realistic dataset scale — load-tested in Phase 4, not just toy data.
- Fine-tune not beating baseline — valid, expected, honestly reported outcome, not a blocker.
- Hosting cost for continuous inference — resolved with real numbers in Phase 8, reported honestly if trade-offs are needed.

## 13. Technical Debt

| Debt item | Introduced | Expected resolution | Status |
|---|---|---|---|
| Interim defaults in registry for all five core NLP tasks | Phase 2 / Phase 3 | Phase 6 (Benchmarking) | Active |

## 14. Constraints (non-negotiable, carried from `Rules.md`)

- Ownership-based authorization on every protected endpoint, tested explicitly per PR touching data access (`Rules.md` §7).
- No hardcoded config values.
- No model reaches the registry without ≥2 benchmarked candidates and a pinned version.
- No second fine-tuned task without a new ADR.
- No new top-level directory without updating `Architecture.md` §2 in the same PR.

## 15. Decision Log (index — full ADRs in `DECISIONS.md`)

ADR-001 Next.js/FastAPI · ADR-002 FastAPI over Flask/Django · ADR-003 Modular monolith · ADR-004 HF Transformers · ADR-005 Hybrid strategy · ADR-006 NER fine-tuning target · ADR-007 Benchmark before fine-tune · ADR-008 Postgres+pgvector, no Redis/Celery/MLflow/vector-DB · ADR-009 Docker+GitHub Actions, provider deferred · ADR-010 7-task scope lock · ADR-011 Lightweight explainability · ADR-012 No custom API playground · ADR-013 Ownership-based auth, no RBAC.

## 16. Next Tasks (Phase 4 — Semantic Search)

1. Set up pgvector extension and configure PostgreSQL database integration.
2. Design and implement document ingestion database schema (documents, document_chunks).
3. Build document chunking and vector embedding generation pipelines.
4. Implement Cosine-Similarity semantic search matching logic.
5. Create REST endpoints for document upload, dataset status, and query search.
6. Design and build frontend document manager UI and semantic search explorer.

---

**Maintenance note:** update §10 (Phase/State), §11 (Selected Models), §13 (Technical Debt) at the end of every phase. §1–9 should rarely change; if they do, add a `DECISIONS.md` entry too.
