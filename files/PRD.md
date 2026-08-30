# OmniText — Product Requirements Document (v3, Final)

| | |
|---|---|
| **Document owner** | Engineering |
| **Status** | Final — v3.0 (supersedes v2.0) |
| **Related documents** | `Architecture.md`, `Rules.md`, `Phases.md`, `Design.md`, `DECISIONS.md`, `Memory.md` |

---

## 1. Product Positioning

OmniText is a practical, well-engineered application designed for individual users and small-scale multi-user usage: seven focused capabilities for understanding, analyzing, extracting from, retrieving, and answering questions about text, backed by real model evaluation and one genuine fine-tuning workflow. It is built by one developer, sized to actually ship, and designed to be useful to a real visitor in the first thirty seconds — not just impressive in an architecture diagram.

## 2. The Problem

Someone with a document and a question about it today has bad options: scattered single-purpose tools with no shared context, raw model demos with no evidence the model is any good, or nothing at all for retrieval/QA-style questions. OmniText is one place to paste text, run the analysis that matters, and get results from models whose quality is visible, not assumed.

```
User has text or a question about text
    ↓
Pastes it into OmniText, picks a task (or several)
    ↓
A benchmarked model runs
    ↓
Result shown in a form suited to the task
    ↓
User understands or finds what they needed, without leaving one tool
```

## 3. Final NLP Scope — Locked

Exactly seven capabilities. No more, no fewer, for V2:

| Pillar | Capability |
|---|---|
| **Understand** | Summarization |
| **Analyze** | Sentiment Analysis |
| **Analyze** | Text Classification |
| **Extract** | Named Entity Recognition |
| **Extract** | Keyword / Keyphrase Extraction |
| **Retrieve** | Semantic Search |
| **Answer** | Extractive Question Answering |

