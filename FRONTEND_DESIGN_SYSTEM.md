# Watcon SaaS — Frontend Design System

> **Status:** Styling specification (design spec — **no application code generated yet**)
> **Date:** 2026-05-29
> **Supersedes:** the Tailwind + shadcn/ui approach previously referenced in [ARCHITECTURE.md](ARCHITECTURE.md), [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md), [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).
> **Replaces it with:** **CSS Modules + SCSS Modules**, a **CSS-variable design-token system**, and an **in-house reusable UI library**.

The SCSS/CSS snippets below are the **specification** of the system (tokens, conventions, contracts). They are not the app implementation — the file-by-file rewrite is the deferred §13 migration checklist, to run when code generation is approved.

---

## 1. Principles

| Principle | What it means here |
|-----------|--------------------|
| **Japanese minimal (wabi-sabi)** | Ink-on-washi calm. Hairline (1px) borders over heavy shadows, generous whitespace, restraint. Noto Serif JP for headings, clean sans for body. Nothing decorative. |
| **Monochrome — black / white / gray** | A single neutral ramp is the entire palette. The "accent" is ink (near-black) inverted. Status colours (success/warn/danger/info) are **desaturated** and used sparingly — never bright. |
| **Enterprise SaaS** | Dense, legible, fast. 14px base, compact controls, data-table-first. Predictable, professional, no playful motion. AA contrast everywhere. |
| **Mobile responsive** | Mobile-first. Layouts reflow; data tables collapse to card stacks; touch targets ≥ 44px; sidebar becomes a drawer. |
| **Reusable UI system** | One in-house primitive library (`components/ui`) built on tokens. Features never hand-roll buttons/inputs/dialogs or hard-code colours/spacing. |

### Why we dropped Tailwind + shadcn/ui
- **Control & theming:** a CSS-variable token layer gives true runtime theming (light/dark, future per-tenant `organization_settings.theme`) without rebuilds, and keeps the monochrome system enforceable in one place.
- **No utility-class sprawl / no generated-component drift:** styles live in co-located `.module.scss`, scoped and reviewable; primitives are authored once, not copy-pasted per shadcn.
- **Smaller, explicit surface:** no `tailwind.config`, no `components.json`, no `cva`/`tailwind-merge`. The cost is we hand-build primitives (≈+1 day in Module 0) — acceptable for a long-lived enterprise app.

---

## 2. Styling architecture

```
CSS variables (design tokens)        ← single source of truth, themeable at runtime
        ▲
        │ consumed by
SCSS layer (styles/)                 ← tokens partial, mixins, functions, reset (compile-time helpers)
        ▲
        │ @use'd by
CSS Modules (*.module.scss)          ← every component/page styles itself, locally scoped
        ▲
        │ classNames via cx()
React components (.tsx)               ← no inline styles, no hard-coded values
```

- **Rendering model:** CSS Modules compile to static CSS at build (zero runtime CSS-in-JS). Next.js 15 supports `.module.scss` natively once `sass` is installed.
- **Two kinds of token:** **colours, spacing, type, radius, shadow, z, motion** are **CSS variables** (runtime-swappable for theming). **Breakpoints** are a **SCSS map** — media-query conditions can't use CSS variables, so they must be compile-time.
- **Global vs scoped:** the only global CSS is `app/globals.scss` (reset + `:root` token declarations + base element styles). Everything else is module-scoped.

---

## 3. Folder structure

```
styles/                       # global SCSS — the styling source of truth
├── _tokens.scss              # SCSS maps mirroring CSS vars (breakpoints, optional spacing map)
├── _functions.scss           # rem(), z(), token getters
├── _mixins.scss              # respond-to(), focus-ring(), visually-hidden(), truncate(), elevation()
├── _reset.scss               # modern CSS reset / normalize
├── _base.scss                # base element styles (html, body, headings, links, ::selection)
└── index.scss                # @forward of the above for a single @use entry

app/
└── globals.scss              # @use 'styles'; declares :root { --token: … } + [data-theme="dark"]

components/
├── ui/                       # reusable primitives — each: <Name>.tsx + <Name>.module.scss
│   ├── button/Button.tsx + Button.module.scss
│   ├── input/Input.tsx  + Input.module.scss
│   └── …                     # full inventory in §8
├── layout/                   # app-shell.tsx + app-shell.module.scss, sidebar, topbar
└── shared/                   # data-table, empty-state, … (+ .module.scss each)

features/<m>/components/<X>.tsx + <X>.module.scss   # feature UI styles co-located
```

