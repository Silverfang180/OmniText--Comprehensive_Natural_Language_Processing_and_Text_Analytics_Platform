# OmniText — Engineering Rules (v3, Final)

| | |
|---|---|
| **Document owner** | Engineering |
| **Status** | Final — v3.0 |
| **Enforces** | `PRD.md` v3.0, `Architecture.md` v3.0 |
| **Related documents** | `Phases.md`, `Design.md`, `DECISIONS.md`, `Memory.md` |

"Must" is binding. "Should" is a strong default requiring a stated reason to deviate.

---

## 1. Code Quality

- No hardcoded model IDs, thresholds, batch sizes, or URLs — all via `packages/config/` or environment variables.
- No prototype code on `main`; spikes live on a branch and are rewritten or deleted before merge.
- Every public function/class has a docstring describing purpose, parameters, return value.

## 2. Repository Structure

- `Architecture.md` §2 is authoritative; a new top-level directory requires updating it in the same PR.
- No business logic in `api/v1/routers/` — routers validate and call `services/`, nothing else.
- No authorization logic duplicated per-router — it lives once in `deps.py` (§7).

## 3. Naming Convention

| Scope | Convention | Example |
|---|---|---|
| Python modules/functions | `snake_case` | `run_finetune.py` |
| Python classes | `PascalCase` | `TaskAdapter` |
| React components | `PascalCase` | `QaAnswerCard.tsx` |
| API routes | `kebab-case`, plural | `/api/v1/documents` |
| DB tables | `snake_case`, plural | `benchmark_results` |
| Env vars | `SCREAMING_SNAKE_CASE` | `API_DATABASE_URL` |

Task registry keys (`summarization`, `sentiment`, `ner`, `classification`, `keyword_extraction`, `semantic_search`, `question_answering`) are the single vocabulary across config, DB, API, and frontend — never a second name for the same task.

## 4. Git Workflow

