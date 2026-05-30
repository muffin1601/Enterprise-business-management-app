# Watcon SaaS — UI Architecture

> **Status:** UI-layer architecture & component-system spec
> **Date:** 2026-05-29
> **Stack:** Next.js 15 (App Router, RSC) · React 19 · TypeScript (strict) · **CSS Modules + SCSS**
> **Builds on:** [FRONTEND_DESIGN_SYSTEM.md](FRONTEND_DESIGN_SYSTEM.md) (tokens, principles) — this document defines the **structure** and the **nine UI systems** that consume those tokens.
> **Aesthetic:** Japanese minimal · monochrome (black/white/gray) · enterprise SaaS · mobile-responsive.

Code blocks are **specification** (component APIs as TS interfaces, key SCSS patterns), not the final implementation.

---

## 0. Reconciliation with `ARCHITECTURE.md`

This document uses the **`src/`** convention you requested. It maps 1:1 onto the canonical (no-`src/`) layout in [ARCHITECTURE.md](ARCHITECTURE.md):

| This doc (`src/…`) | Canonical (`ARCHITECTURE.md`) | Role |
|--------------------|-------------------------------|------|
| `src/ui/` | `components/ui/` | Design-system **primitives** (Button, Input, Dialog…) |
| `src/components/` | `components/{shared,layout,providers}/` | **Composite** shared components (PageHeader, DataTable, ExportMenu…) |
| `src/layouts/` | `app/(group)/layout.tsx` + layout components | Page/shell **layouts** |
| `src/modules/` | `features/` | **Feature** vertical slices |
| `src/styles/` | `styles/` | Global SCSS (tokens, mixins, reset) |

> **Decision to confirm:** adopting a `src/` root is a supported Next.js convention but means moving `app/`, `lib/`, `validations/`, etc. under `src/` too. If you keep the current no-`src/` layout, read `src/ui` as `components/ui` and `src/modules` as `features` throughout. The system design below is identical either way.

---

## 1. Directory architecture

```
src/
├── app/                      # Next.js routes (thin) — pages compose layouts + modules
├── styles/                   # GLOBAL SCSS — single styling source of truth
│   ├── _tokens.scss          #   SCSS maps: $breakpoints, $z-layers (compile-time)
│   ├── _functions.scss       #   rem(), z(), bp()
│   ├── _mixins.scss          #   respond-to(), focus-ring(), truncate(), elevation(), grid helpers
│   ├── _reset.scss           #   modern reset
│   ├── _base.scss            #   html/body/heading/link base, ::selection
│   └── index.scss            #   @forward entry  (→ `@use 'index' as t;`)
│   # (globals.scss in app/ declares the :root CSS-variable tokens — FRONTEND_DESIGN_SYSTEM §4)
│
├── ui/                       # PRIMITIVES (atoms/molecules) — the reusable library
│   ├── typography/           #   Heading, Text, Display, Label, Code
│   ├── button/  input/  select/  checkbox/  radio/  switch/  textarea/
│   ├── form/                 #   Form, FormField, FormGrid, HelperText, ErrorText
│   ├── table/                #   DataTable, Column types, TableToolbar, Pagination
│   ├── modal/                #   Dialog, Drawer, ConfirmDialog, ModalProvider
│   ├── layout-primitives/    #   Box, Stack, Inline, Grid, Container, Spacer, Divider
│   ├── feedback/             #   Toast, Alert, Skeleton, Spinner, EmptyState, Badge
│   ├── overlay/              #   Popover, DropdownMenu, Tooltip
│   └── nav/                  #   NavItem, Tabs, Breadcrumbs, Pagination
│   #   each: <Name>.tsx + <Name>.module.scss (+ index.ts barrel)
│
├── components/               # COMPOSITES built from ui/ — shared across modules
│   ├── page-header/  data-table-toolbar/  export-menu/  permission-gate/
│   ├── widgets/              #   KpiStat, ChartWidget, ActivityFeed, WidgetGrid
│   └── providers/            #   ThemeProvider, QueryProvider, ToastProvider, SupabaseProvider
│
├── layouts/                  # SHELL & PAGE layouts
│   ├── app-shell/            #   AppShell = Sidebar + Topbar + content frame
│   ├── auth-layout/          #   centered minimal (login/forgot/reset)
│   ├── dashboard-layout/     #   widget grid scaffold
│   └── page-layout/          #   PageHeader + content + (optional) right rail
│
└── modules/                  # FEATURE slices (= features/) — module-specific UI
    ├── customers/  quotes/  items/  invoices/ …
    │   └── components/ + hooks/ + server/ + api/   (module UI imports ui/ + components/)
```

