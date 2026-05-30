# Watcon Design System — Final Production Specification

**Version:** 1.0 · **Date:** 2026-05-30 · **Stack:** Next.js 15 · SCSS Modules · CSS Variables

---

## 0. Design Philosophy

Watcon serves construction, inventory, and trading professionals — people who read dense data all day. The design language borrows from Japanese stationery and architectural drafting: **ink on washi paper**. Every decision prioritises legibility, information density, and operational efficiency over decoration.

**Three principles:**
1. **Silence is structure.** Whitespace is the grid. No background fills, gradients, or decorative elements.
2. **Typography is hierarchy.** Noto Serif JP headings anchor the brand; Inter body text carries information.
3. **Action is clear, rest is quiet.** Interactive elements announce themselves only when needed.

---

## 1. Global Design Language

### 1.1 Color System

All colors are CSS custom properties. The neutral ramp runs from washi-paper white (`#fafaf8`) to sumi ink black (`#0a0a0a`). No hue-based brand color — the brand is the typography and the craft.

```scss
// ── Neutral ramp (washi → sumi) ────────────────────────────────────────
--gray-0:   #ffffff;
--gray-25:  #fafaf8;   // page background (warm white)
--gray-50:  #f5f5f3;   // surface-2, input backgrounds
--gray-100: #ececea;   // dividers, subtle fills
--gray-200: #dcdcd9;   // default border
--gray-300: #c4c4c0;   // strong border, placeholder
--gray-400: #a3a3a0;   // disabled text
--gray-500: #808080;   // subtle text
--gray-600: #5f5f5d;   // muted text
--gray-700: #444443;   // secondary labels
--gray-800: #2a2a29;   // hover on primary
--gray-900: #161615;   // near-black
--gray-950: #0a0a0a;   // sumi ink — primary text + action

// ── Semantic surfaces ───────────────────────────────────────────────────
--color-bg:            var(--gray-25);   // page canvas
--color-surface:       var(--gray-0);    // card, panel, modal
--color-surface-2:     var(--gray-50);   // input bg, table row hover
--color-border:        var(--gray-200);  // default 1px border
--color-border-strong: var(--gray-300);  // active / focused border

// ── Semantic text ───────────────────────────────────────────────────────
--color-text:          var(--gray-950);  // body copy
--color-text-muted:    var(--gray-600);  // labels, captions
--color-text-subtle:   var(--gray-500);  // placeholders, empty states
--color-text-inverse:  var(--gray-0);    // text on dark fills

// ── Primary action (monochrome ink) ────────────────────────────────────
--color-primary:       var(--gray-950);
--color-primary-hover: var(--gray-800);
--color-on-primary:    var(--gray-0);

// ── Status pairs (fg + bg) — desaturated for professionalism ───────────
--color-success-fg: #2f6b4a;   --color-success-bg: #eef4f0;
--color-warning-fg: #8a6a2c;   --color-warning-bg: #f6f1e7;
--color-danger-fg:  #9b3838;   --color-danger-bg:  #f7eded;
--color-info-fg:    #36567a;   --color-info-bg:    #eef2f6;
```

### 1.2 Dark Theme

Semantic tokens flip; the neutral ramp and all non-color tokens stay constant. Apply `data-theme="dark"` to `<html>`.

```scss
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

  --color-success-fg: #6fae87;  --color-success-bg: #16241c;
  --color-warning-fg: #c9a44e;  --color-warning-bg: #2a2417;
  --color-danger-fg:  #cf7373;  --color-danger-bg:  #2a1717;
  --color-info-fg:    #7aa0c5;  --color-info-bg:    #161f29;
}
```

### 1.3 Typography

Three fonts, three roles. Never swap them.

| Role | Font | CSS Variable | Use |
|---|---|---|---|
| Display | Noto Serif JP | `--font-display` | H1–H2, KPI values, brand name |
| Body | Inter | `--font-sans` | All UI copy, labels, inputs |
| Mono | JetBrains Mono | `--font-mono` | Numbers in tables, amounts, codes |

**Type scale** — 11 steps from `--fs-100` (11px) to `--fs-900` (36px):

