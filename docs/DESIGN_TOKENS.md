# Watcon SaaS — Design Tokens

> **Status:** Canonical design-token reference (CSS variables). **No Tailwind.**
> **Date:** 2026-05-29
> **Consumed by:** [FRONTEND_DESIGN_SYSTEM.md](FRONTEND_DESIGN_SYSTEM.md) · [UI_ARCHITECTURE.md](UI_ARCHITECTURE.md). This file is the source of truth for token *values*; the others describe how components use them.
> **Aesthetic:** Japanese minimal · monochrome (black / white / gray) · enterprise SaaS.

**How to use:** the `:root` block below lives in `app/globals.scss`; the `[data-theme='dark']` block follows it. Components reference tokens only — `color: var(--color-text)`, `padding: var(--space-4)` — never raw hex/px. Breakpoints are also exported as a **SCSS map** (§9) because CSS variables cannot be used in `@media` conditions.

---

## 1. Colors

Monochrome neutral ramp (`--gray-0` washi-paper → `--gray-950` sumi-ink) + semantic aliases. Components use **semantic** names, never the ramp directly.

```css
:root {
  /* ── Neutral ramp ──────────────────────────────────────────── */
  --gray-0:   #ffffff;
  --gray-25:  #fafaf8;   /* washi paper — app background */
  --gray-50:  #f5f5f3;
  --gray-100: #ececea;
  --gray-200: #dcdcd9;   /* hairline border */
  --gray-300: #c4c4c0;
  --gray-400: #a3a3a0;
  --gray-500: #808080;
  --gray-600: #5f5f5d;
  --gray-700: #444443;
  --gray-800: #2a2a29;
  --gray-900: #161615;
  --gray-950: #0a0a0a;   /* sumi ink — primary text & action */

  /* ── Semantic: surfaces & text ─────────────────────────────── */
  --color-bg:            var(--gray-25);
  --color-surface:       var(--gray-0);
  --color-surface-2:     var(--gray-50);   /* table headers, subtle fills */
  --color-border:        var(--gray-200);
  --color-border-strong: var(--gray-300);
  --color-text:          var(--gray-950);
  --color-text-muted:    var(--gray-600);
  --color-text-subtle:   var(--gray-500);
  --color-text-inverse:  var(--gray-0);

  /* ── Semantic: primary action (= ink; monochrome) ──────────── */
  --color-primary:       var(--gray-950);
  --color-primary-hover: var(--gray-800);
  --color-on-primary:    var(--gray-0);    /* text/icon on primary */
  --color-accent:        var(--color-primary);  /* alias used by FRONTEND_DESIGN_SYSTEM */

  /* ── Focus & overlay ───────────────────────────────────────── */
  --color-focus:   var(--gray-950);
  --color-overlay: rgba(10, 10, 10, 0.40);

  /* ── Status (desaturated, used sparingly) — fg + bg pairs ──── */
  --color-success-fg: #2f6b4a;  --color-success-bg: #eef4f0;
  --color-warning-fg: #8a6a2c;  --color-warning-bg: #f6f1e7;
  --color-danger-fg:  #9b3838;  --color-danger-bg:  #f7eded;
  --color-info-fg:    #36567a;  --color-info-bg:    #eef2f6;
}
```

| Semantic token | Role | Light value |
|----------------|------|-------------|
| `--color-bg` | App background | `--gray-25` |
| `--color-surface` | Cards, inputs, menus | `--gray-0` |
| `--color-border` | Hairline borders | `--gray-200` |
| `--color-text` | Primary text | `--gray-950` |
| `--color-primary` | Buttons/links/active (ink) | `--gray-950` |
| `--color-*-fg/-bg` | Status text / subtle fill | desaturated |

---

## 2. Typography

```css
:root {
  /* Families */
  --font-display: 'Noto Serif JP', Georgia, 'Times New Roman', serif;  /* headings */
  --font-sans:    'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; /* body/UI */
  --font-mono:    'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;       /* numbers/IDs/code */

  /* Scale (enterprise base = 14px; rem off a 16px root) */
  --fs-100: 0.6875rem;  /* 11 — micro/labels   */
  --fs-200: 0.75rem;    /* 12 — caption        */
  --fs-300: 0.8125rem;  /* 13 — dense table    */
  --fs-400: 0.875rem;   /* 14 — BODY DEFAULT   */
  --fs-500: 1rem;       /* 16                  */
  --fs-600: 1.125rem;   /* 18                  */
  --fs-700: 1.375rem;   /* 22                  */
  --fs-800: 1.75rem;    /* 28                  */
  --fs-900: 2.25rem;    /* 36 — display        */

  /* Weights */
  --fw-regular: 400;  --fw-medium: 500;  --fw-semibold: 600;  --fw-bold: 700;

  /* Line heights */
  --lh-tight: 1.2;  --lh-snug: 1.35;  --lh-normal: 1.5;  --lh-relaxed: 1.65;

  /* Letter spacing */
  --tracking-tight:  -0.01em;   /* display headings        */
  --tracking-normal:  0;
  --tracking-label:   0.04em;   /* uppercase labels/caps   */
}
```

---

## 3. Spacing

4px base, 8px rhythm. Use for padding, margin, and flex/grid `gap`.

```css
:root {
  --space-0:  0;
  --space-1:  0.25rem;  /*  4 */
  --space-2:  0.5rem;   /*  8 */
  --space-3:  0.75rem;  /* 12 */
  --space-4:  1rem;     /* 16 */
  --space-5:  1.25rem;  /* 20 */
  --space-6:  1.5rem;   /* 24 */
  --space-8:  2rem;     /* 32 */
  --space-10: 2.5rem;   /* 40 */
  --space-12: 3rem;     /* 48 */
  --space-16: 4rem;     /* 64 */
  --space-20: 5rem;     /* 80 */
}
```

