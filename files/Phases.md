Could not validate credentials.# OmniText — Development Phases (v3, Final)

| | |
|---|---|
| **Document owner** | Engineering |
| **Status** | Final — v3.0 |
| **Sequences** | `PRD.md`, `Architecture.md`, `Rules.md` |
| **Related documents** | `Design.md`, `DECISIONS.md`, `Memory.md` |

Sequenced so the product is usable and demonstrable at the end of every phase, not architecturally complete but empty until the very end. If development time runs short, anything tagged NICE or SHOULD in a later phase can be dropped without damaging the core product (`PRD.md` §19).

---

## Phase 1 — Foundation

**Why it exists.** Nothing else can be built without a working local environment where the frontend and backend actually talk to each other. Auth is deliberately excluded here (moved to Phase 3) — the goal of this phase is the smallest possible skeleton that proves the stack works, not account infrastructure.

**Scope (MUST).** Repository setup / monorepo skeleton (`Architecture.md` §2); Next.js application shell (route groups stubbed, no real pages yet); FastAPI application with basic project configuration; PostgreSQL connection (no schema beyond a trivial health/status table); `docker-compose.yml` for `web`/`api`/`worker`/`postgres`; GitHub Actions CI; health checks for API and worker; `TaskAdapter` foundation (the interface + one placeholder adapter, no real model wired yet); basic API/frontend communication verified (frontend successfully calls a backend endpoint and renders the response).

**Deliverables.** Working `docker compose up`; a frontend page that calls a backend health/status endpoint and displays the result.

**Exit criterion.** The frontend and backend run locally and communicate successfully.

**Risks.** Scope creep into building real features before the skeleton is proven. *Mitigation:* this phase explicitly excludes auth, real adapters, and real data models — those are Phase 2 and Phase 3.

**Tests.** Health-check endpoint test; CI pipeline runs and passes on a trivial PR.

**Completion Checklist**
- [ ] `docker compose up` verified on a clean machine
- [ ] CI green on `main`
- [ ] Frontend successfully calls and renders a backend response
- [ ] `TaskAdapter` interface exists with a placeholder implementation

---

## Phase 2 — Core NLP Product

**Why it exists.** This is the actual front door of the product (`PRD.md` FR-01) — a first-time visitor must be able to get real value before accounts exist at all. Getting here fast matters most given limited development time.

**Scope (MUST).** Real adapter implementations for **Summarization, Sentiment, NER**, wired to a reasonable pretrained default each (explicitly flagged "interim, pending Phase 6 benchmark"); core `analyses` API endpoints (sync only); Quick Analysis UI — sample inputs, task selection, result visualization per task, copy/export; basic error handling (oversized input, unsupported input rejected with a specific message, not a generic failure).

**Deliverables.** A visitor can paste text, run all three tasks together, get results with model identity, copy/export them — with zero login and no account infrastructure of any kind yet.

**Exit criterion.** A first-time visitor can paste text and receive useful NLP results without creating an account.

**Risks.** Treating the interim model choice as final. *Mitigation:* explicitly flagged in each adapter's stub model card; Phase 6 is required before anything is "official."

**Tests.** Adapter unit tests (fixed-seed fixtures); analysis endpoint integration tests (success + oversized-input rejection).

**Completion Checklist**
- [ ] Summarization, Sentiment, NER working end-to-end, no login required
- [ ] Multi-task single analysis works
- [ ] Results show model identity and are copyable/exportable
- [ ] Basic error handling in place for bad/oversized input

---

## Phase 3 — NLP Expansion + Accounts

**Why it exists.** Completes the five single-document tasks that make up MVP (`PRD.md` §18), and only now introduces account infrastructure — deliberately sequenced after a real, working NLP product already exists, so limited development time goes toward the product first and authentication second, not the reverse.

**Scope (MUST).** Adapters for **Text Classification** (built-in + zero-shot) and **Keyword Extraction**; chunking module (`Architecture.md` §7) implemented for all five tasks so far — this is where long-document correctness (`PRD.md` §14) actually gets built, not deferred; email/password authentication + API key issuance; the ownership-check dependency pattern (`Rules.md` §7); saved analyses tied to an account; resource isolation (a user can only see/act on their own data).

**Deliverables.** All five single-document tasks available in Quick Analysis with correct chunking; authenticated users can register, log in, issue an API key, and have their analyses saved and isolated from other users.