```
--fs-100: 0.6875rem   // 11px — micro labels, legal text
--fs-200: 0.75rem     // 12px — table headers, captions, badges
--fs-300: 0.8125rem   // 13px — table body, form help text
--fs-400: 0.875rem    // 14px — base body (default)
--fs-500: 1rem        // 16px — card titles, section headings
--fs-600: 1.125rem    // 18px — page sub-headings
--fs-700: 1.375rem    // 22px — page titles, KPI values (secondary)
--fs-800: 1.75rem     // 28px — dashboard KPI values
--fs-900: 2.25rem     // 36px — hero KPI values
```

**Letter-spacing conventions:**
- Body copy: `--tracking-normal` (0)
- Labels / table headers: `--tracking-label` (0.04em)
- Brand name / module headings: 0.15em–0.20em (set directly)
- Micro badges: 0.20em–0.35em (set directly)

**Text-transform:** `uppercase` is reserved for: table column headers, sidebar nav items, section labels, filter tabs, badges. Never use uppercase for body copy or input values.

### 1.4 Spacing

4px base, 8px rhythm. Use only these tokens — no arbitrary pixel values in component code.

```
--space-0:  0
--space-1:  0.25rem   // 4px
--space-2:  0.5rem    // 8px
--space-3:  0.75rem   // 12px
--space-4:  1rem      // 16px
--space-5:  1.25rem   // 20px
--space-6:  1.5rem    // 24px
--space-8:  2rem      // 32px
--space-10: 2.5rem    // 40px
--space-12: 3rem      // 48px
--space-16: 4rem      // 64px
--space-20: 5rem      // 80px
```

### 1.5 Border Radius

Extremely conservative. Watcon is a business tool, not a consumer app.

```
--radius-none: 0       // tables, panels, sidebar
--radius-sm:   2px     // badges, tags, chips
--radius-md:   4px     // buttons, inputs, cards
--radius-lg:   8px     // modals, dropdowns
--radius-full: 9999px  // avatar circles, pill badges
```

### 1.6 Borders

```
--border-width:      1px
--border:            1px solid var(--color-border)
--border-strong:     1px solid var(--color-border-strong)
--border-focus:      2px solid var(--color-focus)
```

### 1.7 Shadows

Minimal. Shadows indicate elevation, not decoration. Use the lowest effective level.

```
--shadow-none: none
--shadow-sm:   0 1px 2px rgba(10,10,10,0.04)    // input focus, card
--shadow-md:   0 2px 8px rgba(10,10,10,0.06)    // dropdown, popover
--shadow-lg:   0 8px 24px rgba(10,10,10,0.08)   // modal
```

### 1.8 Motion

Fast and purposeful. No ornamental animations.

```
--dur-fast: 120ms    // micro: hover fills, icon swaps
--dur-base: 180ms    // default: sidebar collapse, modal in
--dur-slow: 240ms    // skeleton shimmer, chart enter
--ease-standard:   cubic-bezier(0.2, 0, 0, 1)
--ease-emphasized: cubic-bezier(0.3, 0, 0, 1)
```

Respect `prefers-reduced-motion` — all durations collapse to 0ms.

### 1.9 Z-Index Stack

```
--z-base:     0
--z-dropdown: 1000
--z-sticky:   1100
--z-overlay:  1200
--z-modal:    1300
--z-popover:  1400
--z-toast:    1500
--z-tooltip:  1600
```

### 1.10 Layout Constants

```
--container-max:      1280px
--sidebar-w:          248px     // expanded sidebar
--sidebar-w-collapsed: 64px     // icon-only collapsed
--topbar-h:           56px
--content-pad:        var(--space-6)   // 24px page padding
```

### 1.11 Breakpoints (SCSS compile-time)

```scss
$breakpoints: (
  sm:  480px,
  md:  768px,
  lg:  1024px,
  xl:  1280px,
  xxl: 1536px,
);
```

---

## 2. Sidebar Design

### 2.1 Anatomy

The sidebar is a full-height fixed panel. It contains:
1. **Brand lock-up** — Noto Serif JP logotype + organization name
2. **Navigation sections** — grouped by business domain
3. **User footer** — avatar, name, settings link

### 2.2 Visual Spec

| Property | Value |
|---|---|
| Width (expanded) | `248px` |
| Width (collapsed) | `64px` |
| Background | `var(--gray-950)` (sumi ink) |
| Text color (default) | `rgba(255,255,255,0.45)` |
| Text color (hover) | `rgba(255,255,255,0.80)` |
| Text color (active) | `var(--gray-0)` |
| Active left border | `2px solid var(--gray-0)` |
| Active background | `rgba(255,255,255,0.07)` |
| Hover background | `rgba(255,255,255,0.04)` |
| Section label | `rgba(255,255,255,0.25)`, 7px, 0.50em tracking, uppercase |
| Dividers | `rgba(255,255,255,0.08)` |
| Brand name font | Noto Serif JP, 300 weight, 18px, 0.20em tracking |