**Explicitly deferred, not built in V2:** Emotion Detection, Language Detection, standalone Similarity Search (similarity math may exist internally inside Semantic Search's ranking, but it is never a separate product feature). These are listed in §16 Future Roadmap, not designed against.

Extractive QA is scoped narrowly: question + context in, an extracted answer span + its source passage out. It is not a chatbot, not an agent, and not an open-ended generative system.

## 4. Product Coherence

The seven capabilities are one product, organized around what a user is trying to do with a document, not around seven separate model demos:

```
Document
   ↓
 Understand → Summarize
 Analyze    → Sentiment · Classify
 Extract    → Entities · Keywords
 Retrieve   → Semantic Search (across a dataset)
 Answer     → Extractive QA (question → answer + source)
```

An advanced combined workflow — semantic search to find a relevant passage, then extractive QA against that passage — is supported once both capabilities exist, but is not required for MVP.

## 5. Goals

- **G1.** A first-time visitor pastes text and gets a real, accurate result in one action — no account required.
- **G2.** Every shipped task-model pairing is backed by a benchmark comparing real candidates, using the metric appropriate to that task.
- **G3.** One complete, honest fine-tuning workflow: NER, pretrained baseline vs. fine-tuned, compared on held-out data, shown in-product.
- **G4.** Results are useful to take away — copyable/exportable, not trapped in a dashboard.
- **G5.** Users with more than one document (researchers, analysts) can build a dataset and run Semantic Search and QA across it.
- **G6.** Uploaded documents and account data are properly isolated per user — private by default, never visible across accounts.
- **G7.** A documented REST API exposes every capability independently of the UI.
- **G8.** The app is deployable to an ordinary managed platform (not a specific provider chosen up front) with realistic resource assumptions (§13).
- **G9.** A recruiter can go from the live app to real ML evidence (benchmarks, the fine-tuning comparison) in minutes, without reading code.
- **G10.** The whole thing is realistically buildable, testable, and deployable by one developer in the available time.

## 6. Non-Goals

| Non-goal | Reason |
|---|---|
| Emotion Detection, Language Detection, standalone Similarity Search | Cut from V2 scope to keep the seven capabilities coherent and finishable — see §16. |
| Chatbot/agentic/open-ended QA | Extractive QA only; anything generative-agentic is a different, much larger project. |
| Multi-tenant orgs, roles, billing, SSO/SAML | No real multi-tenant need; simple per-account isolation is enough (§10). |
| Custom-built API playground | FastAPI's `/docs` already serves this. |
| Redis/Celery/Kafka, microservices, service mesh, API gateway | No traffic volume or team size that justifies this; a modular monolith with simple background tasks covers the real requirements (`Architecture.md`). |
| Research-grade explainability (SHAP, integrated gradients) | A lightweight, fast signal (confidence scores, highlighted spans) is enough for this product's purpose. |
| Locking a cloud provider before implementation | Architecture stays portable; the provider is chosen after benchmarking and resource measurement (§13). |
| Kubernetes, dedicated vector DB, MLflow/W&B | Not justified at this scale; Postgres + pgvector covers the real need. |

## 7. User Personas

**Priya — recruiter/technical reviewer.** Tries a real feature in under a minute on the live app, then checks the Benchmarks and NER fine-tuning evidence before ever opening the repo.

**Daniel — student/analyst with one document.** Pastes text, wants sentiment + entities + a summary, copies results out. Never creates an account for this.

**Amara — researcher with a small corpus.** Has 15–40 documents. Creates an account, builds a dataset, uses Semantic Search and QA across it.

**Marcus — developer.** Uses the REST API directly, reads `/docs`, never opens the UI.

## 8. Functional Requirements

### 8.1 Quick Analysis (no account)

Quick Analysis covers the five **single-document** capabilities — the ones that need nothing but the pasted text itself to run:

```
Quick Analysis (no login)
    ↓
Summarization · Sentiment · NER · Classification · Keywords
```

Semantic Search and Extractive QA are **not** Quick Analysis capabilities — both operate over a document/context (a dataset to search across, or a context passage to answer from) rather than a single pasted string, and are available through their own Document Intelligence workflows (§8.3, `Architecture.md` §10). Neither requires an account when the required context can be supplied directly in that workflow (e.g., pasting a context passage for QA without first building a dataset) — the account requirement is for *persisting* datasets/documents across sessions, not an artificial gate on the capability itself.

```
Document Intelligence
    ↓
Semantic Search · Extractive QA
```

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Paste text, run any of the five Quick Analysis tasks (Summarization, Sentiment, NER, Classification, Keyword Extraction) — individually or several at once — no login required. | MUST |
| FR-02 | 2–3 sample texts offered so a first-time visitor never faces a blank box. | MUST |
| FR-03 | Every result shows the model that produced it and can be copied/exported (text/Markdown/JSON). | MUST |
| FR-04 | Text exceeding a model's input limit is chunked appropriately per task, never silently truncated (§14). | MUST |
| FR-05 | Semantic Search and Extractive QA are reached through their Document Intelligence workflows, not Quick Analysis; they don't require an account when their required context (a document/passage) is supplied directly in that workflow, but persisting datasets across sessions does require one. | MUST |

### 8.2 Accounts & Documents

| ID | Requirement | Priority |
|---|---|---|
| FR-10 | Email/password account creation; API key issuance per account. | MUST |
| FR-11 | Create a dataset, upload `.txt`/`.pdf`/`.docx`/`.csv` or add text documents to it. | MUST |
| FR-12 | Uploaded files validated for type/size before ingestion, specific error on rejection. | MUST |
| FR-13 | View, and delete, a user's own datasets/documents/results — never another user's. | MUST |
| FR-14 | Past analyses retrievable without re-running inference. | SHOULD |

### 8.3 NLP Capabilities

| ID | Requirement | Priority |
|---|---|---|
| FR-20 | Summarization with a selectable target length. | MUST |
| FR-21 | Sentiment Analysis with label + confidence. | MUST |
| FR-22 | NER with inline highlighted entities + confidence, fine-tuned model available (§11). | MUST |
| FR-23 | Text Classification: built-in categories, or zero-shot with user-supplied labels. | MUST |
| FR-24 | Keyword/keyphrase extraction, ranked by relevance. | MUST |
| FR-25 | Semantic Search across a dataset: query in, ranked relevant passages/documents out. | MUST |
| FR-26 | Extractive QA: question + document/context in, answer span + source passage out. | MUST |
| FR-27 | Every result includes model identity and inference latency. | MUST |
| FR-28 | Run multiple tasks on one input in a single action, results shown together. | SHOULD |
| FR-29 | Combined workflow: semantic search result feeds directly into extractive QA. | NICE |

### 8.4 Model Evidence

| ID | Requirement | Priority |
|---|---|---|
| FR-40 | Every task has ≥2 benchmarked candidates on record, scored with the metric appropriate to that task (§9), before one becomes default. | MUST |
| FR-41 | A user-facing Benchmarks page shows this comparison per task. | MUST |
| FR-42 | NER fine-tuned on a labeled dataset, evaluated against pretrained baseline on the same held-out split. | MUST |
| FR-43 | Baseline-vs-fine-tuned comparison visible in-product with a clear outcome. | MUST |
| FR-44 | Promotion of a fine-tuned model to active status is an explicit action, never automatic. | MUST |

### 8.5 Explainability (lightweight)

| ID | Requirement | Priority |
|---|---|---|
| FR-50 | Classification-style results (sentiment, classification) show a confidence/probability breakdown; NER/QA show span highlighting; no heavier attribution method is required. | SHOULD |

### 8.6 REST API

| ID | Requirement | Priority |
|---|---|---|
| FR-60 | Every capability available as a versioned REST endpoint (`/api/v1/...`). | MUST |
| FR-61 | Self-documented via OpenAPI at `/docs` — no separate playground built. | MUST |
| FR-62 | One consistent response envelope across all endpoints. | MUST |
| FR-63 | Single-document requests synchronous; dataset-scale work (embedding a dataset, benchmark/fine-tune runs) processed in the background with a status-check endpoint. | MUST |

### 8.7 Authentication & Authorization

| ID | Requirement | Priority |
|---|---|---|
| FR-70 | Email/password auth; one account type, no roles/orgs. | MUST |
| FR-71 | Every dataset, document, analysis, and experiment is scoped to its owning account and authorized on every access — a user must never be able to read or act on another user's resources. | MUST |
| FR-72 | Passwords hashed (Argon2id/bcrypt); API keys stored hashed, shown once at creation. | MUST |

## 9. AI/ML Requirements

Hybrid strategy: benchmark every task with ≥2 real candidates using the metric appropriate to that task; fine-tune NER only. Full rationale in `DECISIONS.md`.

| Task | Metric |
|---|---|
| Summarization | ROUGE-1/2/L |
| Sentiment | Accuracy / F1 |
| NER | Precision / Recall / F1 (seqeval) |
| Classification | Accuracy / Precision / Recall / F1 |
| Keyword Extraction | Precision@K / Recall@K / F1 when a suitable labeled evaluation dataset is available. When no suitable labeled ground truth exists, a documented human-evaluation protocol or another explicitly defined proxy metric is used instead — proxy/human-evaluation results are always labeled as such and are never presented as directly comparable to supervised metrics from other tasks. |
| Semantic Search | Recall@K / MRR where a labeled query-relevance set exists |
| Extractive QA | Exact Match / F1 |

Where practical, latency, model size, and memory are also recorded per candidate — this is the evidence that drives model selection, not popularity.

## 10. Authentication & Data Security

Simple authentication, serious data isolation. Every protected resource (dataset, document, analysis, experiment) is owned by exactly one account and every access is authorized against that ownership — this is a hard requirement (FR-71), not best-effort. No SSO, no RBAC, no orgs — one account type is sufficient because ownership isolation, not role complexity, is the actual security requirement here.

## 11. Fine-Tuning Strategy

NER only. Benchmark the baseline first (§9), fine-tune on a labeled dataset, evaluate on a held-out split, compare honestly against baseline, promote only with evidence. The training scale is realistic for one developer's compute — this is not claimed to be large-scale training, and the documentation says so plainly.

## 12. Semantic Search

Documents → text extraction → chunking where needed → embeddings (Sentence Transformers) → pgvector index → natural-language query → ranked relevant passages. No dedicated vector database, no RAG orchestration layer — this is intentionally the smallest architecture that does real semantic retrieval well.

## 13. Deployment-Aware Design (not deployment-locked)

No specific hosting provider is chosen in this document. The architecture is nonetheless designed with real deployment constraints in mind from day one: CPU-only inference unless benchmarking shows a real need for GPU, reasonable container size and startup time, externalized config/secrets via environment variables, health checks, and a clear boundary between stateless application processes and persistent storage (Postgres + object storage). The actual hosting choice (e.g., a managed container platform + managed Postgres + Vercel-style frontend hosting) is made after Phase 6 benchmarking produces real resource numbers — see `Phases.md` Phase 8.

## 14. Long-Document Handling

Never silently truncate. Where a task's model has an input limit, input is detected as over-limit and chunked using a task-appropriate strategy (e.g., summarize chunk-then-combine for Summarization; aggregate entity lists across chunks for NER; note truncation-avoidance explicitly to the user for tasks where chunking isn't meaningful, e.g., single-passage QA). One universal chunking strategy is not assumed to fit every task.