- Trunk-based; `main` always deployable; short-lived feature branches, squash-merged.
- Branch naming: `<type>/<short-desc>` (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`).

## 5. Commit Message Convention

Conventional Commits: `<type>(<scope>): <summary>`. Scopes: `api`, `web`, `ml`, `db`, `infra`, `docs`, or a task name.

## 6. Pull Request Standards

Every PR: states what/why, links to a `PRD.md` requirement ID or `Phases.md` milestone, confirms test coverage for the change, and — for anything touching authorization or a protected resource — explicitly confirms the ownership check was tested, not assumed.

## 7. Authorization — Non-Negotiable

This is the single most important rule in this document, because OmniText holds user-uploaded documents.

- **Every** endpoint that reads or writes a dataset, document, analysis, or experiment must resolve the resource's owner and compare it against `current_user` before doing anything else.
- This check happens in exactly one place (`deps.py` ownership dependency) and every protected router uses it — it is never reimplemented inline per route.
- A resource that exists but isn't owned by the requester returns `404`, not `403` — existence is not confirmed to a non-owner.
- No endpoint may return, list, or aggregate data across users implicitly (e.g., no "recent analyses" query that isn't scoped by `user_id` at the SQL level).
- A PR touching any data-access code must include a test proving User A cannot access User B's resource of that type. This is not optional and not satisfied by a general auth test elsewhere.

## 8. API Standards

- All endpoints versioned under `/api/v1`; breaking changes get a new version prefix.
- Response envelope (`Architecture.md` §5) used on every endpoint, success and error alike.
- Status codes used precisely: `400` validation, `401`/`404` auth/ownership (§7), `409` conflicting state, `422` semantic validation failure, `500` truly unexpected only, always logged with `request_id`.
- List endpoints paginate via `limit`/`offset` with a documented max.

## 9. Logging

- Structured JSON logs; no bare `print`.
- Every inference call logs `request_id`, `task`, `model_id`, `latency_ms`, `input_size`, `outcome`.
- No document content or PII in logs — IDs and sizes only.

## 10. Error Handling

- Predictable failures (bad input, unsupported file, oversized file, model timeout, ownership mismatch) are typed exceptions caught by one central handler mapping to the standard envelope.
- No bare `except Exception` without re-raise or an inline justification.
- Frontend surfaces specific errors ("File exceeds 25MB" not "Something went wrong") wherever the backend provides that detail.
- Background jobs record failure in the job/experiment row rather than dying silently.

## 11. Testing

- Every task adapter has a unit test with a small fixed-seed fixture — no full production model downloads in CI.
- Every API router has integration tests covering success, a validation failure, and — for protected resources — an ownership-violation attempt (§7).
- Chunking logic (`Architecture.md` §7) has dedicated tests per task strategy, since it's a correctness requirement, not a nice-to-have.
- Benchmark and training pipelines have a smoke-test mode (tiny models/eval sets) run on every PR touching `ml/`.
- No test depends on live Hugging Face Hub access in CI.
- Coverage is a signal, not a target — every adapter, every protected route, and the authorization layer must be genuinely tested; chasing a percentage on unrelated code is not the goal.

## 12. Security

- No secrets in source control; `.env.example` documents required variables with placeholders only.
- All input validated at the Pydantic schema boundary.
- Uploaded files validated for MIME type and size before storage or parsing; untrusted PDF/DOCX parsing cannot execute embedded content.
- Passwords hashed with Argon2id or bcrypt; API keys hashed at rest, shown once at creation.
- Dependency vulnerability scan (`pip-audit`/`npm audit`) on every PR; high/critical blocks merge.
- Reasonable per-account rate limiting on inference and job-triggering endpoints.

## 13. Type Safety

- Backend: full type hints, `mypy --strict` in CI, `Any` requires a justification comment.
- Frontend: `strict: true`, no `any` without justification; API types generated from OpenAPI, never hand-duplicated.

## 14. Performance

- Latency targets (`PRD.md` NFR-01) are validated against real benchmark data (Phase 6), not assumed.
- Models cached process-local after first load; no per-request reload.
- Dataset-scale work (embedding a dataset, benchmark/fine-tune runs) always goes through the background job path — never blocks a request thread.

## 15. ML Model Standards

- No model reaches the serving path without a Model Registry entry, a benchmark result, and a pinned version (hub revision hash or checkpoint URI + tag) — never `latest`.
- Swapping the active model for a task is a registry mutation, always accompanied by a benchmark or experiment record justifying it.

## 16. Benchmark Standards

- No task ships with fewer than two benchmarked candidates.
- The metric used per task is fixed by `PRD.md` §9 — no ad hoc substitution.
- Eval datasets are versioned/hashed; results are only compared within the same eval-set version and hardware profile.
- **Keyword/Keyphrase Extraction specifically:** report Precision@K / Recall@K / F1 when a suitable labeled evaluation dataset is available. When no suitable labeled ground truth exists, use a documented human-evaluation protocol or another explicitly defined proxy metric instead. Proxy or human-evaluation results must be clearly labeled as such in the Benchmarks page and must never be presented as directly comparable to supervised metrics from other tasks or other candidates evaluated differently.

## 17. Fine-Tuning Standards

- NER only in V2; a second fine-tuned task requires a new ADR in `DECISIONS.md` before implementation — not just a PR.
- Every run records: base checkpoint + version, hyperparameters, dataset version, per-epoch metrics, final test metrics. Partial records are treated as failed for registry purposes.
- Promotion is explicit and separate from the run completing (`PRD.md` FR-44).
- The fine-tuned model is always evaluated against the pretrained baseline on the *same* held-out split before promotion is offered.

## 18. Evaluation Standards

- One evaluator implementation (`ml/evaluation/evaluator.py`) shared by benchmark and training pipelines.
- Every evaluation result is reported with eval-set size alongside the headline metric, to avoid a misleadingly clean number on a tiny set.

## 19. Chunking Standards

- Chunking strategy is chosen per task (`Architecture.md` §7), not applied as one universal rule.
- Any adapter handling text longer than its model's input limit must chunk and recombine — silent truncation is a defect, treated the same severity as a broken endpoint.

## 20. Deployment Readiness

- The application must run with CPU-only inference by default; a task requiring GPU for acceptable latency must document that requirement explicitly rather than assuming GPU availability.
- All config is environment-variable driven; no environment-specific values hardcoded anywhere in application code.
- Health-check endpoints exist for both the API and worker processes before Phase 8 (deployment) begins.

---

*Every feature merged must satisfy: documented, benchmarked (if model-facing), tested (including ownership tests for protected resources), and logged. A PR that cannot confirm all four for an in-scope change should not be approved.*

*Next document: `Phases.md` — a realistic, time-aware build order for this exact scope.*