### 2.3 Navigation Groups & Items

```
OPERATIONS
  Dashboard
  Customers
  Items
  Inventory

COMMERCE
  Quotes
  Sales Orders
  Purchase Orders

FINANCE
  Invoices
  Reports

ORGANIZATION
  HR
  Settings
```

### 2.4 Nav Item Spec

- Height: 40px
- Padding: `10px 20px`
- Icon: 17px Tabler icon, left-aligned
- Label: 11px, `letter-spacing: 0.20em`, uppercase
- Active state: left `2px solid` white border + `rgba(255,255,255,0.07)` fill
- Transition: `color 120ms, background 120ms`
- Collapsed state: icon only, label hidden, tooltip on hover

### 2.5 Collapse Behavior

Sidebar toggles via a hamburger icon in the topbar. On collapse:
- Width animates `248px → 64px` over `180ms`
- Labels fade out (`opacity: 0`) at `60ms`
- Icons center within the 64px column
- Section labels hide entirely
- Body margin-left animates to match

### 2.6 Mobile Behavior

Below `768px`: sidebar becomes an off-canvas drawer, opening via overlay. The `main` content fills full width. Overlay: `rgba(10,10,10,0.40)`, tap to dismiss.

---

## 3. Header (Topbar) Design

### 3.1 Anatomy

Sticky at top of main content area. Contains:
1. **Module title** — Noto Serif JP, 300 weight, 16px, 0.15em tracking
2. **Breadcrumb** (optional) — when navigated > 1 level deep
3. **Global search** (optional, per-module)
4. **Notification bell** — badge for pending items
5. **User avatar** — opens profile dropdown

### 3.2 Visual Spec

| Property | Value |
|---|---|
| Height | `56px` |
| Background | `var(--color-surface)` |
| Border-bottom | `var(--border)` |
| Padding | `0 var(--space-6)` |
| Position | `sticky; top: 0; z-index: var(--z-sticky)` |
| Module title font | Noto Serif JP, 300 weight |
| Breadcrumb separator | `/` in `--color-text-muted` |
| Breadcrumb font-size | `--fs-300` |

### 3.3 Page-Level Header (within content)

For pages with a list/detail split, the page header lives inside the content area:

```
[Back link]
[Page Title]         [Primary Action Button]
[Subtitle / count]   [Secondary Actions]
[Filter row]
```

Page title: `--font-display`, `--fs-700`, `--fw-regular` (300 weight).
Section inside a form: `--font-sans`, `--fs-500`, `--fw-semibold`.

---

## 4. Dashboard Widgets

### 4.1 Layout Grid

12-column grid on desktop, single column on mobile. Grid gap: `--space-5`.

Standard widget spans:
- KPI cards row: 3 columns each (4 cards = full width)
- Revenue chart: 8 columns
- Activity feed: 4 columns
- Quick actions: 6 columns each

### 4.2 KPI Card

```
┌─────────────────────────────┐
│  LABEL (8px uppercase)      │
│  VALUE (Noto Serif, 28px)   │
│  ▲ 12% vs last month        │
└─────────────────────────────┘
```

| Element | Spec |
|---|---|
| Container | `var(--color-surface)`, `var(--border)`, `--radius-md`, `padding: var(--space-5)` |
| Label | `--fs-200`, uppercase, `--tracking-label`, `--color-text-muted` |
| Value | `--font-display`, `--fs-800`, `--fw-regular` |
| Delta (positive) | `--color-success-fg`, `--fs-200` |
| Delta (negative) | `--color-danger-fg`, `--fs-200` |
| Hover | `border-color: var(--color-border-strong)` |

### 4.3 Chart Widget

```
┌─────────────────────────────────────────┐
│  Widget Title               View All →  │
│  ─────────────────────────────────────  │
│  [Recharts ResponsiveContainer]         │
│  height: 220px                          │
└─────────────────────────────────────────┘
```

Chart colors: Use only `--color-text` (bars/lines), `--color-border` (grid lines), `--color-text-muted` (axis labels). No rainbow palettes.

### 4.4 Activity Feed Widget