**Layering rule (UI):** `app → layouts → modules → components → ui → styles`. Lower layers never import higher ones. `ui/` may only import `styles/`. A module never re-implements a primitive; it composes `ui/` + `components/`.

**Convention recap (from FRONTEND_DESIGN_SYSTEM §7):** every component has a co-located `.module.scss`; `camelCase` classes; variants/state via `data-*`; **tokens only** (no hard-coded colour/px); `cx()` joins classes; no inline styles except dynamic `--custom-prop` values.

---

## 2. Typography system  (`src/ui/typography/`)

**Tokens:** `--font-display` (Noto Serif JP), `--font-sans` (Inter), `--font-mono`; scale `--fs-100…900`; weights; line-heights; tracking (FRONTEND_DESIGN_SYSTEM §4.2).

**Components (semantic, not size-named):**
```ts
// Heading renders h1–h6; `level` = semantics, `size` = visual (decoupled for a11y)
interface HeadingProps { level: 1|2|3|4|5|6; size?: 'sm'|'md'|'lg'|'xl'|'display'; children: ReactNode }
interface TextProps   { as?: 'p'|'span'|'div'; size?: 100|200|300|400|500|600;
                        weight?: 'regular'|'medium'|'semibold'; tone?: 'default'|'muted'|'subtle'|'inverse'|'danger';
                        truncate?: boolean | number /* line clamp */; mono?: boolean }
interface LabelProps  { htmlFor?: string; required?: boolean; size?: 200|300 }
```
- **Headings** use `--font-display` + `--tracking-tight`; map `level/size`: `display→--fs-900`, `xl→700`, `lg→600`, `md→500`, `sm→400`.
- **Body default** = `Text size=400` (14px) `--font-sans`. **Tone** maps to `--color-text{,-muted,-subtle,-inverse}` / `--color-danger-fg`.
- **Numbers/IDs/money** → `mono` (`font-variant-numeric: tabular-nums`) for column alignment.
- **Responsive:** display headings step down one notch below `md` (mixin); body scale is fixed for legibility.
- **A11y:** `level` drives the tag so heading order is correct regardless of visual `size`.

```scss
/* Heading.module.scss */
@use 'mixins' as *;
.heading { font-family: var(--font-display); letter-spacing: var(--tracking-tight); line-height: var(--lh-tight); color: var(--color-text); margin: 0; }
.heading[data-size='display'] { font-size: var(--fs-900); @include respond-to(md){ font-size: var(--fs-900); } }
.heading[data-size='xl']      { font-size: var(--fs-800); }
/* … md/sm via data-size … */
```

---

## 3. Color system  (consumed everywhere; defined in FRONTEND_DESIGN_SYSTEM §4.1/§5)

- **Single neutral ramp** `--gray-0…950` (washi → sumi). **No raw hex in components** — always semantic vars: `--color-bg / surface / surface-2 / border / border-strong / text / text-muted / text-subtle / accent / accent-contrast`.
- **Accent = ink** (monochrome): primary buttons are ink-filled, everything else hairline-bordered surfaces.
- **Status** (desaturated, sparse): `--color-{success,warning,danger,info}-{fg,bg}` pairs — used by `Badge`, `Alert`, `StatusPill`, form errors. Never for decoration.
- **Theming:** `[data-theme='dark']` remaps semantics; components are theme-agnostic. Per-tenant overrides via `organization_settings.theme`.
- **Contract:** if a value isn't a semantic token, it doesn't belong in a module. Status colours only via the pair variables.

---

## 4. Spacing system  (`src/ui/layout-primitives/`)

**Scale:** `--space-0…20` (4px base, 8px rhythm). Spacing is applied through **layout primitives**, not ad-hoc margins.