- **Co-location rule:** a component's styles live next to it as `<Component>.module.scss`. No central "styles per page" dump.
- **`next.config.ts`:** set `sassOptions.includePaths = ['styles']` so modules can `@use 'index' as t;` (or `@use 'mixins' as *;`) without long relative paths.

---

## 4. Design tokens (the contract)

Declared once in `app/globals.scss` under `:root`. **Components reference only these variables** — never raw hex/px.

### 4.1 Colour — monochrome ramp + semantics
```scss
:root {
  /* Neutral ramp (sumi ink → washi paper) */
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
  --gray-950: #0a0a0a;   /* sumi ink — primary text & accent */

  /* Semantic (light theme) */
  --color-bg:            var(--gray-25);
  --color-surface:       var(--gray-0);
  --color-surface-2:     var(--gray-50);
  --color-border:        var(--gray-200);
  --color-border-strong: var(--gray-300);
  --color-text:          var(--gray-950);
  --color-text-muted:    var(--gray-600);
  --color-text-subtle:   var(--gray-500);
  --color-text-inverse:  var(--gray-0);

  /* Accent = ink (monochrome). Primary buttons are ink-filled. */
  --color-accent:          var(--gray-950);
  --color-accent-hover:    var(--gray-800);
  --color-accent-contrast: var(--gray-0);

  /* Status — desaturated, enterprise. Each has -fg (text/icon) and -bg (subtle fill). */
  --color-success-fg: #2f6b4a;  --color-success-bg: #eef4f0;
  --color-warning-fg: #8a6a2c;  --color-warning-bg: #f6f1e7;
  --color-danger-fg:  #9b3838;  --color-danger-bg:  #f7eded;
  --color-info-fg:    #36567a;  --color-info-bg:    #eef2f6;

  --color-focus: var(--gray-950);   /* focus ring colour */
}
```

### 4.2 Typography
```scss
:root {
  --font-display: 'Noto Serif JP', Georgia, 'Times New Roman', serif;
  --font-sans:    'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;

  /* Type scale (enterprise base = 14px). rem off a 16px root. */
  --fs-100: 0.6875rem;  /* 11 — micro/labels */
  --fs-200: 0.75rem;    /* 12 — caption */
  --fs-300: 0.8125rem;  /* 13 */
  --fs-400: 0.875rem;   /* 14 — BODY DEFAULT */
  --fs-500: 1rem;       /* 16 */
  --fs-600: 1.125rem;   /* 18 */
  --fs-700: 1.375rem;   /* 22 */
  --fs-800: 1.75rem;    /* 28 */
  --fs-900: 2.25rem;    /* 36 — display */

  --fw-regular: 400;  --fw-medium: 500;  --fw-semibold: 600;  --fw-bold: 700;
  --lh-tight: 1.2;  --lh-snug: 1.35;  --lh-normal: 1.5;  --lh-relaxed: 1.65;
  --tracking-tight: -0.01em;  --tracking-normal: 0;  --tracking-label: 0.04em;
}
```
- Headings use `--font-display` (Noto Serif JP) with `--tracking-tight`. Body/UI use `--font-sans`. Numeric/code use `--font-mono` (and `font-variant-numeric: tabular-nums` in tables).

### 4.3 Spacing (4px base, 8px rhythm)
```scss
:root {
  --space-0: 0;       --space-1: 0.25rem;  --space-2: 0.5rem;   --space-3: 0.75rem;
  --space-4: 1rem;    --space-5: 1.25rem;  --space-6: 1.5rem;   --space-8: 2rem;
  --space-10: 2.5rem; --space-12: 3rem;    --space-16: 4rem;    --space-20: 5rem;
}
```

### 4.4 Radius, border, shadow
```scss
:root {
  --radius-none: 0;  --radius-sm: 2px;  --radius-md: 4px;  --radius-lg: 8px;  --radius-full: 9999px;
  --border-width: 1px;
  --border: var(--border-width) solid var(--color-border);
  --border-strong: var(--border-width) solid var(--color-border-strong);
  /* Shadows are subtle and rare — minimalism prefers hairlines. */
  --shadow-sm: 0 1px 2px rgba(10,10,10,0.04);
  --shadow-md: 0 2px 8px rgba(10,10,10,0.06);
  --shadow-lg: 0 8px 24px rgba(10,10,10,0.08);
}
```