**Exit criterion.** Core NLP works, and authenticated users can securely save/manage their own resources.

**Risks.** Chunking correctness being harder than expected per task. *Mitigation:* dedicated chunking tests (`Rules.md` §11) required before the phase is marked complete, not treated as polish. Auth scope creep beyond FR-70–72. *Mitigation:* one account type, no roles, enforced by `PRD.md` Non-Goals.

**Tests.** Chunking unit tests per task; adapter tests for both new tasks; auth flow integration tests; ownership-violation test proving User A cannot access User B's saved analyses (`Rules.md` §7).

**Completion Checklist**
- [ ] Classification (built-in + zero-shot) and Keyword Extraction working
- [ ] Chunking implemented and tested for all 5 tasks
- [ ] Register → login → issue API key works via UI and API
- [ ] Saved analyses work and are verified isolated per account

---

## Phase 4 — Documents & Semantic Search

**Why it exists.** This is where the product grows beyond single-paste use for the Amara persona, and where Semantic Search — a real, distinct capability — gets built.

**Scope (MUST).** `datasets`/`documents` tables + object storage; upload endpoints (`.txt`/`.pdf`/`.docx`/`.csv`) with validation; dataset CRUD with ownership enforcement (`Rules.md` §7); embedding pipeline + pgvector index; `search` endpoint for Semantic Search; Documents and Search sections in the dashboard UI.

**Deliverables.** A logged-in user can create a dataset, upload documents, and run a semantic search query returning ranked relevant passages.

**Acceptance Criteria.** Upload validation rejects bad files with specific errors; a semantic search query against a real multi-document dataset returns relevant results; ownership tests confirm User A cannot see User B's datasets.