```ts
type Space = 0|1|2|3|4|5|6|8|10|12|16|20;          // maps to --space-N
interface BoxProps    { p?: Space; px?: Space; py?: Space; m?: Space; /* …t/r/b/l */ surface?: boolean; border?: boolean; radius?: 'sm'|'md'|'lg'; }
interface StackProps  { gap?: Space; align?: 'start'|'center'|'end'|'stretch'; }   // vertical flex
interface InlineProps { gap?: Space; align?: 'start'|'center'|'end'; wrap?: boolean; justify?: 'start'|'between'|'end'; } // horizontal flex
```
- `Stack`/`Inline` use `gap` (flexbox) — **no margin stacking**. `Box` exposes padding/surface/border/radius via props that resolve to tokens.
- **Rule:** prefer `gap` over margins; never type a raw px. Props set inline `--prop` custom properties consumed by the module class (the one allowed inline-style use).

```scss
.stack { display: flex; flex-direction: column; gap: var(--stack-gap, var(--space-4)); }
```

---

## 5. Grid system  (`src/ui/layout-primitives/Grid`, `Container`)

Responsive **12-column** CSS-grid, mobile-first.

```ts
interface ContainerProps { size?: 'sm'|'md'|'lg'|'full'; }    // max-width via --container-max
interface GridProps {
  cols?: number | Partial<Record<'base'|'sm'|'md'|'lg'|'xl', number>>; // responsive col counts
  gap?: Space; rowGap?: Space; colGap?: Space;
}
interface ColProps { span?: number | Partial<Record<Breakpoint, number>>; start?: number; }
```
- `Grid cols={{ base: 1, md: 2, xl: 3 }}` → `grid-template-columns: repeat(N, 1fr)` switched per breakpoint via `respond-to`.
- **Auto-fit** mode for card walls: `Grid minItem="240px"` → `repeat(auto-fill, minmax(240px, 1fr))`.
- `Container` centres content at `--container-max` (1280) with `--content-pad` gutters that shrink on mobile.
- **Forms/widgets** use Grid for column layouts; below `md` everything collapses to 1 column.

```scss
.grid { display: grid; gap: var(--grid-gap, var(--space-4)); grid-template-columns: repeat(var(--cols-base,1), 1fr); }
@include respond-to(md){ .grid { grid-template-columns: repeat(var(--cols-md, var(--cols-base)), 1fr); } }
```

---

## 6. Form system  (`src/ui/form/`, `src/ui/input|select|checkbox…`)

Built for **React Hook Form + Zod** (validation schemas in `validations/`, FRONTEND_DESIGN_SYSTEM + API_DESIGN §2.2). One schema → RHF resolver + server action.

```ts
interface FormFieldProps { name: string; label?: string; required?: boolean; hint?: string; children: ReactElement; }
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { invalid?: boolean; size?: 'sm'|'md'; prefix?: ReactNode; suffix?: ReactNode; }
interface FormGridProps { columns?: 1|2|3; gap?: Space; }   // responsive: collapses to 1 below md
```
- **`FormField`** wires `<label htmlFor>`, `aria-describedby` (hint + error), `aria-invalid`, and renders `ErrorText` from RHF `formState.errors[name]`. Field components are otherwise dumb/controlled.
- **Controls:** `Input`, `Textarea`, `NumberInput`, `MoneyInput` (mono, ₹ prefix), `Select`/`Combobox`, `Checkbox`, `Radio`, `Switch`, `DatePicker` — all token-styled, `focus-ring`, invalid state via `[aria-invalid='true']`.
- **Layout:** `FormGrid columns={2}` for desktop two-column forms → 1 column on mobile; full-width fields opt out with `Col span`.
- **States:** default / focus / invalid / disabled / readonly — all token-driven; error text uses `--color-danger-fg`.
- **Submit:** disabled while `isSubmitting`; server `ActionErr.fieldErrors` map onto `setError` (already used by the built auth forms).
- **A11y:** every control labelled; errors announced via `role="alert"`; required marked both visually and with `aria-required`.

```scss
.input { font: var(--fw-regular) var(--fs-400)/1.4 var(--font-sans); padding: var(--space-2) var(--space-3);
  background: var(--color-surface); color: var(--color-text); border: var(--border); border-radius: var(--radius-md); width: 100%;
  @include focus-ring; &[aria-invalid='true']{ border-color: var(--color-danger-fg); } &:disabled{ opacity:.5; } }
```

---

## 7. Table system  (`src/ui/table/`)

