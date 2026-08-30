# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** OmniText
**Generated:** 2026-08-26 17:27:18
**Category:** General

---

## Global Rules

### Color Palette

| Token | Light Mode Value | Dark Mode Value | Usage |
|---|---|---|---|
| `--bg-canvas` | `#FAF9F6` | `#16151A` | Main page canvas background |
| `--bg-surface` | `#FFFFFF` | `#1F1E24` | Primary container card/panel surfaces |
| `--bg-muted` | `#F0EEE4` | `#26252B` | Secondary list, background panels, or sidebar items |
| `--border-default` | `#E8E6E0` | `#2E2C33` | Borders, inputs, standard dividers |
| `--text-primary` | `#1C1B1F` | `#F0EEE9` | Primary headings, body copy |
| `--text-secondary` | `#6B6862` | `#9A968E` | Secondary metadata labels, subtitles |
| `--accent-primary` | `#C4623F` | `#D9805E` | Interactive elements, brand accent actions, active tabs |
| `--accent-secondary` | `#2B4A47` | `#5FA39C` | Retrieved/matched highlights (NER, QA answer spans, search terms) |
| `--success` | `#5C8A5C` | `#7FAE7B` | Positive states, passing benchmarks, active models |
| `--warning` | `#C9973F` | `#D9AE5F` | Cautions, degraded metrics, pending runs |
| `--danger` | `#B0503F` | `#C97060` | Errors, failed benchmarks, negative sentiment |
| `--info` | `#6E8AA6` | `#8FADC7` | Interim default models, keywords tags, helper chips |

### Typography

- **Heading Font:** Fraunces (600 weight, page titles only)
- **Body / Interface Font:** Inter (400 weight for body, 500-600 weight for labels/buttons)
- **Monospace Font:** JetBrains Mono (400-500 weight, model IDs, latency/memory metrics, code snippets)
- **Mood:** Clean, Warm Editorial, High-contrast, Mono-detailed tabular metadata

**CSS Variables Setup:**
```css
body {
  font-family: var(--font-sans), system-ui, sans-serif;
}
h1 {
  font-family: var(--font-serif), Georgia, serif;
}
.font-mono {
  font-family: var(--font-mono), monospace;
}
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Tiny gaps |
| `--space-sm` | `8px` | Badges gap, line padding |
| `--space-md` | `16px` | Standard page paddings |
| `--space-lg` | `24px` | Main grid gaps, card paddings |
| `--space-xl` | `32px` | Page title margin bottom |

### Shadow Depths
- **None:** Flat design. Hairline borders (`border border-border-default`) must be used instead of drop shadows.

---

## Component Specs

### Buttons

```css
/* Primary interactive brand actions */
.btn-primary {
  background: var(--accent-primary);
  color: white;
  padding: 10px 18px;
  border-radius: 8px;
  font-weight: 600;
  transition: background-color 150ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

/* Secondary outline options */
.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  padding: 10px 18px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 150ms ease;
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--bg-muted);
}
```

### Cards

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 10px; /* 10-12px card radius spec */
  padding: 20px;
  box-shadow: none; /* No shadows; hairline borders only */
  transition: border-color 150ms ease;
}

.card:hover {
  border-color: var(--text-secondary);
}
```

### Inputs

```css
.input {
  padding: 10px 14px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-surface);
  color: var(--text-primary);
  transition: border-color 150ms ease;
}

.input:focus {
  border-color: var(--accent-primary);
  outline: none;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(22, 21, 26, 0.4);
  backdrop-filter: none; /* Keep UI clean and fast */
}

.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  padding: 24px;
  box-shadow: none; /* Flat styling */
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Minimalism & Swiss Style

**Keywords:** Clean, simple, spacious, functional, white space, high contrast, geometric, sans-serif, grid-based, essential

**Best For:** Enterprise apps, dashboards, documentation sites, SaaS platforms, professional tools

**Key Effects:** Subtle hover (200-250ms), smooth transitions, sharp shadows if any, clear type hierarchy, fast loading

### Page Pattern

**Pattern Name:** Hero + Features + CTA

- **Conversion Strategy:** Deep CTA placement. For CTA label text, verify at least 4.5:1 against the button fill; use 7:1 only when the product explicitly targets AAA normal-text contrast. Keep focus and component boundaries independently visible. Disable hero parallax under reduced motion and render its static final state.
- **CTA Placement:** Hero (sticky) + Bottom
- **Section Order:** Hero with headline/image > Value prop > Key features (3-5) > CTA section > Footer

---

## Anti-Patterns (Do NOT Use)


### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