**Risks.** Embedding/indexing performance at realistic dataset sizes. *Mitigation:* load-tested against a 30–40 document dataset (Amara persona's realistic scale) before the phase is complete — not tested only on toy data.

**Tests.** Upload validation tests; ownership-violation tests (§7, mandatory per `Rules.md` §6); semantic search relevance spot-check against a labeled small query set.

**Completion Checklist**
- [ ] Dataset/document upload + validation working
- [ ] Ownership isolation verified with a real cross-user test
- [ ] Semantic Search returns relevant results on a realistic dataset size

---

## Phase 5 — Extractive QA

**Why it exists.** Completes the locked seven-task scope; depends on Phase 4's document infrastructure.

**Scope (MUST).** `question_answering` adapter; QA endpoint accepting question + document/context; answer span + source passage rendering in UI. **(NICE, not required this phase)** combined workflow: search result feeding directly into QA.

**Deliverables.** A user can ask a question against a specific document and get an extracted answer with its source passage.

**Acceptance Criteria.** QA works against real document content from Phase 4's datasets; over-long context is handled per `PRD.md` §14 (never silently truncated).

**Risks.** Context-length limits colliding with real documents. *Mitigation:* explicit handling path defined in `Architecture.md` §7 (narrow via search first, or inform the user) rather than left as an edge case.

**Tests.** QA adapter unit tests; over-length-context handling test.

**Completion Checklist**
- [ ] QA working end-to-end against real documents
- [ ] All 7 locked NLP capabilities now functional end-to-end (closes `PRD.md` §17 metric)
- [ ] Over-length context handled explicitly, not truncated

---

## Phase 6 — Benchmarking

**Why it exists.** Every task shipped so far used an "interim default" model. This phase replaces assumption with evidence, and produces the real latency/memory numbers Phase 8's deployment decision depends on.

**Scope (MUST).** Benchmark runner + task-appropriate metrics (`PRD.md` §9) for all 7 tasks, ≥2 candidates each; `model_registry_entries`/`benchmark_results` tables; Benchmarks page (real product screen, not a dev artifact); registry updated so benchmark-justified models replace Phase 2–5's interim defaults.

**Deliverables.** Every task has a documented, evidence-based model choice visible in the product.

**Acceptance Criteria.** ≥2 candidates benchmarked per task with the correct metric; Benchmarks page independently comprehensible to a non-code-reading reviewer; registry reflects the benchmark winner (or explicitly confirms the interim default was already best).

**Risks.** Benchmark reproducibility across machines. *Mitigation:* documented reference hardware profile; comparisons only made within the same profile.

**Tests.** Benchmark smoke test wired into CI for future PRs touching `ml/`.

**Completion Checklist**
- [ ] ≥2 candidates benchmarked per task, all 7 tasks
- [ ] Benchmarks page live and correct
- [ ] Registry reflects benchmark-justified models

---

## Phase 7 — NER Fine-Tuning + Experiments

**Why it exists.** The one real fine-tuning workflow the product claims — must follow Phase 6 so there's a real baseline to beat (`DECISIONS.md`).

**Scope (MUST).** Training pipeline (`ml/training/ner_finetune.py`); `experiments` table + endpoints; fine-tune trigger, per-epoch metrics, baseline-vs-fine-tuned comparison view; explicit promote/reject action.

**Deliverables.** One complete, honestly-reported fine-tuning run: baseline vs. fine-tuned NER, compared on held-out data, shown in-product.

**Acceptance Criteria.** Experiment record is complete (config, dataset version, per-epoch + final metrics); comparison view renders correctly whether the fine-tune wins or not; promotion flow updates the registry and is logged.

**Risks.** Fine-tune not beating baseline. *Mitigation:* this is a valid, expected, honestly-reported outcome — acceptance criteria is a correct comparison, not a guaranteed win.

**Tests.** Experiment record completeness test; promotion flow test.

**Completion Checklist**
- [ ] Fine-tune run completes end-to-end with a full experiment record
- [ ] Baseline-vs-fine-tuned comparison visible and correct in-product
- [ ] Promotion flow tested and logged

---

## Phase 8 — Quality & Deployment

**Why it exists.** Turns a working local app into a real, publicly reachable product — and is where the deployment provider is finally chosen, now backed by real Phase 6 numbers.

**Scope (MUST).** Resource sizing decision using real benchmark data (CPU sufficiency check per task, container size, startup time); managed Postgres + pgvector + object storage wired via existing abstractions (config change, not code change); CD pipeline (build/push on merge); security checklist pass (`Rules.md` §12) against the deployed environment; health checks on API and worker; basic uptime check.

**Deliverables.** OmniText reachable at a public URL, backed by managed (non-local) infrastructure.

**Acceptance Criteria.** Public URL live and fully functional; CD deploys a real merge without manual steps; security checklist passes in the deployed environment; p95 latency validated against production-like infra, not just dev-machine numbers.

**Risks.** Hosting cost for continuous transformer inference. *Mitigation:* documented in `DECISIONS.md`; smaller/distilled model variants considered and reported honestly if cost forces a trade-off, never silently downgraded without a note.

**Tests.** Post-deploy smoke tests covering all 7 tasks + auth + ownership isolation, run against the live URL.

**Completion Checklist**
- [ ] Public URL live and functional
- [ ] Managed DB + storage confirmed in use
- [ ] Security checklist passed in deployed environment
- [ ] Post-deploy smoke tests passing

---

## Phase 9 — Portfolio Showcase

**Why it exists.** The live product and the GitHub repo are both part of what a recruiter sees (`PRD.md` §7 persona Priya) — this phase makes that experience deliberate rather than incidental.

**Scope (SHOULD).** README rewritten as a project overview (problem, live demo link, architecture diagram, setup instructions); a short written case study covering the Hybrid ML strategy and the NER fine-tuning result; a consistency pass across all seven docs (no stale references, no contradicted decisions); `Memory.md` updated from "day one" state to actual final status.

**Deliverables.** A reviewer with no prior context can go from the repository root to a working understanding of the product and its ML engineering, using only the README and linked docs.

**Acceptance Criteria.** All `PRD.md` §17 success metrics reviewed and honestly reported (met, or explicitly explained if not); case study reviewed against the Priya persona standard — must satisfy a technical interviewer, not just read well.

**Risks.** Case study drifting into marketing language. *Mitigation:* reviewed specifically for technical substance, not just polish.

**Completion Checklist**
- [ ] README rewritten and verified against a fresh clone
- [ ] Case study written, cross-referenced against `DECISIONS.md`
- [ ] All docs reviewed for consistency in one pass
- [ ] Success metrics honestly reported

---

*Next document: `Design.md` — visual design organized around the three real workflow groups (Quick Analysis, Document Intelligence, Technical), not around a diagram's node count.*