---

## 4. Radius

Minimal aesthetic → small radii. `--radius-full` only for pills/avatars.

```css
:root {
  --radius-none: 0;
  --radius-sm:   2px;
  --radius-md:   4px;   /* default for inputs, buttons, cards */
  --radius-lg:   8px;   /* dialogs, large surfaces */
  --radius-full: 9999px;
}
```

---

## 5. Borders

Hairline-first (1px). Composed shorthands so components write `border: var(--border)`.

```css
:root {
  --border-width:        1px;
  --border-color:        var(--color-border);
  --border-color-strong: var(--color-border-strong);

  --border:        var(--border-width) solid var(--color-border);
  --border-strong: var(--border-width) solid var(--color-border-strong);
  --border-focus:  2px solid var(--color-focus);
}
```

---

## 6. Shadows

Subtle and rare — minimalism prefers hairlines over elevation.

```css
:root {
  --shadow-none: none;
  --shadow-sm: 0 1px 2px rgba(10, 10, 10, 0.04);
  --shadow-md: 0 2px 8px rgba(10, 10, 10, 0.06);   /* dropdowns, popovers */
  --shadow-lg: 0 8px 24px rgba(10, 10, 10, 0.08);  /* dialogs, drawers   */
}
```

---

## 7. Z-index

Single ordered scale — never hard-code stacking values.

```css
:root {
  --z-base:     0;
  --z-dropdown: 1000;
  --z-sticky:   1100;   /* sticky table headers, topbar */
  --z-overlay:  1200;   /* modal/drawer backdrop */
  --z-modal:    1300;
  --z-popover:  1400;
  --z-toast:    1500;
  --z-tooltip:  1600;
}
```

---

## 8. Breakpoints

Exposed as CSS variables for reference/JS, **and** as a SCSS map for `@media` (§9).

```css
:root {
  --bp-sm:  480px;
  --bp-md:  768px;
  --bp-lg:  1024px;
  --bp-xl:  1280px;
  --bp-xxl: 1536px;
}
```

> ⚠ CSS variables **cannot** be used inside `@media (min-width: …)` conditions. For media queries, use the SCSS map + `respond-to()` mixin in §9. The CSS vars above are only for inline/JS reads.

---

## 9. SCSS breakpoint map + mixin (`src/styles/_tokens.scss` / `_mixins.scss`)

```scss
$breakpoints: (
  sm: 480px,
  md: 768px,
  lg: 1024px,
  xl: 1280px,
  xxl: 1536px,
);

@mixin respond-to($bp) {                 // mobile-first (min-width)
  @media (min-width: map-get($breakpoints, $bp)) { @content; }
}
@mixin respond-to-max($bp) {             // down to (max-width)
  @media (max-width: (map-get($breakpoints, $bp) - 0.02px)) { @content; }
}
```

---

## 10. Layout & motion (supporting tokens)

```css
:root {
  /* Layout */
  --container-max:       1280px;
  --sidebar-w:           248px;
  --sidebar-w-collapsed: 64px;
  --topbar-h:            56px;
  --content-pad:         var(--space-6);

  /* Motion */
  --dur-fast: 120ms;  --dur-base: 180ms;  --dur-slow: 240ms;
  --ease-standard:   cubic-bezier(0.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(0.3, 0, 0, 1);
}

@media (prefers-reduced-motion: reduce) {
  :root { --dur-fast: 0ms; --dur-base: 0ms; --dur-slow: 0ms; }
}
```

---

## 11. Dark theme overrides

Only the **semantic** tokens flip; the ramp and all non-color tokens stay. Set `data-theme="dark"` on `<html>`.

```css
[data-theme='dark'] {
  --color-bg:            var(--gray-950);
  --color-surface:       var(--gray-900);
  --color-surface-2:     var(--gray-800);
  --color-border:        var(--gray-800);
  --color-border-strong: var(--gray-700);
  --color-text:          var(--gray-25);
  --color-text-muted:    var(--gray-400);
  --color-text-subtle:   var(--gray-500);
  --color-text-inverse:  var(--gray-950);

  --color-primary:       var(--gray-25);
  --color-primary-hover: var(--gray-100);
  --color-on-primary:    var(--gray-950);
  --color-accent:        var(--color-primary);

  --color-focus:   var(--gray-25);
  --color-overlay: rgba(0, 0, 0, 0.6);

  /* Status: brighten foregrounds, darken subtle fills for contrast on dark surfaces */
  --color-success-fg: #6fae87;  --color-success-bg: #16241c;
  --color-warning-fg: #c9a44e;  --color-warning-bg: #2a2417;
  --color-danger-fg:  #cf7373;  --color-danger-bg:  #2a1717;
  --color-info-fg:    #7aa0c5;  --color-info-bg:    #161f29;
}
```

---

## 12. Consumption rules

- **Tokens only.** No raw hex/px in components — always `var(--…)`. Status colours only via the `-fg`/`-bg` pairs.
- **Theme-agnostic components.** Never branch on theme in TS/SCSS; the cascade does it.
- **Add a token before a value.** Need a new colour/size? Add a token here first, then use it — don't inline.
- **Per-tenant theming (future).** `organization_settings.theme` (jsonb) may override a whitelist of these semantic variables at runtime via an inline `<style>` on the shell — same names.
- **No Tailwind / no `cva` / no `tailwind-merge`** — these tokens + CSS Modules are the entire styling system.

---

*End of DESIGN_TOKENS.md — the canonical CSS-variable token set (colors, typography, spacing, radius, borders, shadows, z-index, breakpoints, + layout/motion). Paste the `:root` and `[data-theme='dark']` blocks into `app/globals.scss`; import the SCSS breakpoint map where media queries are needed.*
