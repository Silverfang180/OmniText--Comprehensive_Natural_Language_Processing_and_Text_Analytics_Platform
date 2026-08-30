# OmniText — Architecture Decision Records (v4, Final)

| | |
|---|---|
| **Document owner** | Engineering |
| **Status** | Final — v4.1 (adds ADR-015, the two-column result-card layout decision; ADR-001–014 unchanged) |
| **Related documents** | `PRD.md`, `Architecture.md`, `Rules.md`, `Phases.md`, `Design.md`, `Memory.md` |

Each record: **Context → Decision → Alternatives Considered → Trade-offs → Future Revisions**. New decisions are appended; a reversal gets a new ADR referencing the one it supersedes.

---

## ADR-001: Next.js/FastAPI over Streamlit

**Context.** V1 was a single Streamlit script — no API, no auth, no persistence, no test suite.
**Decision.** Decoupled Next.js frontend + FastAPI backend over a versioned REST API.
**Alternatives.** Staying on Streamlit (rejected — its execution model fights a real API/background-job/typed-frontend architecture); Django+DRF (heavier than needed for an API-plus-ML-orchestration service); Gradio (even more demo-oriented, same rejection).
**Trade-offs.** Two codebases instead of one script, mitigated by OpenAPI-generated frontend types. In exchange: a real independently-usable API and a real deployment story.
**Future Revisions.** None anticipated.

## ADR-002: FastAPI over Flask/Django

**Context.** Needed a Python web framework for API + ML orchestration.
**Decision.** FastAPI.
**Alternatives.** Flask (no native validation/async story as clean); Django+DRF (batteries not needed here — no admin site requirement, no content-managed pages).
**Trade-offs.** Thinner admin tooling ecosystem, irrelevant since Benchmarks/Experiments are first-class app screens, not an admin backend.
**Future Revisions.** None anticipated.

## ADR-003: Modular monolith, not microservices

**Context.** One developer, seven NLP tasks, no independent-scaling requirement between components.
**Decision.** One FastAPI application (plus a background worker process sharing the same codebase) — internal modularity via adapters and a service layer, not service-per-capability.
**Alternatives.** Microservices per task or per concern (rejected — adds network failure modes, deployment surfaces, and operational overhead with no real scaling need to justify it); a single script with no internal layering (rejected — would sacrifice the maintainability that adapters/service-layer separation gives at near-zero added cost).
**Trade-offs.** No independent scaling of, say, the NER adapter versus the rest of the app — acceptable, because nothing in this product's real usage pattern needs that.
**Future Revisions.** Revisit only if a specific component's load genuinely outgrows what the monolith can serve — not anticipated at this product's scale.

## ADR-004: Hugging Face Transformers as the model layer

