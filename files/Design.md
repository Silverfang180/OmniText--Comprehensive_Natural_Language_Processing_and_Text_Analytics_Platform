# OmniText — Design System (v4.1, Final)

| | |
|---|---|
| **Document owner** | Engineering / Design |
| **Status** | Final — v4.1 (adds the two-column result-card layout and `--accent-secondary` ink-teal token; v4.0's palette, typography, navigation, screens, and states otherwise unchanged) |
| **Implements** | `PRD.md` v3.0, `Architecture.md` §3 |
| **Related documents** | `Rules.md`, `Phases.md`, `DECISIONS.md`, `Memory.md` |

Direction: professional and useful over flashy — and, as of v4.0, warm and calm rather than cold-dark-SaaS-generic. Clear enough for a first-time visitor with no technical background, credible enough for a technical reviewer checking the ML evidence. No glassmorphism, no gradients-for-decoration, no enterprise-admin clutter, no default dark-mode-plus-electric-blue look.

**v4.1 change summary.** Added `--accent-secondary` (ink-teal, §2) as a second, functionally-distinct accent: reserved for retrieved/matched content (entity highlights, semantic search hits, QA source spans), separate from `--accent-primary` which stays reserved for generated/predicted content and interactive actions. Changed `TaskResultCard`/`ModelBadge` from a top badge-row to a two-column layout — result content left, a mono-type evidence rail (model ID, latency, confidence) right (§7) — so model provenance reads as a structural fact of the layout, not a small badge competing for attention. v4.0's palette base, typography pairing, navigation, screens, and state requirements are otherwise unchanged.

**v4.0 change summary (unchanged from prior release).** Replaced the near-black/electric-blue palette with a warm paper/charcoal palette and a single terracotta accent (§2); added a serif display typeface for headings alongside the existing sans body/UI face (§3); softened corner radii and moved cards from shadow-elevation to hairline borders (§4, §7). Navigation (§5), screens (§6), and state requirements (§10) are unchanged from v3.0.

---

## 1. Design Principles

- **The landing page is the product's front door, not a marketing splash.** A visitor should be running a real analysis within seconds, not reading feature copy.
- **The model is never invisible.** Every result shows what produced it — a design requirement, not just a data field.
- **Three workflow groups, not seven disconnected task pages** (§5) — the UI should read as one coherent product.
- **Motion clarifies state, it doesn't perform.** Loading→result, expand/collapse, status changes only.
- **Empty states are never blank.** Every list/dashboard view that could be empty has a clear explanation and a next action.

## 2. Color Palette — "Warm Neutral / Editorial Technical"

Token-based, **light mode primary** (warm paper, not clinical white) with dark mode fully supported as a warm charcoal — never pure black/blue-black, which is what makes the old palette read as generic dashboard-dark. Same token set, different values.

| Token | Light (primary) | Dark | Usage |
|---|---|---|---|
| `--bg-canvas` | `#FAF9F6` | `#16151A` | Page background — warm paper / warm charcoal, never pure white or pure black |
| `--bg-surface` | `#FFFFFF` | `#1F1E24` | Cards, panels |
| `--bg-muted` | `#F0EEE4` | `#26252B` | Chips, inactive pills, subtle fills |
| `--border-default` | `#E8E6E0` | `#2E2C33` | Dividers, inputs, card hairlines |
| `--text-primary` | `#1C1B1F` | `#F0EEE9` | Headings, content — warm black / warm white, never pure `#000`/`#FFF` |
| `--text-secondary` | `#6B6862` | `#9A968E` | Labels, metadata |
| `--accent-primary` | `#C4623F` | `#D9805E` | Primary actions, links, active nav — terracotta/clay, deliberately not SaaS blue |
| `--accent-secondary` | `#2B4A47` | `#5FA39C` | Ink-teal — reserved for retrieved/matched content (entity highlights, semantic search hits, QA source spans), functionally distinct from `--accent-primary` which marks generated/predicted content and interactive actions |
| `--success` | `#5C8A5C` | `#7FAE7B` | Positive sentiment, passing benchmarks — muted sage, not neon green |
| `--warning` | `#C9973F` | `#D9AE5F` | Degraded results, caution — ochre |
| `--danger` | `#B0503F` | `#C97060` | Errors, failed runs, negative sentiment — muted brick, not alarm-red |
| `--info` | `#6E8AA6` | `#8FADC7` | Interim-model tags, informational badges — dusty blue, used sparingly |

Task accents (used consistently for badges and result-card borders): Summarization/Classification/QA → `--accent-primary`; Sentiment → success/danger/neutral by predicted label; NER → a small fixed entity-type palette drawn from the same muted-ramp philosophy (no saturated rainbow tagging); Keyword Extraction/Semantic Search → `--info`.

**Palette rules.** Nothing saturated or neon — every color is muted enough to sit next to warm paper without vibrating. `--accent-primary` is the only color used for interactive emphasis (links, primary buttons, active nav) — success/warning/danger/info are status-only, never used for emphasis or decoration. This is what keeps the interface calm rather than colorful.

## 3. Typography

Two-typeface pairing, not one — a serif display face gives headings character and warmth; the sans face stays for all UI chrome and body copy so the product still reads as a tool, not a blog.

| Role | Typeface / Weight/Size | Notes |
|---|---|---|
| Page title | Fraunces (or Source Serif 4 fallback) 600 / 28px | One per page; the one place the serif appears at size |
| Section heading | Inter 600 / 18px | Card/section titles — sans, not serif; serif is reserved for page-level titles only |
| Body | Inter 400 / 14px | Default |
| Metadata | Inter 400 / 12px | Timestamps, model tags |
| Code/IDs | JetBrains Mono 400 / 13px | Model IDs, request IDs, JSON |
| Metrics | Inter, tabular-nums, 500–600 | Benchmark numbers, so columns align |

**Pairing rule.** Serif (Fraunces) is used only for page titles/hero text — the "front door" moments (Home headline, empty-state headlines). Every other heading level, all UI labels, and all body copy stay in Inter. This keeps the serif a deliberate accent rather than a full redesign of legibility-critical UI text. Monospace remains reserved strictly for machine-readable identifiers.

## 4. Spacing & Layout

4px base unit, standard Tailwind spacing scale. Dashboard content max-width 1120px (leaner than a 12-section enterprise shell would need), 240px collapsible sidebar. 12-column grid for card layouts. Standard Tailwind breakpoints.

**Corner radius (v4).** Softened from v3: cards and panels use 10–12px radius (not 6px); inputs/buttons/badges use 8px; pills (chips, sample-text tags) remain fully rounded. Generous whitespace is treated as a calm-design requirement, not just a spacing preference — prefer an extra `gap` step over a tighter one when in doubt.

## 5. Navigation — Analyze (Quick Analysis + Document Intelligence), Documents, Technical

Every screen exists because a persona in `PRD.md` §7 needs it — nothing added to fill out an architecture diagram.

```
Home ── no login, front door, embeds Quick Analysis directly

Analyze
 ├── Quick Analysis (ungated — the five single-document tasks)
 │    ├── Summarization
 │    ├── Sentiment
 │    ├── NER
 │    ├── Classification
 │    └── Keywords
 │
 └── Document Intelligence (context-driven; account only needed to persist a dataset)
      ├── Semantic Search
      └── Question Answering

Documents (datasets + uploads, account required)

Technical (account required to manage, publicly viewable read-only for recruiters)
 ├── Benchmarks
 └── Experiments
```

Quick Analysis and Document Intelligence are both reached under **Analyze**, but they are not interchangeable: Quick Analysis takes a single pasted string and needs no context beyond it; Document Intelligence takes a document/context (a dataset to search, or a passage to answer from) and can accept that context directly without an account — an account is only required to save a dataset for reuse across sessions.

No separate "API Playground" screen (`/docs` serves this — `PRD.md` §14 Non-Goals). No "Settings/org" screen beyond basic account/API-key management.

## 6. Key Screens

**Home / Quick Analysis (no login).** Sample-text chips, a text input, task selection (checkboxes with a one-line description each), results as a stack of `TaskResultCard`s. This is the screen most visitors see first — it must work perfectly with zero clicks of setup.

**Documents.** Dataset list (table: name, document count, created date) → detail view (documents list, upload dropzone, delete with confirmation).

**Search.** Dataset selector → query box → ranked passage results → optional "ask a question about this result" action that opens QA against the selected passage (the NICE combined workflow).

**Benchmarks.** Task selector (tabs, one per locked task) → comparison table (model, task-appropriate metric, latency, memory) + simple bar chart → active-model indicator. Publicly viewable without login — this is the recruiter-facing ML evidence screen (`PRD.md` §7 persona Priya).

**Experiments.** List of fine-tuning runs (really just the one NER run for V2) → detail view: config, per-epoch metric chart, baseline-vs-fine-tuned comparison table, promote/reject action if eligible.

## 7. Components

Built on shadcn/ui, themed via §2 tokens only.

**Elevation (v4).** Cards and panels use a 1px `--border-default` hairline instead of a drop shadow — flatter and quieter than v3's shadow-elevated cards. Reserve shadow strictly for true floating layers (menus, popovers, modals), never for in-flow cards. Status badges (`ModelBadge`, entity tags, task badges) use a tinted `--bg-muted`-family background with `--text-*` foreground rather than a solid fill — understated pill labels, not solid-color chips.

**Result layout (v4.1).** `TaskResultCard` uses a two-column layout, not a top-badge-row: the task's content/result sits in the main left column (roughly 3/4 width); a narrow right-hand rail holds the evidence metadata — model ID, latency, confidence — each on its own line, in `--font-mono`, right-aligned, `--text-secondary`. This keeps the model/latency evidence visible at a glance without competing with the result content for the same horizontal space, and reinforces "the model is never invisible" (§1) as a structural fact of the layout rather than a small badge that can get visually lost. On narrow viewports (<640px) the rail moves below the content, still visually distinct via a top hairline divider, never inline-wrapped into the result text.

| Component | Notes |
|---|---|
| `ModelBadge` | Model ID + version + latency, rendered as the right-hand evidence rail described above (not a top-row badge); "interim default" variant uses `--info`. |
| `TaskResultCard` | Two-column: result content (left) + `ModelBadge` evidence rail (right), per "Result layout" above. |
| `EvidenceTag` | The individual mono-type metadata line inside the rail (e.g. `bert-ner-v2`, `142ms`, `0.91`) — reused wherever a single fact needs the "this is a machine-reported value" visual treatment, including inline within `EntityHighlight` tooltips and `BenchmarkTable` cells. |
| `BenchmarkTable` | Sortable; row highlight for the currently active/registry model; numeric columns use `EvidenceTag` styling (tabular-nums mono). |
| `EntityHighlight` | Inline NER span highlighting using `--accent-secondary` (ink-teal) — entities are retrieved/matched content, not generated content, so they use the secondary accent per §2, not `--accent-primary`. Hover tooltip shows confidence as an `EvidenceTag`. |
| `QaAnswerCard` | Answer span highlighted within its source passage using `--accent-secondary` (retrieved content, same reasoning as `EntityHighlight`); confidence shown as an `EvidenceTag` in the right-hand rail. |
| `EmptyState` | Icon + one-line explanation + primary action — never a bare blank page. |
| `FileDropzone` | Drag-and-drop + click-to-browse, inline validation error display. |

## 8. Dark Mode / Light Mode

Both first-class, same token set. WCAG 2.1 AA contrast in both modes. Entity/task-color palettes checked for distinguishability under common color-vision deficiencies.

## 9. Animation Guidelines

Subtle, functional only — no animation exceeds 250ms, nothing loops except active loading skeletons.

| Interaction | Motion | Duration |
|---|---|---|
| Loading → result | Cross-fade + 4px slide-up | 200ms |
| Panel expand/collapse | Height auto-animate | 180ms |
| Status change (experiment running → done) | Color cross-fade | 150ms |
| Navigation | None — instant | — |
| Toast | Slide-in + fade | 150ms, error toasts persist until dismissed |
| Skeleton loading | Subtle opacity pulse | 1.2s loop, stops on real content |

Route transitions are deliberately unanimated — this is a tool used repeatedly in one session, not a marketing site (`DECISIONS.md`).

## 10. Loading, Error, and Empty States (explicit requirement)

Every data-fetching view must define all three states before it's considered complete:
- **Loading:** skeleton matching the eventual layout, not a generic spinner, for any view with structured content (tables, result cards).
- **Error:** specific message where the backend provides one (`Rules.md` §10); a retry action where retrying is sensible.
- **Empty:** `EmptyState` component, never a blank area — applies to "no datasets yet," "no experiments yet," "no search results."

---

*Next document: `DECISIONS.md` — ADRs updated for the locked 7-task scope, the modular monolith, and the deployment-agnostic approach. A new ADR for the v4.0 visual system revision (warm palette, serif/sans pairing) should be added there to keep decision history complete.*