## 15. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | Single-document sync inference under 3s p95 (Summarization under 6s p95), measured against real benchmark data, not assumed. |
| NFR-02 | Reliability | Predictable failures return specific errors, never a raw stack trace. |
| NFR-03 | Correctness | Long documents handled per §14, not truncated. |
| NFR-04 | Observability | Every inference call logs model ID, latency, input size, outcome. |
| NFR-05 | Portability | `docker compose up` runs the full stack locally with no manual setup beyond env vars. |
| NFR-06 | Security | Ownership-based authorization enforced on every protected endpoint (§10); no secrets in source control. |
| NFR-07 | Accessibility | Core workflows meet WCAG 2.1 AA for contrast and keyboard navigation. |
| NFR-08 | Testability | Meaningful tests on adapters, API routes, authorization, and evaluation logic. |
| NFR-09 | Maintainability | Adding a task touches one adapter + one config entry, not the API or orchestration layer. |
| NFR-10 | Deployability | Runs on an ordinary managed container platform with CPU inference at benchmarked latency targets; GPU only if benchmarking proves it's needed. |

## 16. Future Roadmap (explicitly deferred)

- Emotion Detection, Language Detection, standalone Similarity Search — could return as adapters if the platform's scope ever grows, each requiring its own benchmark before shipping.
- Combined semantic-search-then-QA as a first-class guided workflow (FR-29), beyond the basic capability.
- Deeper explainability if the lightweight version proves insufficient for users.
- GPU-backed inference if benchmarking shows CPU latency is inadequate for a specific task at real usage volume.