### 4.5 Z-index, motion, layout
```scss
:root {
  --z-base: 0; --z-dropdown: 1000; --z-sticky: 1100; --z-overlay: 1200;
  --z-modal: 1300; --z-popover: 1400; --z-toast: 1500; --z-tooltip: 1600;

  --dur-fast: 120ms; --dur-base: 180ms; --dur-slow: 240ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(0.3, 0, 0, 1);

  --container-max: 1280px;
  --sidebar-w: 248px;  --sidebar-w-collapsed: 64px;
  --topbar-h: 56px;
  --content-pad: var(--space-6);
}
@media (prefers-reduced-motion: reduce) {
  :root { --dur-fast: 0ms; --dur-base: 0ms; --dur-slow: 0ms; }
}
```

### 4.6 Breakpoints — SCSS map (compile-time, `styles/_tokens.scss`)
```scss
$breakpoints: (
  sm: 480px,
  md: 768px,
  lg: 1024px,
  xl: 1280px,
  xxl: 1536px,
);
```

---

## 5. Theming

- **Mechanism:** swap semantic variables under a `[data-theme]` attribute on `<html>`. Tokens cascade, so components need no theme logic.
```scss
[data-theme='dark'] {
  --color-bg:            var(--gray-950);
  --color-surface:       var(--gray-900);
  --color-surface-2:     var(--gray-800);
  --color-border:        var(--gray-800);
  --color-border-strong: var(--gray-700);
  --color-text:          var(--gray-25);
  --color-text-muted:    var(--gray-400);
  --color-accent:          var(--gray-25);
  --color-accent-contrast: var(--gray-950);
  --color-focus:           var(--gray-25);
}
```
- **Default:** light. **Dark:** ships in Module 0 (monochrome inverts cleanly).
- **Per-tenant overrides (future):** `organization_settings.theme` (jsonb) can override a small whitelist of variables at runtime via an inline `<style>` on the shell — same variable names.
- **Toggle:** `next-themes`-style provider sets `data-theme` + persists choice; respects `prefers-color-scheme` on first load.

---

## 6. SCSS layer

- **Single entry:** components do `@use 'index' as t;` (resolved via `includePaths`).
- **Maps stay in SCSS** (breakpoints); colours/spacing stay as **CSS vars** so theming works. Optionally a spacing map exists for math, but prefer `var(--space-N)`.

Representative mixins (`styles/_mixins.scss`):
```scss
@use 'tokens' as *;

@mixin respond-to($bp) {                      // mobile-first min-width
  @if map-has-key($breakpoints, $bp) {
    @media (min-width: map-get($breakpoints, $bp)) { @content; }
  } @else { @error "Unknown breakpoint #{$bp}"; }
}

@mixin focus-ring {                            // keyboard-only focus
  &:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
}

@mixin visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0;
  margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

@mixin truncate($lines: 1) {
  @if $lines == 1 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @else { display: -webkit-box; -webkit-line-clamp: $lines; -webkit-box-orient: vertical; overflow: hidden; }
}
```

---

## 7. CSS Modules conventions

1. **Filename:** `<Component>.module.scss`, co-located with `<Component>.tsx`.
2. **Class names:** `camelCase` (`.primaryButton`, `.isLoading`) — CSS Modules map them to typed names.
3. **State via `data-*`:** style interaction states with attribute selectors (`&[data-state='open']`, `&[data-disabled]`, `&[aria-invalid='true']`) rather than many boolean classes. Variants via a `data-variant`/`data-size` attribute the component sets from props.
4. **No `:global`** except the reset/base in `styles/`. Keep everything scoped.
5. **Compose, don't repeat:** use SCSS `@use` + mixins; `composes:` for shared local rules.
6. **`cx()` helper** (`lib/utils/cx.ts`) joins module class names conditionally — replaces the Tailwind-era `cn()` (drop `tailwind-merge`; `clsx` or a 5-line joiner is enough).
7. **No inline styles** and **no hard-coded colours/spacing/sizes** — values come from tokens. (Exception: dynamic, data-driven values like a progress width may use an inline CSS custom property, e.g. `style={{ '--value': pct }}`.)

Illustrative module (spec):
```scss
/* Button.module.scss */
@use 'mixins' as *;
.button {
  font: var(--fw-medium) var(--fs-400)/1 var(--font-sans);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  border: var(--border);
  background: var(--color-surface);
  color: var(--color-text);
  transition: background var(--dur-fast) var(--ease-standard);
  @include focus-ring;
  &[data-variant='primary'] { background: var(--color-accent); color: var(--color-accent-contrast); border-color: var(--color-accent); }
  &[data-variant='ghost']   { background: transparent; border-color: transparent; }
  &[data-size='sm'] { padding: var(--space-1) var(--space-3); font-size: var(--fs-300); }
  &[data-disabled='true'], &:disabled { opacity: 0.5; pointer-events: none; }
}
```