Headless **TanStack Table** + our styling. Enterprise data-grid baseline.

```ts
interface DataTableProps<T> {
  data: T[]; columns: ColumnDef<T>[];           // TanStack column defs
  loading?: boolean; empty?: ReactNode;          // EmptyState fallback
  density?: 'comfortable'|'compact';             // row height via tokens
  sort?: SortingState; onSortChange?: (s: SortingState) => void;
  pagination?: { mode: 'cursor'|'offset'; … };   // mirrors API_DESIGN §2.4
  selection?: { selected: string[]; onChange: (ids: string[]) => void };
  responsive?: 'scroll'|'cards';                 // mobile behavior (default 'cards')
  rowHref?: (row: T) => string;                  // clickable rows
}
```
- **Structure:** `TableToolbar` (search, filters, density toggle, `ExportMenu`) → scrollable table → `Pagination`.
- **Header:** sticky; sortable columns show direction; `tabular-nums` for numeric columns; column min/max widths via tokens.
- **Density:** `comfortable` (40px) / `compact` (32px) rows.
- **States:** `loading` → Skeleton rows; `empty` → `EmptyState`; error handled by the caller.
- **Responsive (`cards`):** below `md`, each row renders as a stacked **label/value card** (the key enterprise-mobile pattern) using a per-column `header`+`cell`. `scroll` mode keeps a horizontally-scrollable grid for wide financial tables.
- **A11y:** real `<table>` semantics, `scope` on headers, sortable headers are buttons with `aria-sort`, row selection via checkboxes with labels.

```scss
.table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--fs-300); }
.th { position: sticky; top: 0; background: var(--color-surface-2); border-bottom: var(--border-strong);
  text-align: left; font-weight: var(--fw-semibold); letter-spacing: var(--tracking-label); }
.td { border-bottom: var(--border); padding: var(--row-pad, var(--space-3)); }
@include respond-to-max(md){ /* card mode rules */ }
```

---

## 8. Modal system  (`src/ui/modal/`)

Headless **Radix Dialog** behaviour + token styling. One imperative + declarative API.

```ts
interface DialogProps { open: boolean; onOpenChange:(o:boolean)=>void; size?:'sm'|'md'|'lg'|'xl'|'full';
                        title: string; description?: string; children: ReactNode; footer?: ReactNode; dismissable?: boolean; }
interface DrawerProps extends Omit<DialogProps,'size'> { side?: 'right'|'left'|'bottom'; size?: 'sm'|'md'|'lg'; }
// Imperative confirm (promise-based) for destructive actions:
const ok = await confirm({ title:'Delete customer?', tone:'danger', confirmText:'Delete' });
```
- **Composition:** `Dialog.Header` (title + close) / `Dialog.Body` (scrolls) / `Dialog.Footer` (actions, right-aligned). `Drawer` for side panels (filters, record detail, quote builder on mobile).
- **Behaviour:** focus trap + restore, `Esc`/overlay dismiss (toggle with `dismissable`), body scroll-lock, `--z-modal`/overlay layering, `prefers-reduced-motion` fade.
- **`ModalProvider`** + `useModal()` / `confirm()` for imperative flows (delete confirmations, "create on the fly" customer in quote builder).
- **Sizes** map to max-width tokens; `full` for the quote/invoice builders on mobile.
- **A11y:** `role="dialog"` `aria-modal`, `aria-labelledby`/`aria-describedby` wired from `title`/`description`; initial focus to the first field or the dialog.

```scss
.overlay { position: fixed; inset: 0; background: rgba(10,10,10,.4); z-index: var(--z-overlay); }
.content { position: fixed; z-index: var(--z-modal); background: var(--color-surface); border: var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); width: min(var(--dialog-w, 480px), calc(100vw - var(--space-8))); }
```

---

## 9. Dashboard widgets  (`src/components/widgets/`, `src/layouts/dashboard-layout/`)

Composable, surface-based widgets on a responsive grid. Consume `v_*` reads (REPORTING) via TanStack Query.