Row-based list inside a card. Each row:
- Left: entity name (`--fw-medium`) + meta line (`--fs-200`, `--color-text-muted`)
- Right: relative time (`--fs-200`, `--color-text-muted`)
- Row separator: `var(--border)` (not full-width card border)

### 4.5 Quick Actions Widget

2×2 grid of action tiles. Each tile:
- Icon (24px Tabler, `--color-text-muted`)
- Title (`--fw-medium`, `--fs-400`)
- Description (`--fs-200`, `--color-text-muted`)
- Border: `var(--border)`; hover: `var(--border-strong)` + `--color-surface-2` fill

---

## 5. Data Tables

### 5.1 Anatomy

```
[Filter bar: search + selects + filter tabs]
[Table]
  [TH row: uppercase labels]
  [TR rows: data]
[Pagination row]
```

### 5.2 Table Spec

| Element | Spec |
|---|---|
| Container | `overflow-x: auto` (horizontal scroll on small screens) |
| Table | `width: 100%`, `border-collapse: collapse` |
| TH | `--fs-200`, uppercase, `--tracking-label`, `--color-text-muted`, `--fw-medium`, `padding: var(--space-2) var(--space-3)`, `border-bottom: var(--border)` |
| TD | `padding: var(--space-3)`, `border-bottom: var(--border)`, `vertical-align: middle` |
| Row hover | `background: var(--color-surface-2)` |
| Number cells | `text-align: right`, `font-family: var(--font-mono)`, `--fs-300`, no-wrap |
| Primary link cell | `--color-text`, `--fw-medium`; hover: underline |
| Empty state row | centered, `--color-text-subtle`, `padding: var(--space-8) 0` |

### 5.3 Column Alignment Rules

- Text columns: left-aligned
- Amount / quantity columns: right-aligned, monospace
- Status badge columns: left-aligned
- Action columns: right-aligned, icon buttons

### 5.4 Status Badges in Tables

```scss
// Generic badge shell
.badge {
  display: inline-block;
  font-size: var(--fs-200);
  letter-spacing: 0.20em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: var(--fw-medium);
}
```

Status color map:

| Status | Background | Foreground |
|---|---|---|
| Draft | `--gray-100` | `--gray-700` |
| Pending | `--color-warning-bg` | `--color-warning-fg` |
| Active / Accepted | `--color-success-bg` | `--color-success-fg` |
| Sent / In Progress | `--color-info-bg` | `--color-info-fg` |
| Revised | `--color-warning-bg` | `--color-warning-fg` |
| Cancelled / Rejected | `--color-danger-bg` | `--color-danger-fg` |
| Paid | `--color-success-bg` | `--color-success-fg` |
| Overdue | `--color-danger-bg` | `--color-danger-fg` |

### 5.5 Filter Bar

```
[Search input (flex: 1)]  [Select ×N]  [Filter Tabs]  [+ New Button]
```

Filter tabs: bordered box (`border: var(--border)`), tabs are borderless inside. Active tab: `background: var(--color-primary)`, `color: var(--color-on-primary)`.

### 5.6 Pagination

```
Showing 1–25 of 148 items        [← Prev]  [1] [2] [3]  [Next →]
```

Page info: `--fs-300`, `--color-text-muted`. Page buttons: ghost style, active: primary.

---

## 6. Forms

### 6.1 Layout Principles

- Single-column layout on mobile (`< 768px`)
- Two-column grid on desktop for peer fields (e.g., First Name + Last Name)
- Full-width for textarea, address, and note fields
- Card/panel grouping for logical sections

### 6.2 Form Section Pattern

```
┌─ Section Title (--fs-500, --fw-semibold) ──────────────────┐
│  [Field] [Field]                                            │
│  [Field] [Field]                                            │
│  [Full-width field]                                         │
└────────────────────────────────────────────────────────────┘
```

### 6.3 Field Anatomy

```
Label (--fs-200, uppercase, 0.035em tracking)
[Input or Select]
Help text / Error message (--fs-200)
```

### 6.4 Input Spec

| State | Border | Background |
|---|---|---|
| Default | `var(--border)` | `var(--color-surface)` |
| Focus | `2px solid var(--color-focus)` | `var(--color-surface)` |
| Error | `1px solid var(--color-danger-fg)` | `var(--color-danger-bg)` |
| Disabled | `var(--border)`, opacity 0.5 | `var(--color-surface-2)` |