---

## 8. Reusable UI component inventory

The in-house primitives that **replace shadcn/ui**. Each is a `.tsx` + `.module.scss` consuming tokens, with full keyboard + ARIA support.

**Behaviour-layer decision (confirm):** overlay/interaction primitives (Dialog, Popover, Dropdown, Tooltip, Tabs, Select, Combobox, Switch, Checkbox) need correct focus-trap/dismiss/ARIA. Recommended: build them on **headless [Radix UI](https://www.radix-ui.com) primitives** (which are unstyled and have **no Tailwind dependency**) and style them entirely with our CSS Modules. This keeps accessibility correctness while satisfying "remove Tailwind + shadcn/ui" (shadcn = Radix **+ Tailwind**; we keep only the headless behaviour). Alternative: hand-roll with native elements + `@radix-ui`-free code (more effort, more a11y risk). **Static** primitives (Button, Input, Card, Badge, Table, etc.) are pure CSS Modules, no behaviour lib.

| Component | Kind | Behaviour layer | Tokens / notes |
|-----------|------|-----------------|----------------|
| Button, IconButton | static | — | variants primary/secondary/ghost/danger; sizes sm/md/lg via `data-*` |
| Input, Textarea, NumberInput, MoneyInput | static | — | `aria-invalid` styling; `MoneyInput` uses `--font-mono`, tabular nums |
| Label, FormField, HelperText, ErrorText | static | — | wires `htmlFor`/`aria-describedby`; integrates RHF errors |
| Select, Combobox | overlay | Radix Select / custom listbox | keyboard nav, typeahead |
| Checkbox, Radio, Switch | interactive | Radix | token-driven, focus-ring |
| Dialog/Modal, Drawer/Sheet | overlay | Radix Dialog | focus trap, `--z-modal`, scroll-lock, `prefers-reduced-motion` |
| Popover, DropdownMenu, ContextMenu | overlay | Radix | `--z-popover`/`--z-dropdown` |
| Tooltip | overlay | Radix Tooltip | `--z-tooltip`, delay |
| Tabs, Accordion | interactive | Radix | `data-state` styling |
| Toast | overlay | Radix Toast (or in-house queue) | `--z-toast`; driven by `useToast` |
| Table, DataTable | static | TanStack Table (headless) | sticky header, zebra optional-off (minimal), responsive→cards at `md` |
| Card, Panel, Surface | static | — | hairline border, optional `--shadow-sm` |
| Badge, Tag, StatusPill | static | — | uses status `-fg`/`-bg` pairs |
| Avatar, AvatarGroup | static | — | initials fallback |
| Skeleton, Spinner, ProgressBar | static | — | reduced-motion aware |
| Pagination, Breadcrumb, Separator | static | — | — |
| Alert, Callout, EmptyState | static | — | status colours, illustration slot |
| DatePicker, DateRangePicker | overlay | Radix Popover + calendar | report filters, challan/invoice dates |
| Command palette / SearchInput | overlay | headless combobox | global search |
| AppShell, Sidebar, Topbar, NavItem | layout | — | sidebar→drawer below `lg`; `--sidebar-w`, `--topbar-h` |
| PermissionGate | logic | — | renders children only if `has(key)` (PERMISSIONS) |
| ExportMenu | composite | DropdownMenu | Print / PDF / Email / WhatsApp / Copy |

Icons: **`lucide-react`** is retained (an icon set, independent of Tailwind/shadcn). Icons inherit `currentColor`, sized in `em`/token units, stroke-only for the minimal aesthetic.

---

## 9. Responsive strategy

- **Mobile-first:** base styles target small screens; widen with `@include respond-to(md/lg/...)`.
- **Breakpoints:** `sm 480 / md 768 / lg 1024 / xl 1280 / xxl 1536`.
- **Shell:** sidebar is a slide-over **Drawer below `lg`**, fixed rail at `lg+`. Topbar shows a hamburger below `lg`.
- **Data tables → cards:** below `md`, `DataTable` switches to stacked label/value cards (the most important enterprise-mobile pattern). Each table defines a card template.
- **Forms:** single column on mobile; multi-column grid (`grid-template-columns`) at `md+`.
- **Touch:** interactive targets ≥ 44×44px on touch (`@media (pointer: coarse)`).
- **Type:** the scale is fixed (enterprise legibility); only display headings step down a notch on mobile. Optional `clamp()` for hero numbers on dashboards.
- **Container queries (progressive):** card-heavy modules (dashboard widgets, quote line items) may use `@container` so a component adapts to its slot, not just the viewport.

---

## 10. Accessibility

- **Focus:** every interactive element uses the `focus-ring` mixin (`:focus-visible`, 2px ink outline + offset). Never remove outlines without a token-based replacement.
- **Contrast:** monochrome pairings meet WCAG **AA** (body text `--gray-950` on `--gray-25` ≈ 18:1; muted text ≥ 4.5:1). Status `-fg` on `-bg` verified AA.
- **Motion:** all transitions gated by `prefers-reduced-motion` (durations → 0).
- **Semantics:** native elements first (`<button>`, `<a>`, `<label>`, `<table>`); ARIA only to fill gaps. Overlays trap focus and restore it on close.
- **Forms:** every field has a `<label>`; errors use `aria-invalid` + `aria-describedby` wired by `FormField`.
- **Keyboard:** menus/dialogs/tabs/combobox fully operable; Esc closes overlays; arrow-key nav in lists.

---

## 11. Do / Don't

**Do**
- Reference tokens only (`var(--space-4)`, `var(--color-text)`).
- Put component styles in a co-located `.module.scss`; use `data-*` for state/variant.
- Build screens from `components/ui` primitives; extend via props, not new bespoke buttons.
- Use `respond-to()` (mobile-first) and the `focus-ring` mixin.

**Don't**
- ❌ Hard-code hex/px/rem colour or spacing values in a module.
- ❌ Inline `style={{…}}` for static styling (only for dynamic `--custom-prop` values).
- ❌ Reintroduce Tailwind utility classes, `cva`, `tailwind-merge`, or shadcn copy-paste components.
- ❌ Use `!important` (token specificity + scoping make it unnecessary).
- ❌ Put colours in media-query conditions or breakpoints in CSS vars.

---

## 12. Definition of Done (UI)

A screen/component is done when: styled **only** via CSS Modules + tokens (no inline/hard-coded values); responsive at `sm→xxl` (and table→card on mobile); keyboard + screen-reader accessible with visible focus; light **and** dark themes correct; empty/loading/error states present; built from `components/ui` primitives; reduced-motion respected. (Folds into the per-module DoD in [IMPLEMENTATION_PLAN.md §13](IMPLEMENTATION_PLAN.md).)

---

## 13. Migration checklist (deferred — run when code generation is approved)

The current scaffold still carries the Tailwind-era setup. When we resume coding, apply:

**Dependencies (`package.json`)**
- **Remove:** `tailwindcss`, `postcss`, `autoprefixer`, `tailwindcss-animate`, `class-variance-authority`, `tailwind-merge`.
- **Add:** `sass` (dev). Optional behaviour layer: `@radix-ui/react-*` primitives; `@tanstack/react-table` for DataTable; `next-themes` (or a small in-house theme provider).
- **Keep:** `clsx` (powers `cx()`), `lucide-react`.

**Files**
- Delete (none committed yet, but ensure absent): `tailwind.config.ts`, `postcss.config.*`, `components.json`.
- `app/globals.css` → **`app/globals.scss`**: replace the placeholder with `@use 'styles';`, the `:root` token block (§4), `[data-theme='dark']` (§5), and base/reset.
- Create `styles/` partials (§3): `_tokens`, `_functions`, `_mixins`, `_reset`, `_base`, `index.scss`.
- `lib/utils/cn.ts` → **`lib/utils/cx.ts`**: drop `tailwind-merge`; `export const cx = (...a) => clsx(a)`. Update imports.
- `next.config.ts`: add `sassOptions: { includePaths: ['styles'] }`.
- Update `app/layout.tsx`: import `globals.scss`; wrap in the theme provider; load fonts (`Noto Serif JP`, `Inter`) via `next/font`.
- Restyle the already-built auth/onboarding components (currently inline styles) to CSS Modules as the first consumers of the system.

**Build the base set (Module 0):** `styles/` tokens + the §8 static primitives (Button, Input, FormField, Card, Badge, Table, Spinner, EmptyState, Alert) + AppShell/Sidebar/Topbar + ThemeProvider + ToastProvider.

---

*End of FRONTEND_DESIGN_SYSTEM.md — styling specification. No application code was generated; §13 lists the deferred file changes. The four architecture docs now reference this system in place of Tailwind/shadcn.*