## 17. Success Metrics

| Metric | Target |
|---|---|
| First-time visitor reaches a real result with zero setup | Yes |
| All 7 locked capabilities functional end-to-end | 7/7 |
| Tasks with ≥2 benchmarked candidates | 7/7 |
| NER fine-tuning experiment completed, comparison visible in-product | 1/1 |
| Data isolation verified (User A cannot access User B's resources) | Verified, tested |
| `docker compose up` cold-start success | 100% reproducible |
| Public deployed instance reachable and functional | Yes |
| p95 sync latency (non-summarization tasks) | < 3s |

## 18. MVP — the smallest version that already feels like OmniText

- Quick Analysis (no login): paste text, run **Summarization, Sentiment, NER, Classification, Keyword Extraction** together, results with model identity, copy/export.
- Benchmarks page for those five tasks (≥2 candidates each).
- Basic account + API key + ownership-based authorization.
- REST API for those five tasks, documented at `/docs`.
- `docker compose up` working locally.

Semantic Search and Extractive QA are deliberately **not** in MVP — they require the dataset/document infrastructure first and are sequenced immediately after in `Phases.md`, so MVP stays a polished, working core rather than seven half-finished features.

## 19. MUST / SHOULD / NICE Summary

| Priority | Items |
|---|---|
| **MUST** | 7 locked NLP tasks end-to-end, quick analysis with no login, chunking correctness, benchmarking with real metrics, NER fine-tuning with honest comparison, account + ownership-based data isolation, REST API with OpenAPI docs, `docker compose up`, public deployment. |
| **SHOULD** | Saved analysis history, multi-task-in-one-run UI, lightweight explainability (confidence/probability display). |
| **NICE** | Combined semantic-search-then-QA guided workflow, export formatting polish beyond plain copy/Markdown/JSON. |

---

*Next document: `Architecture.md` — a modular monolith sized to this exact scope, deployment-aware but provider-agnostic.*