Input padding: `var(--space-2) var(--space-3)`. Font: `--font-sans`, `--fs-400`. Height: 36px (sm), 40px (default). Border-radius: `--radius-md`.

**Underline variant** (used in dense table-edit inline fields): `border: none; border-bottom: 1px solid var(--color-border)`. Focus: `border-bottom-color: var(--color-focus)`.

### 6.5 Select / Dropdown

Same dimensions and states as Input. Append a chevron icon (`16px`) on the right. On focus, border transitions to focus ring.

### 6.6 Textarea

Min-height: 80px. Resize: vertical only. Padding: `var(--space-3)`.

### 6.7 Label Spec

```scss
.label {
  display: block;
  font-size: var(--fs-200);
  font-weight: var(--fw-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-label);
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
}
```

Required fields: append `*` in `--color-danger-fg` after the label text.

### 6.8 Error Message

```scss
.error {
  font-size: var(--fs-200);
  color: var(--color-danger-fg);
  margin-top: var(--space-1);
}
```

### 6.9 Form Actions

Always at the bottom of the form, left-aligned:
```
[Primary: Save / Submit]  [Ghost: Cancel]
```

Destructive actions (delete): danger variant, right-aligned or separated with spacer.

### 6.10 Inline Costing Trail (Items module)

```
Base price         ¥ 1,000
After discount     ¥   950
+ Transport        ¥    47
───────────────────────────
Cost price         ¥   997
Selling price      ¥ 1,197
```

Each row: flex, space-between. Label: `--color-text-muted`. Value: `--font-mono`, right-aligned. Total row: `--fw-semibold`, `border-top: var(--border)`.

---

## 7. Modals

### 7.1 Anatomy

```
[Overlay: rgba(10,10,10,0.45)]
  ┌─────────────── Modal ───────────────────┐
  │ Title (Noto Serif JP, 300, 18px)   [✕] │
  │ ─────────────────────────────────────── │
  │                                         │
  │  [Content area: form / confirm / info]  │
  │                                         │
  │ ─────────────────────────────────────── │
  │               [Cancel]  [Primary CTA]   │
  └─────────────────────────────────────────┘
```

### 7.2 Modal Size Variants

| Variant | Width | Use |
|---|---|---|
| `sm` | 400px | Confirmations, single-field |
| `md` | 560px | Standard forms (default) |
| `lg` | 760px | Multi-section forms, quote builder |
| `xl` | 960px | Full data panels, line-item tables |
| `fullscreen` | 100vw–64px | Complex builders (e.g., quote editor on mobile) |

Max-height: `88vh`. Overflow: `auto` on content area.

### 7.3 Visual Spec

| Property | Value |
|---|---|
| Background | `var(--color-surface)` |
| Border | `var(--border)` |
| Border-radius | `var(--radius-lg)` |
| Shadow | `var(--shadow-lg)` |
| Header padding | `var(--space-5) var(--space-6)` |
| Content padding | `var(--space-5) var(--space-6)` |
| Footer padding | `var(--space-4) var(--space-6)` |
| Footer border-top | `var(--border)` |
| Z-index | `var(--z-modal)` |

### 7.4 Open / Close Animation

```scss
// Overlay: fade in/out
opacity: 0 → 1, duration: --dur-base, ease-standard

// Modal panel: translate + fade
transform: translateY(8px) → translateY(0)
opacity: 0 → 1, duration: --dur-base, ease-emphasized
```

### 7.5 Confirmation Dialog (Destructive)

Title: "Confirm deletion" — Noto Serif, 300.
Body: concise statement of what will be destroyed.
CTA: `[Cancel]` (ghost) `[Delete — Danger variant]`.
Never use red background on the entire modal — only the button.

---

## 8. Reports

### 8.1 Report Page Layout

```
[Page header: Report title + date range picker + Export button]
[Summary KPI strip: 3–4 metrics]
[Main chart section]
[Detail data table with pagination]
```

### 8.2 Report-Specific Typography

Report headers use Noto Serif JP at 300 weight. Column totals use `--font-mono`, `--fw-semibold`. Section subtotals get a `border-top: 2px solid var(--color-border-strong)` to separate from row data.

### 8.3 Print Styles

Add a `@media print` block:
- Hide sidebar, topbar, filter bar, action buttons
- Expand table to full page width
- Force `--color-bg: white`, `--color-surface: white`
- Page break control: `page-break-inside: avoid` on table rows
- Footer: company name, report date, page numbers