**Context.** Needed a model ecosystem covering seven task types with both pretrained inference and NER fine-tuning support.
**Decision.** Hugging Face Transformers + Sentence Transformers for embeddings, accessed only through the `TaskAdapter` interface.
**Alternatives.** Hosted-API-only strategy (rejected — removes the benchmarking/fine-tuning work that's the actual ML engineering demonstration, and makes cost/latency opaque); fully custom models trained from scratch (rejected — out of scope, no research budget, would starve the platform-engineering half of the project of time).
**Trade-offs.** Local inference cost is higher than a hosted API call — this is exactly why latency/memory are recorded per benchmark, not assumed acceptable.
**Future Revisions.** A hosted-API adapter is a plausible future addition behind the same interface if a specific task benchmarks better that way — not the default.

## ADR-005: Hybrid ML strategy — benchmark all 7 tasks, fine-tune only NER

**Context.** Seven tasks need a sourcing strategy: fine-tune everything (high credibility, very high time cost) vs. pretrained-only everywhere (fast, demonstrates no training capability).
**Decision.** Hybrid: every task benchmarked with ≥2 real candidates; exactly one task — NER — additionally fine-tuned.
**Alternatives.** Fine-tune all seven (rejected — time/compute cost far exceeds the value for tasks like Language-agnostic Sentiment where pretrained models are already strong); fine-tune nothing (rejected — leaves the product unable to demonstrate the training/evaluation/promotion workflow that's a real part of the ML engineering story); fine-tune a task chosen for visual "wow" like Summarization (rejected, see ADR-006).
**Trade-offs.** The honest claim is "we fine-tuned NER," not "we fine-tuned everything" — treated as a feature (demonstrates judgment about where fine-tuning is worth it), not a limitation to hide.
**Future Revisions.** A second fine-tuned task requires a new ADR (`Rules.md` §17) — this decision explicitly gates scope creep here.

## ADR-006: NER as the fine-tuning target

**Context.** Given ADR-005 fixes one fine-tuned task, a specific task had to be chosen.
**Decision.** Named Entity Recognition.
**Alternatives.** Summarization (rejected — compute-heavier to iterate on, and ROUGE is a weaker proxy for "good summary" than seqeval F1 is for "correct entity span"); Classification/Sentiment (rejected — pretrained baselines are already strong, so a fine-tune's improvement margin would be small and unconvincing as a demonstration).
**Trade-offs.** NER fine-tuning needs labeled span-level data, a real cost paid in Phase 7 — accepted, because it's exactly the higher-friction, higher-signal ML work worth demonstrating.
**Future Revisions.** None anticipated within V2 scope.

## ADR-007: Benchmark before fine-tune, always

**Context.** Needed to decide whether fine-tuning could target an unvalidated pretrained checkpoint or must follow a formal benchmark.
**Decision.** No fine-tuning begins without a completed benchmark for that task establishing the pretrained baseline (Phase 6 precedes Phase 7).
**Alternatives.** Fine-tuning directly from a popular Hub checkpoint with no baseline (rejected — "the fine-tune is better" becomes an unfalsifiable claim with nothing rigorous to compare against).
**Trade-offs.** Adds a sequencing dependency, in exchange for every fine-tuning claim being backed by a real baseline comparison.
**Future Revisions.** None anticipated — foundational methodology, not a scope decision.

## ADR-008: PostgreSQL + pgvector as the sole system of record; no Redis/Celery, no dedicated vector DB, no MLflow

**Context.** Needed a data store for structured data, embeddings, experiment tracking, and background job coordination, at the scale of one developer's product with modest real traffic.
**Decision.** PostgreSQL for all structured data, extended with `pgvector` for embeddings, and a simple `jobs` table for background work (dataset embedding, benchmark runs, fine-tune runs) polled by a worker process. No separate vector database, no Redis/Celery broker, no MLflow/W&B.
**Alternatives.** Dedicated vector DB (rejected — `pgvector` is sufficient at this dataset scale, and a second database technology adds real operational cost for no real benefit here); MLflow/W&B (rejected — the `experiments`/`model_registry_entries` tables cover the actual tracking need, and the product's own Benchmarks/Experiments screens are the intended interface for this data anyway, making a second tool's UI partially redundant); Redis+Celery (rejected — no request volume that justifies a dedicated broker; a Postgres-backed jobs table handles the real job types listed, which are few and infrequent).
**Trade-offs.** Less feature-rich than dedicated tools (no built-in retry-dashboard, no MLflow UI) — acceptable because this system's actual job volume and experiment count are small, and the product's own UI is the real interface for this data.
**Future Revisions.** Revisit specifically if real deployed usage (not anticipated usage) shows job volume or dataset scale genuinely outgrowing what's comfortable in Postgres.

## ADR-009: Docker + GitHub Actions, deployment provider deferred

**Context.** Needed containerization/CI-CD consistent with local reproducibility and portfolio-visible CI, without locking a hosting provider before real resource numbers exist.
**Decision.** Three Docker images (`web`, `api`, `worker`); GitHub Actions for CI (lint/typecheck/test) and CD (build/push on merge); the actual hosting provider is chosen in Phase 8, after Phase 6 benchmarking produces real latency/memory/CPU-sufficiency data.
**Alternatives.** Choosing a specific provider (e.g., a particular container platform) up front (rejected — premature; the right choice depends on real resource numbers this project doesn't have until Phase 6); Kubernetes from the start (rejected — operational overhead not justified at this scale, and arguably a visible weak point if under-resourced rather than a strength); CircleCI/Jenkins over GitHub Actions (rejected — GitHub Actions is co-located with the repository a technical reviewer is already looking at, with zero extra account needed to inspect CI history).
**Trade-offs.** No committed deployment target this early — acceptable, because the storage/DB abstractions in `Architecture.md` §12 keep the eventual choice a config change, not a rewrite.
**Future Revisions.** Provider is finalized in Phase 8; if real usage ever justified GPU or multi-instance scaling, that would be evaluated then, not assumed now.

## ADR-010: 7-task scope — Emotion Detection, Language Detection, and standalone Similarity Search deferred

**Context.** The prior draft scoped ten tasks. Given one developer and limited time, every task not central to the product's coherence (§4 of `PRD.md`) or distinct value competes directly with finishing the core product well.
**Decision.** Lock V2 scope to seven tasks: Summarization, Sentiment, NER, Classification, Keyword Extraction, Semantic Search, Extractive QA. Emotion Detection, Language Detection, and standalone Similarity Search are deferred to Future Roadmap.
**Alternatives.** Keeping all ten (rejected — three of the ten add comparatively little distinct value: Language Detection is rarely the reason someone opens an NLP tool, Emotion Detection largely overlaps with Sentiment's value proposition at this product's scope, and standalone Similarity Search is subsumed by Semantic Search's ranking, which already does similarity comparison internally); cutting further to five or fewer tasks (rejected — seven is the smallest set that still covers all five product pillars — Understand/Analyze/Extract/Retrieve/Answer — coherently; cutting Semantic Search or QA would remove an entire pillar).
**Trade-offs.** A narrower feature list than the original ten-task pitch — accepted deliberately, because seven fully-realized, benchmarked, well-integrated tasks demonstrate more engineering judgment than ten shallow ones, and are actually finishable by one developer in available time.
**Future Revisions.** Any of the three deferred tasks can return as a ninth/tenth adapter later — the `TaskAdapter` interface doesn't preclude it, and each would need its own benchmark before shipping, same as any task.

## ADR-011: Lightweight explainability, not research-grade attribution

**Context.** Explainability adds real trust value to classification-style results but a full attribution pipeline (integrated gradients, SHAP) is a second research project, not a proportionate feature for this product.
**Decision.** Confidence/probability scores for classification-style tasks, span highlighting for NER/QA — no heavier attribution method.
**Alternatives.** Integrated gradients or SHAP-based attribution (rejected — meaningfully higher implementation and compute cost for a marginal trust improvement over confidence scores + highlighting, for a product where "is this black box explainable" isn't the primary evaluation question).
**Trade-offs.** Less rigorous than a research-grade method — accepted, because the actual product need is "make results feel non-arbitrary," which confidence scores and highlighting satisfy.
**Future Revisions.** Revisit if user feedback specifically indicates the lightweight signal is insufficient.

## ADR-012: No custom API Playground UI

**Context.** FastAPI generates a fully interactive OpenAPI UI at `/docs` for free.
**Decision.** Use `/docs` as the API playground; build no custom equivalent.
**Alternatives.** A custom-styled request-builder UI (rejected — real development time spent rebuilding something already provided, for a feature only the Marcus persona uses).
**Trade-offs.** `/docs` won't match the app's visual theme — acceptable; developers evaluating an API expect standard OpenAPI tooling.
**Future Revisions.** None anticipated.

## ADR-013: Ownership-based authorization, no RBAC

**Context.** OmniText holds user-uploaded documents; real data isolation is a hard requirement, but the product has exactly one account type.
**Decision.** Every protected resource is owned by exactly one account; every access is authorized against that ownership at a single shared check point (`Architecture.md` §11, `Rules.md` §7). No roles, no organizations, no SSO.
**Alternatives.** Full RBAC/org model (rejected — no actual multi-user-per-resource requirement exists; building role infrastructure for a single-account-type product would be complexity with no corresponding real need).
**Trade-offs.** Can't express "share a dataset with another user" today — not a requirement in `PRD.md`, and the ownership model doesn't preclude adding sharing later if it becomes one.
**Future Revisions.** Revisit if a real sharing/collaboration requirement emerges.

## ADR-014: v4.0 visual system — warm neutral palette and serif/sans typography pairing, replacing v3.0's dark/electric-blue system

**Context.** v3.0's visual system (near-black canvas `#0A0B0D`, electric blue `#5B8CFF` accent, single sans typeface) is functionally sound but visually indistinguishable from the default dark-SaaS-dashboard look shared by most ML/dev-tool products shipping in this period — it does not read as unique, and its coolness works against the "calm" quality wanted for a tool used repeatedly in one session.
**Decision.** Replace the palette with a warm paper/charcoal system (`--bg-canvas` `#FAF9F6` light / `#16151A` dark — warm tones at both ends, never pure white/black) and a single terracotta accent (`--accent-primary` `#C4623F`) in place of blue; add Fraunces as a serif display typeface reserved for page titles and hero text only, with Inter retained for all other UI and body copy; soften card/panel corner radii (6px → 10–12px) and move cards from shadow elevation to a 1px hairline border. Full token table and typography rules in `Design.md` §2–3, §7.
**Alternatives.** Palette-only tweak, keeping the dark-mode-primary/blue-accent structure (rejected — the category-default coolness is the actual problem being solved, not the specific blue hex; a tweak within the same structure wouldn't produce a genuinely distinct or calmer feel); full rebrand including a second serif weight across all heading levels (rejected — would compromise UI legibility at smaller sizes and dilute the serif's role as a deliberate accent into just "the new default font," reintroducing the generic-template problem from a different direction); redesigning navigation/IA alongside the palette (rejected — out of scope for this ADR; `Design.md` §5–6, §10 remain v3.0 and unchanged, since the problem being solved is visual tone, not information architecture).
**Trade-offs.** Two typefaces to load and maintain instead of one; light mode is now the primary/default mode rather than dark, a reversal from v3.0 that touches every screenshot, mock, and reference in prior docs — accepted, because the calm/editorial direction reads better in a warm-light-first context and dark mode remains fully specified as a first-class second mode, not dropped.
**Future Revisions.** Revisit only if the warm/serif direction tests poorly with the Priya (recruiter) or Marcus (developer) personas once real screens are built — not anticipated, but not asserted as final by fiat either.

## ADR-015: Two-column result-card layout (evidence rail), combining v4.0 with the rejected-but-informative "Lab Notebook" alternative

**Context.** v4.0 (ADR-014) put model provenance in a top-row `ModelBadge` on `TaskResultCard`, matching the "Editorial Technical" direction evaluated alongside two alternatives — "Lab Notebook" (severe, grid-ruled, metadata in a distinct right-hand column) and "Quiet Bento" (minimal Swiss grid). Editorial Technical was adopted for its overall palette, typography, and warmth; a top-row badge, however, competes for the same horizontal space as the result content and is easy to visually deprioritize, which works against the "the model is never invisible" principle (`Design.md` §1) that motivated tracking model provenance in the first place.
**Decision.** Keep v4.0's palette, typography, and overall visual language, but adopt Lab Notebook's structural pattern for result display: a two-column `TaskResultCard` layout, with task content in a wide left column and a narrow right-hand evidence rail (model ID, latency, confidence — in `--font-mono`, right-aligned) instead of a top badge row. Add `--accent-secondary` (ink-teal) as a second accent reserved specifically for retrieved/matched content (entity spans, semantic search hits, QA source spans), keeping `--accent-primary` (terracotta) reserved for generated/predicted content and interactive actions — this distinction also originates from comparing the three evaluated directions and is adopted here because it gives the two-accent system real functional meaning rather than decorative variety.
**Alternatives.** Keeping the v4.0 top-badge-row layout unchanged (rejected — the whole reason for evaluating alternatives was that provenance needed to be structurally unmissable, not just present; a badge a user can visually skip past doesn't fully satisfy that); adopting Lab Notebook's full visual language (palette, severity, grid-rule aesthetic) wholesale in place of Editorial Technical (rejected — v4.0's warmth was deliberately chosen for approachability with first-time/casual visitors, per `PRD.md` persona Daniel, and Lab Notebook's colder register works against that; only the *structural* metadata-placement pattern is adopted, not its palette or typographic register); adopting Quiet Bento's minimal grid instead (rejected — no distinctive typographic or color signature, lowest risk but also the direction least likely to read as deliberately designed rather than templated).
**Trade-offs.** The evidence rail costs horizontal space on every result card, and on narrow viewports (<640px) must reflow below the content rather than staying side-by-side (`Design.md` §7) — accepted, because the alternative (a skippable top badge) was the exact problem being solved. `EntityHighlight` and `QaAnswerCard` now depend on `--accent-secondary` being visually distinct from `--accent-primary` in both light and dark mode — verified as part of the same accessibility/contrast pass already required for all tokens (`Design.md` §8).
**Future Revisions.** Revisit the evidence-rail width/placement specifically if real usage shows it crowds result content on common viewport sizes rather than just the documented narrow-viewport case.

---

*Next document: `Memory.md` — concise persistent context for future sessions, reflecting this final v4.1 scope (7-task lock unchanged from v3.0; visual system per ADR-014/015).*