```ts
interface WidgetProps { title: string; action?: ReactNode; loading?: boolean; error?: ReactNode; span?: ColProps['span']; }
interface KpiStatProps { label: string; value: string|number; delta?: { value: number; direction: 'up'|'down' }; format?: 'number'|'currency'|'percent'; }
interface ChartWidgetProps extends WidgetProps { type:'line'|'bar'|'area'; data: …; }
interface ActivityFeedProps { items: ActivityItem[]; }
```
- **`Widget`** = a `Card` surface (hairline border, optional `--shadow-sm`) with header (title + optional action) and body; built-in `loading` (Skeleton) and `error` (Alert) states.
- **`KpiStat`** — big `mono` value, label in `--tracking-label` caps, monochrome delta (▲/▼ as glyph + `--color-success-fg`/`--color-danger-fg`, used minimally). Maps to dashboard quick-stats (quote value, outstanding receivables, pending quotes, catalogue count).
- **`WidgetGrid`** — `Grid cols={{ base:1, md:2, xl:4 }}` of KPI tiles + larger spans for charts/feeds.
- **`ChartWidget`** — charts rendered monochrome (ink + gray fills, hairline gridlines) via a headless chart lib; respects reduced-motion.
- **`ActivityFeed`** — timeline list with relative timestamps.
- **Responsive:** 4-up KPIs → 2-up at `md` → 1-up on mobile; charts go full-width on small screens.

---

## 10. Navigation system  (`src/layouts/app-shell/`, `src/ui/nav/`)

```ts
interface NavItem { label: string; href: Route; icon: LucideIcon; permission?: string; badge?: number; children?: NavItem[]; }
interface SidebarProps { sections: { heading?: string; items: NavItem[] }[]; collapsed?: boolean; }
```
- **`AppShell`** = fixed `Sidebar` (rail) + sticky `Topbar` + scrollable content (`--sidebar-w`, `--topbar-h`).
- **`Sidebar`:** grouped sections (Sales, Inventory, Finance, HR, Administration); items are **permission-gated** — an item renders only if `usePermissions().has(item.permission)` (PERMISSIONS keys). Collapsible to an icon rail (`--sidebar-w-collapsed`); active route highlighted (ink left-border + `--color-surface-2`).
- **`Topbar`:** `OrgSwitcher` (multi-company `memberships`), global `SearchInput` (command palette), `NotificationBell` (Realtime), `UserMenu` (profile, theme toggle, sign out).
- **`Breadcrumbs`** under the topbar on deep pages; `Tabs` for in-page section nav.
- **Mobile:** below `lg` the Sidebar becomes a slide-over `Drawer` toggled by a hamburger in the Topbar; bottom-safe-area aware. Touch targets ≥ 44px.
- **A11y:** `<nav aria-label>`, current item `aria-current="page"`, keyboard-traversable; skip-to-content link; drawer traps focus.

```scss
.shell { display: grid; grid-template-columns: var(--sidebar-w) 1fr; grid-template-rows: var(--topbar-h) 1fr; min-height: 100dvh; }
@include respond-to-max(lg){ .shell { grid-template-columns: 1fr; } .sidebar { position: fixed; transform: translateX(-100%); } }
.navItem[aria-current='page'] { background: var(--color-surface-2); box-shadow: inset 2px 0 0 var(--color-accent); }
```

---

## 11. Conventions & Definition of Done (UI)

- **Build order:** `styles/` tokens → `ui/` primitives → `components/` composites + `layouts/` → `modules/` consume them. Never skip a layer.
- **Every component:** co-located `.module.scss`; tokens only; `data-*` variants/state; `cx()`; typed props; light+dark correct; responsive `sm→xxl` (table→cards on mobile); keyboard + SR accessible with visible focus; empty/loading/error states; reduced-motion respected.
- **No** Tailwind, `cva`, `tailwind-merge`, shadcn copy-paste, inline static styles, `!important`, or raw hex/px.
- **Icons:** `lucide-react`, `currentColor`, stroke-only.
- Folds into the per-module DoD in [IMPLEMENTATION_PLAN.md §13](IMPLEMENTATION_PLAN.md) and the styling DoD in [FRONTEND_DESIGN_SYSTEM.md §12](FRONTEND_DESIGN_SYSTEM.md).

---

*End of UI_ARCHITECTURE.md — UI-layer structure (`src/{ui,components,layouts,modules,styles}`) + nine systems (typography, color, spacing, grid, form, table, modal, dashboard widgets, navigation), all on the monochrome token foundation. `modules/ ≡ features/`, `ui/ ≡ components/ui` per §0.*