### 8.4 Export Button

Ghost button with download icon. On click: triggers server-side PDF or CSV generation. Loading state: spinner inline with button label.

### 8.5 Date Range Picker

Two `<input type="date">` fields: **From** — **To**. Pre-set shortcuts: Today, This Week, This Month, This Quarter, This Year.

### 8.6 Stock Report Columns

| Column | Alignment | Font |
|---|---|---|
| Item code | Left | Mono |
| Description | Left | Sans |
| Family / Brand | Left | Sans, muted |
| Unit | Center | Sans |
| Opening stock | Right | Mono |
| Receipts | Right | Mono |
| Issues | Right | Mono |
| Closing stock | Right | Mono, semibold |
| Avg cost | Right | Mono |
| Total value | Right | Mono, semibold |

---

## 9. Mobile Layouts

### 9.1 Breakpoint Strategy

| Breakpoint | Behavior |
|---|---|
| `< 480px` | Single column, off-canvas nav, stacked actions |
| `480px–767px` | Two-column grids, condensed tables (key columns only) |
| `768px–1023px` | Sidebar visible, condensed (icon + short label) |
| `≥ 1024px` | Full sidebar, full tables, multi-column forms |

### 9.2 Mobile-Specific Patterns

**Navigation:** Off-canvas drawer, opens from left. Overlay tap to close. Bottom tab bar optional for 4 most-used modules.

**Tables on mobile:** Horizontal scroll with `overflow-x: auto` wrapper. Alternatively, card-list fallback for primary list views (each row becomes a card with key info + status badge).

**Forms on mobile:** Always single-column. Inputs minimum 44px tall for touch targets. Group select dropdowns use native `<select>` on mobile.

**Modals on mobile:** Full-height bottom sheet (`position: fixed; bottom: 0; width: 100%; border-radius: --radius-lg --radius-lg 0 0`). Drag handle at top.

**Action buttons on mobile:** Full-width primary button at bottom of screen (fixed footer bar) when primary CTA exists.

### 9.3 Touch Targets

All interactive elements: minimum 44×44px effective touch target. Use padding to expand small icon buttons.

---

## 10. Empty States

### 10.1 Structure

```
[Illustration or icon: 48px Tabler icon, --color-text-subtle]
[Title: --fs-500, --fw-semibold]
[Body: --fs-400, --color-text-muted, max-width: 320px]
[Primary CTA button] (when appropriate)
```

Center-aligned, `padding: var(--space-12) var(--space-6)`.

### 10.2 Per-Module Messages

| Module | Icon | Title | Body |
|---|---|---|---|
| Items | `ti-package` | No items yet | Add your first item to build the catalogue. |
| Customers | `ti-users` | No customers yet | Import or add your first customer. |
| Quotes | `ti-file-invoice` | No quotes | Create your first quote to get started. |
| Inventory | `ti-box` | Stock is empty | Receive a purchase order to log initial stock. |
| Purchase Orders | `ti-shopping-cart` | No purchase orders | Place an order with a supplier to begin. |
| Sales Orders | `ti-receipt` | No sales orders | Convert an accepted quote to a sales order. |
| Invoices | `ti-file-dollar` | No invoices | Generate your first invoice from a sales order. |
| HR | `ti-id` | No employees | Add your team members to get started. |
| Reports | `ti-chart-bar` | No data | Data will appear once transactions are recorded. |
| Search results | `ti-search` | No results | Try different keywords or clear filters. |

### 10.3 Filtered Empty State

When a filter produces 0 results:
- Title: "No results for '[query]'"
- Body: "Try different keywords or clear the filter."
- CTA: "Clear filter" (ghost button)

---

## 11. Loading States

### 11.1 Skeleton Screens

Prefer skeleton screens over spinners for page-level loads. Skeleton blocks match the shape of the content they replace.

```scss
.skeleton {
  border-radius: var(--radius-md);
  background: linear-gradient(
    90deg,
    var(--color-surface-2),
    var(--color-surface),
    var(--color-surface-2)
  );
  background-size: 200% 100%;
  animation: shimmer var(--dur-slow) ease-in-out infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Skeleton shapes:
- Text line: `height: 12px`, 60–80% width
- Heading: `height: 20px`, 40% width
- KPI value: `height: 32px`, 50% width
- Table row: repeat `height: 40px` with `margin-bottom: 1px`
- Avatar: `width: 32px; height: 32px; border-radius: --radius-full`

### 11.2 Inline Spinner

For button loading states and small areas. Use the existing `Spinner` component.

```
Button loading: [⟳ Saving…]  — spinner replaces icon, label changes, button disabled
```

Spinner sizes: `sm` (16px), `md` (20px, default), `lg` (32px).

### 11.3 Page Loading

Full-page spinner: centered `<Spinner size="lg">` + loading message below.
Used only as fallback when skeleton screen isn't feasible (e.g., route transitions).

### 11.4 Optimistic Updates

For status changes (e.g., archiving a record): apply the new state immediately in UI, revert on error. Show a brief toast confirmation on success.

---

## 12. Error States

### 12.1 Field-Level Errors

Appear below the input, `--color-danger-fg`, `--fs-200`. Input border switches to `1px solid var(--color-danger-fg)`. No red fill on the input background unless critical (use `--color-danger-bg` sparingly).

### 12.2 Form-Level Errors

Alert banner above the submit button:
```
[!] Could not save. Please fix the errors highlighted above.
```
Alert variant: `danger`. Disappears on successful resubmit.

### 12.3 Page-Level Errors

Use the `Alert` component at the top of the content area. For 404/403 errors, render a dedicated error page with:
- Icon: `ti-alert-triangle` (48px, `--color-danger-fg`)
- Title: "Page not found" / "Access denied"
- Body: brief explanation
- CTA: "Return to Dashboard"

### 12.4 Network / Server Errors

Toast notification (bottom-right): `danger` tone, auto-dismiss after 6 seconds. Message: "Something went wrong. Please try again." with a "Retry" action if applicable.

### 12.5 Destructive Confirmation Before Error

Never delete or overwrite without a confirmation modal. If an action fails post-confirmation, show the error inline in the modal — do not close the modal.

---

## Appendix A: Icon Library

Use **Tabler Icons** exclusively. Consistent sizing:
- Sidebar nav: 18px
- Button icons: 16px
- Table action icons: 16px
- Empty state: 48px
- Status indicators inline: 14px

Icon color inherits from `currentColor` unless overridden by status. Never use colored icons for decoration — only for status indication.

---

## Appendix B: Accessibility

- Focus rings: `2px solid var(--color-focus)`, `outline-offset: 2px` on all interactive elements
- Focus rings: `:focus-visible` only (not `:focus`) to avoid mouse-click rings
- Color contrast: all text/background pairs meet WCAG AA (4.5:1 for body, 3:1 for large text)
- Keyboard navigation: full Tab/Shift-Tab traversal of all forms and tables
- Screen reader: `aria-label` on icon-only buttons, `aria-live` on toast notifications, `role="status"` on loading indicators
- Reduced motion: all animations collapse when `prefers-reduced-motion: reduce`

---

## Appendix C: File Organization

```
styles/
  _tokens.scss     # SCSS compile-time breakpoint map
  _functions.scss  # SCSS helper functions
  _mixins.scss     # respond-to, focus-ring, truncate, visually-hidden
  _reset.scss      # minimal CSS reset
  _base.scss       # html/body/a/img base element styles
  index.scss       # barrel export for @use in component modules

app/
  globals.scss     # CSS custom properties (:root + [data-theme='dark'])

components/ui/
  button/          Button.tsx + Button.module.scss
  input/           Input.tsx + Input.module.scss
  select/          Select.tsx + Select.module.scss
  textarea/        Textarea.tsx + Textarea.module.scss
  field/           FormField.tsx + FormField.module.scss
  card/            Card.tsx + Card.module.scss
  badge/           Badge.tsx + Badge.module.scss
  alert/           Alert.tsx + Alert.module.scss
  spinner/         Spinner.tsx + Spinner.module.scss
  modal/           Modal.tsx + Modal.module.scss
  toast/           Toaster.tsx + Toaster.module.scss
  table/           Table.tsx + Table.module.scss
  skeleton/        Skeleton.tsx + Skeleton.module.scss
  empty/           EmptyState.tsx + EmptyState.module.scss
  pagination/      Pagination.tsx + Pagination.module.scss
  tabs/            Tabs.tsx + Tabs.module.scss
  sidebar/         Sidebar.tsx + Sidebar.module.scss
  topbar/          Topbar.tsx + Topbar.module.scss
```
