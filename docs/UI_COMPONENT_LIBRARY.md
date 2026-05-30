# Watcon UI Component Library

**Version:** 1.0 · **Date:** 2026-05-30
**Stack:** Next.js 15 · React 19 · TypeScript · SCSS Modules · CSS Variables · No Tailwind

Each section below is **production-ready** — copy the SCSS directly into the matching `.module.scss` file. All components reference only tokens defined in `app/globals.scss` and mixins from `styles/_mixins.scss`.

---

## 1. Sidebar

### `Sidebar.module.scss`

```scss
@use 'mixins' as *;

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: var(--sidebar-w);
  background: var(--gray-950);
  color: rgba(255, 255, 255, 0.45);
  display: flex;
  flex-direction: column;
  z-index: var(--z-sticky);
  overflow-x: hidden;
  transition: width var(--dur-base) var(--ease-standard);

  &[data-collapsed='true'] {
    width: var(--sidebar-w-collapsed);

    .navLabel,
    .sectionLabel,
    .brandSub,
    .footerText {
      opacity: 0;
      pointer-events: none;
      width: 0;
      overflow: hidden;
    }

    .navItem {
      justify-content: center;
      padding: var(--space-3);
    }

    .brand {
      justify-content: center;
      padding: var(--space-4) var(--space-3);
    }
  }
}

// ── Brand lock-up ──────────────────────────────────────────────────────────
.brand {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-5) var(--space-5) var(--space-4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.brandName {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: 18px;
  letter-spacing: 0.20em;
  color: var(--gray-0);
  white-space: nowrap;
  transition: opacity var(--dur-fast) var(--ease-standard);
}

.brandSub {
  font-size: 8px;
  letter-spacing: 0.45em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.25);
  white-space: nowrap;
  transition: opacity var(--dur-fast) var(--ease-standard);
}

// ── Nav body ───────────────────────────────────────────────────────────────
.nav {
  flex: 1;
  padding: var(--space-3) 0;
  overflow-y: auto;
  overflow-x: hidden;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
  }
}

.section {
  margin-top: var(--space-2);
}

.sectionLabel {
  font-size: 7px;
  letter-spacing: 0.50em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.25);
  padding: var(--space-4) var(--space-5) var(--space-2);
  white-space: nowrap;
  transition: opacity var(--dur-fast) var(--ease-standard);
}

.navItem {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 10px var(--space-5);
  font-size: 11px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  border-left: 2px solid transparent;
  transition:
    color var(--dur-fast) var(--ease-standard),
    background var(--dur-fast) var(--ease-standard),
    border-left-color var(--dur-fast) var(--ease-standard);
  text-decoration: none;
  user-select: none;
  white-space: nowrap;

  &:hover {
    color: rgba(255, 255, 255, 0.80);
    background: rgba(255, 255, 255, 0.04);
  }

  &[data-active='true'] {
    color: var(--gray-0);
    background: rgba(255, 255, 255, 0.07);
    border-left-color: var(--gray-0);
  }

  @include focus-ring;

  // Keyboard focus ring adjusted for dark bg
  &:focus-visible {
    outline-color: var(--gray-0);
  }
}

.navIcon {
  font-size: 17px;
  flex-shrink: 0;
  width: 18px;
  text-align: center;
}

.navLabel {
  transition: opacity var(--dur-fast) var(--ease-standard);
  white-space: nowrap;
}

// ── Footer ─────────────────────────────────────────────────────────────────
.footer {
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-shrink: 0;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-200);
  color: rgba(255, 255, 255, 0.60);
  flex-shrink: 0;
  font-weight: var(--fw-medium);
}

.footerText {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  transition: opacity var(--dur-fast) var(--ease-standard);
}

.footerName {
  font-size: var(--fs-300);
  color: rgba(255, 255, 255, 0.60);
  @include truncate(1);
}

.footerRole {
  font-size: 9px;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.25);
}

// ── Mobile overlay ─────────────────────────────────────────────────────────
.overlay {
  display: none;

  @include respond-to-max(md) {
    display: block;
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    z-index: calc(var(--z-sticky) - 1);
    animation: fadeIn var(--dur-base) var(--ease-standard);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

// ── Mobile: off-canvas ─────────────────────────────────────────────────────
@include respond-to-max(md) {
  .sidebar {
    transform: translateX(-100%);
    transition:
      transform var(--dur-base) var(--ease-emphasized),
      width var(--dur-base) var(--ease-standard);

    &[data-open='true'] {
      transform: translateX(0);
    }
  }
}
```

---

## 2. Topbar / Header

### `Topbar.module.scss`

```scss
@use 'mixins' as *;

.topbar {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  height: var(--topbar-h);
  background: var(--color-surface);
  border-bottom: var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-6);
  gap: var(--space-4);
}

.left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.hamburger {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: var(--space-1);
  font-size: 20px;
  @include focus-ring;

  &:hover { color: var(--color-text); }

  @include respond-to-max(md) { display: flex; }
}

.moduleTitle {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: var(--fs-600);
  letter-spacing: 0.15em;
  color: var(--color-text);
  white-space: nowrap;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--fs-300);
  color: var(--color-text-muted);
  @include truncate(1);
}

.breadcrumbSep {
  color: var(--color-border-strong);
  font-size: var(--fs-200);
}

.breadcrumbCurrent {
  color: var(--color-text);
  font-weight: var(--fw-medium);
}

.right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.iconBtn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 19px;
  padding: var(--space-2);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--dur-fast), background var(--dur-fast);
  @include focus-ring;

  &:hover {
    color: var(--color-text);
    background: var(--color-surface-2);
  }
}

.badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-danger-fg);
  border: 2px solid var(--color-surface);
}

.userBtn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: none;
  border: none;
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  transition: background var(--dur-fast);
  @include focus-ring;

  &:hover { background: var(--color-surface-2); }
}

.userAvatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--color-surface-2);
  border: var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-200);
  font-weight: var(--fw-medium);
  color: var(--color-text-muted);
  overflow: hidden;
  flex-shrink: 0;
}

.userName {
  font-size: var(--fs-300);
  color: var(--color-text);
  @include respond-to-max(sm) { display: none; }
}
```

---

## 3. Page Header (Content-Level)

### `PageHeader.module.scss`

```scss
.pageHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-6);
}

.titleGroup {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.backLink {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--fs-300);
  color: var(--color-text-muted);
  text-decoration: none;
  margin-bottom: var(--space-2);
  transition: color var(--dur-fast);

  &:hover { color: var(--color-text); }
}

.title {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: var(--fs-700);
  letter-spacing: 0.05em;
  color: var(--color-text);
  line-height: var(--lh-tight);
}

.subtitle {
  font-size: var(--fs-300);
  color: var(--color-text-muted);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  flex-wrap: wrap;
}
```

---

## 4. Button

### `Button.module.scss`

```scss
@use 'mixins' as *;

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-weight: var(--fw-medium);
  font-size: var(--fs-400);
  line-height: 1;
  padding: var(--space-2) var(--space-4);
  border: var(--border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  white-space: nowrap;
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease-standard),
    border-color var(--dur-fast) var(--ease-standard),
    color var(--dur-fast) var(--ease-standard),
    opacity var(--dur-fast) var(--ease-standard);
  @include focus-ring;

  &:hover:not(:disabled) {
    background: var(--color-surface-2);
    border-color: var(--color-border-strong);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &[data-full-width='true'] { width: 100%; }

  // ── Variants ────────────────────────────────────────────────────────────
  &[data-variant='primary'] {
    background: var(--color-primary);
    color: var(--color-on-primary);
    border-color: var(--color-primary);

    &:hover:not(:disabled) {
      background: var(--color-primary-hover);
      border-color: var(--color-primary-hover);
    }
  }

  &[data-variant='ghost'] {
    background: transparent;
    border-color: transparent;

    &:hover:not(:disabled) {
      background: var(--color-surface-2);
      border-color: var(--color-border);
    }
  }

  &[data-variant='danger'] {
    background: var(--color-danger-bg);
    color: var(--color-danger-fg);
    border-color: var(--color-danger-fg);

    &:hover:not(:disabled) {
      background: var(--color-danger-fg);
      color: #fff;
    }
  }

  &[data-variant='add'] {
    border-style: dashed;
    background: transparent;
    color: var(--color-text-muted);

    &:hover:not(:disabled) {
      border-color: var(--color-text);
      color: var(--color-text);
    }
  }

  // ── Sizes ───────────────────────────────────────────────────────────────
  &[data-size='sm'] {
    padding: var(--space-1) var(--space-3);
    font-size: var(--fs-300);
  }

  &[data-size='lg'] {
    padding: var(--space-3) var(--space-5);
    font-size: var(--fs-500);
  }

  &[data-size='icon'] {
    padding: var(--space-2);
    border-color: transparent;
    background: transparent;
    color: var(--color-text-muted);

    &:hover:not(:disabled) {
      background: var(--color-surface-2);
      color: var(--color-text);
      border-color: transparent;
    }
  }
}

.spinner {
  animation: spin 600ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

---

## 5. Input

### `Input.module.scss`

```scss
@use 'mixins' as *;

.wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input {
  width: 100%;
  font-family: var(--font-sans);
  font-size: var(--fs-400);
  color: var(--color-text);
  background: var(--color-surface);
  border: var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  line-height: var(--lh-normal);
  transition: border-color var(--dur-fast) var(--ease-standard);
  @include focus-ring;

  // Prefer focus-visible, but also handle direct focus for inputs
  &:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: 0 0 0 2px rgba(10, 10, 10, 0.08);
  }

  &::placeholder {
    color: var(--color-text-subtle);
  }

  &:disabled {
    opacity: 0.50;
    cursor: not-allowed;
    background: var(--color-surface-2);
  }

  &[data-error='true'] {
    border-color: var(--color-danger-fg);
    background: var(--color-danger-bg);
  }

  // Icon padding adjustments
  &[data-has-icon-left='true']  { padding-left: var(--space-8); }
  &[data-has-icon-right='true'] { padding-right: var(--space-8); }

  // Number inputs: remove spinners
  &[type='number'] {
    -moz-appearance: textfield;
    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button { display: none; }
  }

  // Search: handled by icon slot
  &[type='search']::-webkit-search-cancel-button { display: none; }
}

.iconLeft,
.iconRight {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  font-size: 16px;
  pointer-events: none;
  display: flex;
  align-items: center;
}

.iconLeft  { left:  var(--space-3); }
.iconRight { right: var(--space-3); }

// ── Underline variant (inline table editing) ────────────────────────────
.underline {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  padding: var(--space-1) 0;

  &:focus {
    border-bottom-color: var(--color-focus);
    box-shadow: none;
  }
}
```

---

## 6. Select

### `Select.module.scss`

```scss
@use 'mixins' as *;

.wrapper {
  position: relative;
}

.select {
  width: 100%;
  font-family: var(--font-sans);
  font-size: var(--fs-400);
  color: var(--color-text);
  background: var(--color-surface);
  border: var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-8) var(--space-2) var(--space-3);
  line-height: var(--lh-normal);
  appearance: none;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-standard);

  &:focus {
    outline: none;
    border-color: var(--color-focus);
    box-shadow: 0 0 0 2px rgba(10, 10, 10, 0.08);
  }

  &:disabled {
    opacity: 0.50;
    cursor: not-allowed;
    background: var(--color-surface-2);
  }

  &[data-error='true'] {
    border-color: var(--color-danger-fg);
  }
}

.chevron {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--color-text-muted);
  pointer-events: none;
}
```

---

## 7. FormField

### `FormField.module.scss`

```scss
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--fs-200);
  font-weight: var(--fw-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-label);
  color: var(--color-text-muted);
}

.required {
  color: var(--color-danger-fg);
  font-size: var(--fs-300);
  line-height: 1;
}

.hint {
  font-size: var(--fs-200);
  color: var(--color-text-subtle);
}

.error {
  font-size: var(--fs-200);
  color: var(--color-danger-fg);
}
```

---

## 8. Card / Panel

### `Card.module.scss`

```scss
.card {
  background: var(--color-surface);
  border: var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-5);

  &[data-padding='none']  { padding: 0; }
  &[data-padding='sm']    { padding: var(--space-3); }
  &[data-padding='lg']    { padding: var(--space-6); }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--space-4);
  margin-bottom: var(--space-4);
  border-bottom: var(--border);
}

.title {
  font-size: var(--fs-500);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
}

.subtitle {
  font-size: var(--fs-300);
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}

.sectionTitle {
  font-size: var(--fs-200);
  font-weight: var(--fw-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-label);
  color: var(--color-text-muted);
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: var(--border);
}
```

---

## 9. Badge

### `Badge.module.scss`

```scss
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--fs-200);
  font-weight: var(--fw-medium);
  letter-spacing: 0.20em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  white-space: nowrap;

  // ── Status variants ─────────────────────────────────────────────────────
  &[data-tone='neutral'] {
    background: var(--gray-100);
    color: var(--gray-700);
  }

  &[data-tone='success'] {
    background: var(--color-success-bg);
    color: var(--color-success-fg);
  }

  &[data-tone='warning'] {
    background: var(--color-warning-bg);
    color: var(--color-warning-fg);
  }

  &[data-tone='danger'] {
    background: var(--color-danger-bg);
    color: var(--color-danger-fg);
  }

  &[data-tone='info'] {
    background: var(--color-info-bg);
    color: var(--color-info-fg);
  }

  // ── Optional outline variant ────────────────────────────────────────────
  &[data-outline='true'] {
    background: transparent;
    box-shadow: inset 0 0 0 1px currentColor;
  }
}
```

**Status-to-tone mapping:**

| Business Status | Tone |
|---|---|
| Draft | neutral |
| Pending / Revised | warning |
| Sent / In Progress | info |
| Active / Accepted / Paid | success |
| Cancelled / Rejected / Overdue | danger |

---

## 10. Alert

### `Alert.module.scss`

```scss
.alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border-left: 3px solid transparent;
  font-size: var(--fs-300);
  line-height: var(--lh-normal);

  &[data-tone='success'] {
    background: var(--color-success-bg);
    color: var(--color-success-fg);
    border-left-color: var(--color-success-fg);
  }

  &[data-tone='warning'] {
    background: var(--color-warning-bg);
    color: var(--color-warning-fg);
    border-left-color: var(--color-warning-fg);
  }

  &[data-tone='danger'] {
    background: var(--color-danger-bg);
    color: var(--color-danger-fg);
    border-left-color: var(--color-danger-fg);
  }

  &[data-tone='info'] {
    background: var(--color-info-bg);
    color: var(--color-info-fg);
    border-left-color: var(--color-info-fg);
  }
}

.icon {
  font-size: 17px;
  flex-shrink: 0;
  margin-top: 1px;
}

.body {
  flex: 1;
  min-width: 0;
}

.title {
  font-weight: var(--fw-semibold);
  margin-bottom: 2px;
}
```

---

## 11. Spinner

### `Spinner.module.scss`

```scss
.spinner {
  display: inline-block;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-border);
  border-top-color: var(--color-text);
  animation: spin 600ms linear infinite;

  &[data-size='sm'] { width: 14px; height: 14px; }
  &[data-size='md'] { width: 20px; height: 20px; }
  &[data-size='lg'] { width: 32px; height: 32px; border-width: 3px; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .spinner { animation: none; opacity: 0.5; }
}
```

---

## 12. Modal

### `Modal.module.scss`

```scss
@use 'mixins' as *;

.overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-4);
  animation: overlayIn var(--dur-base) var(--ease-standard);
}

.panel {
  background: var(--color-surface);
  border: var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  max-height: 88vh;
  width: 100%;
  animation: panelIn var(--dur-base) var(--ease-emphasized);

  &[data-size='sm'] { max-width: 400px; }
  &[data-size='md'] { max-width: 560px; }
  &[data-size='lg'] { max-width: 760px; }
  &[data-size='xl'] { max-width: 960px; }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-5) var(--space-6);
  border-bottom: var(--border);
  flex-shrink: 0;
}

.title {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: var(--fs-600);
  letter-spacing: 0.05em;
  color: var(--color-text);
}

.closeBtn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 20px;
  padding: var(--space-1);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color var(--dur-fast), background var(--dur-fast);
  @include focus-ring;

  &:hover {
    color: var(--color-text);
    background: var(--color-surface-2);
  }
}

.body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-5) var(--space-6);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: var(--border);
  flex-shrink: 0;
}

// ── Mobile: bottom sheet ────────────────────────────────────────────────────
@include respond-to-max(md) {
  .overlay {
    align-items: flex-end;
    padding: 0;
  }

  .panel {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    max-height: 92vh;
    animation: sheetIn var(--dur-base) var(--ease-emphasized);
  }
}

// ── Animations ──────────────────────────────────────────────────────────────
@keyframes overlayIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes panelIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes sheetIn {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .overlay, .panel { animation: none; }
}
```

---

## 13. Data Table

### `Table.module.scss`

```scss
@use 'mixins' as *;

.wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;

  // Subtle fade at right edge to hint at scroll
  &[data-scrollable='true'] {
    mask-image: linear-gradient(to right, black 95%, transparent 100%);
  }
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-300);
}

.th {
  text-align: left;
  font-family: var(--font-sans);
  font-size: var(--fs-200);
  font-weight: var(--fw-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-label);
  color: var(--color-text-muted);
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border);
  white-space: nowrap;
  user-select: none;

  &[data-align='right']  { text-align: right; }
  &[data-align='center'] { text-align: center; }

  &[data-sortable='true'] {
    cursor: pointer;
    &:hover { color: var(--color-text); }
  }
}

.td {
  padding: var(--space-3);
  border-bottom: var(--border);
  vertical-align: middle;
  color: var(--color-text);

  &[data-align='right']  { text-align: right; }
  &[data-align='center'] { text-align: center; }
}

.row {
  transition: background var(--dur-fast) var(--ease-standard);

  &:hover .td { background: var(--color-surface-2); }
  &:last-child .td { border-bottom: none; }

  &[data-selected='true'] .td {
    background: var(--color-info-bg);
  }
}

// ── Cell type helpers ─────────────────────────────────────────────────────
.num {
  font-family: var(--font-mono);
  font-size: var(--fs-300);
  white-space: nowrap;
  text-align: right;
}

.numBold {
  font-family: var(--font-mono);
  font-weight: var(--fw-semibold);
  white-space: nowrap;
  text-align: right;
}

.primary {
  font-weight: var(--fw-medium);
  color: var(--color-text);
}

.meta {
  font-size: var(--fs-200);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
  opacity: 0;
  transition: opacity var(--dur-fast);

  .row:hover & { opacity: 1; }
}

// ── Subtotal / total rows ────────────────────────────────────────────────────
.subtotalRow .td {
  border-top: 2px solid var(--color-border-strong);
  font-weight: var(--fw-semibold);
  background: var(--color-surface-2);
}

.totalRow .td {
  border-top: 2px solid var(--color-text);
  font-family: var(--font-mono);
  font-weight: var(--fw-semibold);
  font-size: var(--fs-400);
  background: var(--color-surface-2);
}

// ── Empty state ───────────────────────────────────────────────────────────────
.emptyCell {
  text-align: center;
  padding: var(--space-10) var(--space-6);
  color: var(--color-text-subtle);
  font-size: var(--fs-300);
}
```

---

## 14. Filter Bar

### `FilterBar.module.scss`

```scss
@use 'mixins' as *;

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.search {
  flex: 1 1 240px;
  position: relative;
}

.searchIcon {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.searchInput {
  width: 100%;
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-8);
  border: var(--border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: var(--fs-400);
  color: var(--color-text);
  transition: border-color var(--dur-fast);

  &:focus {
    outline: none;
    border-color: var(--color-focus);
  }

  &::placeholder { color: var(--color-text-subtle); }
}

.select {
  flex: 0 1 180px;
}

// ── Filter tabs ─────────────────────────────────────────────────────────────
.tabs {
  display: flex;
  border: var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.tab {
  padding: var(--space-2) var(--space-3);
  font-size: var(--fs-300);
  letter-spacing: 0.10em;
  text-transform: uppercase;
  background: var(--color-surface);
  color: var(--color-text-muted);
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  transition: background var(--dur-fast), color var(--dur-fast);
  white-space: nowrap;

  & + & {
    border-left: var(--border);
  }

  &:hover:not([data-active='true']) {
    color: var(--color-text);
    background: var(--color-surface-2);
  }

  &[data-active='true'] {
    background: var(--color-primary);
    color: var(--color-on-primary);
  }
}
```

---

## 15. Pagination

### `Pagination.module.scss`

```scss
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: var(--space-4);
  flex-wrap: wrap;
}

.info {
  font-size: var(--fs-300);
  color: var(--color-text-muted);
}

.pages {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.pageBtn {
  min-width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--space-2);
  border: var(--border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--fs-300);
  cursor: pointer;
  transition: background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast);

  &:hover:not(:disabled):not([data-active='true']) {
    background: var(--color-surface-2);
    color: var(--color-text);
  }

  &[data-active='true'] {
    background: var(--color-primary);
    color: var(--color-on-primary);
    border-color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.40;
    cursor: not-allowed;
  }
}
```

---

## 16. Toast / Notifications

### `Toaster.module.scss`

```scss
.region {
  position: fixed;
  bottom: var(--space-5);
  right: var(--space-5);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  pointer-events: none;
  max-width: 360px;
  width: calc(100% - var(--space-10));
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border: var(--border);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  pointer-events: all;
  font-size: var(--fs-300);
  line-height: var(--lh-normal);
  animation: toastIn var(--dur-base) var(--ease-emphasized);

  &[data-tone='success'] { border-left: 3px solid var(--color-success-fg); }
  &[data-tone='warning'] { border-left: 3px solid var(--color-warning-fg); }
  &[data-tone='danger']  { border-left: 3px solid var(--color-danger-fg); }
  &[data-tone='info']    { border-left: 3px solid var(--color-info-fg); }
}

.icon {
  font-size: 17px;
  flex-shrink: 0;
  margin-top: 1px;

  [data-tone='success'] & { color: var(--color-success-fg); }
  [data-tone='warning'] & { color: var(--color-warning-fg); }
  [data-tone='danger']  & { color: var(--color-danger-fg); }
  [data-tone='info']    & { color: var(--color-info-fg); }
}

.body {
  flex: 1;
  min-width: 0;
}

.message { color: var(--color-text); }
.action  {
  margin-top: var(--space-1);
  font-weight: var(--fw-medium);
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-size: var(--fs-300);
  font-family: var(--font-sans);
  text-decoration: underline;

  &:hover { color: var(--color-text); }
}

.dismiss {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 17px;
  padding: 0;
  display: flex;
  flex-shrink: 0;
  margin-top: 1px;

  &:hover { color: var(--color-text); }
}

@keyframes toastIn {
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .toast { animation: none; }
}
```

---

## 17. Skeleton

### `Skeleton.module.scss`

```scss
.skeleton {
  border-radius: var(--radius-md);
  background: linear-gradient(
    90deg,
    var(--color-surface-2) 25%,
    var(--color-surface)   50%,
    var(--color-surface-2) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;

  &[data-shape='text']    { height: 12px; border-radius: var(--radius-sm); }
  &[data-shape='heading'] { height: 20px; border-radius: var(--radius-sm); }
  &[data-shape='kpi']     { height: 36px; }
  &[data-shape='circle']  { border-radius: var(--radius-full); }
}

@keyframes shimmer {
  0%   { background-position:  200% 0; }
  100% { background-position: -200% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: var(--color-surface-2);
  }
}
```

---

## 18. Empty State

### `EmptyState.module.scss`

```scss
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-12) var(--space-6);
  gap: var(--space-3);
}

.icon {
  font-size: 48px;
  color: var(--color-text-subtle);
  margin-bottom: var(--space-2);
}

.title {
  font-size: var(--fs-500);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
}

.body {
  font-size: var(--fs-400);
  color: var(--color-text-muted);
  max-width: 320px;
  line-height: var(--lh-relaxed);
}

.action {
  margin-top: var(--space-2);
}
```

---

## 19. Dashboard KPI Cards

### `KpiCard.module.scss`

```scss
.card {
  background: var(--color-surface);
  border: var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition: border-color var(--dur-fast) var(--ease-standard);

  &:hover { border-color: var(--color-border-strong); }
}

.label {
  font-size: var(--fs-200);
  font-weight: var(--fw-medium);
  text-transform: uppercase;
  letter-spacing: var(--tracking-label);
  color: var(--color-text-muted);
}

.value {
  font-family: var(--font-display);
  font-weight: 300;
  font-size: var(--fs-800);
  line-height: 1;
  color: var(--color-text);
}

.delta {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--fs-200);

  &[data-dir='up']   { color: var(--color-success-fg); }
  &[data-dir='down'] { color: var(--color-danger-fg); }
  &[data-dir='flat'] { color: var(--color-text-muted); }
}
```

---

## 20. Location Block (Quotes module)

### `LocationBlock.module.scss`

```scss
.block {
  border: var(--border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--space-3);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: var(--border);
  background: var(--color-surface-2);
}

.locNum {
  font-size: var(--fs-200);
  text-transform: uppercase;
  letter-spacing: var(--tracking-label);
  color: var(--color-text-muted);
}

.locName {
  font-weight: var(--fw-medium);
  font-size: var(--fs-400);
  flex: 1;
  margin-left: var(--space-3);
}

.body {
  padding: var(--space-4);
}

// ── Line items table inside location ─────────────────────────────────────
.itemTable {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-300);
  margin-bottom: var(--space-3);
}

.itemTable th {
  font-size: var(--fs-200);
  text-transform: uppercase;
  letter-spacing: var(--tracking-label);
  color: var(--color-text-muted);
  font-weight: var(--fw-medium);
  padding: var(--space-2) var(--space-2);
  border-bottom: var(--border);
  white-space: nowrap;
  text-align: left;

  &.r { text-align: right; }
}

.itemTable td {
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-surface-2);
  vertical-align: middle;

  &.r { text-align: right; font-family: var(--font-mono); }
}

// ── Alternate item row ────────────────────────────────────────────────────
.altRow td {
  background: var(--color-warning-bg);
  border-bottom-color: rgba(138, 106, 44, 0.15);
}

.altTag {
  display: inline-block;
  font-size: var(--fs-200);
  letter-spacing: 0.20em;
  text-transform: uppercase;
  padding: 2px 6px;
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-fg);
  color: var(--color-warning-fg);
  border-radius: var(--radius-sm);
  margin-right: var(--space-2);
}

// ── Installation block ────────────────────────────────────────────────────
.instBlock {
  margin-top: var(--space-3);
  border: 1px solid rgba(138, 106, 44, 0.30);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.instHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--color-warning-bg);
  border-bottom: 1px solid rgba(138, 106, 44, 0.20);
}

.instBody {
  padding: var(--space-3);
  background: var(--color-surface);
}

// ── Location subtotal ──────────────────────────────────────────────────────
.subtotal {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-6);
  padding-top: var(--space-3);
  border-top: var(--border);
  font-size: var(--fs-300);
}

.subtotalLabel { color: var(--color-text-muted); }
.subtotalValue {
  font-family: var(--font-mono);
  font-weight: var(--fw-semibold);
  min-width: 100px;
  text-align: right;
}
```

---

## 21. Costing Trail (Items)

### `CostingTrail.module.scss`

```scss
.trail {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) 0;
  font-size: var(--fs-300);

  & + & { border-top: var(--border); }
}

.label { color: var(--color-text-muted); }

.value {
  font-family: var(--font-mono);
  text-align: right;
}

.totalRow {
  .label, .value {
    font-weight: var(--fw-semibold);
    font-size: var(--fs-400);
    color: var(--color-text);
  }

  border-top: 2px solid var(--color-border-strong) !important;
  padding-top: var(--space-3);
  margin-top: var(--space-1);
}
```

---

## 22. App Shell Layout

### `AppShell.module.scss`

```scss
@use 'mixins' as *;

.shell {
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
}

.main {
  margin-left: var(--sidebar-w);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  transition: margin-left var(--dur-base) var(--ease-standard);

  &[data-sidebar-collapsed='true'] {
    margin-left: var(--sidebar-w-collapsed);
  }

  @include respond-to-max(md) {
    margin-left: 0;
  }
}

.content {
  flex: 1;
  padding: var(--space-6);
  max-width: var(--container-max);
  width: 100%;
  margin: 0 auto;

  @include respond-to-max(sm) {
    padding: var(--space-4);
  }
}
```

---

## 23. Report Page

### `ReportPage.module.scss`

```scss
@use 'mixins' as *;

.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.controls {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.dateRange {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.dateLabel {
  font-size: var(--fs-300);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.shortcuts {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.shortcut {
  padding: var(--space-1) var(--space-2);
  font-size: var(--fs-200);
  text-transform: uppercase;
  letter-spacing: 0.10em;
  border: var(--border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast);

  &:hover, &[data-active='true'] {
    background: var(--color-primary);
    color: var(--color-on-primary);
    border-color: var(--color-primary);
  }
}

.kpis {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);

  @include respond-to(md) { grid-template-columns: repeat(4, 1fr); }
}

.chart {
  background: var(--color-surface);
  border: var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-5);
}

.chartTitle {
  font-size: var(--fs-500);
  font-weight: var(--fw-semibold);
  margin-bottom: var(--space-4);
}

.chartArea {
  width: 100%;
  height: 260px;
}

// ── Print ─────────────────────────────────────────────────────────────────
@media print {
  .controls, .shortcuts { display: none; }

  .chart {
    border: none;
    padding: 0;
    break-inside: avoid;
  }

  :global(body) {
    background: white !important;
    color: black !important;
  }
}
```

---

## 24. Mobile Nav Bar (Bottom Tab Bar)

### `MobileNav.module.scss`

```scss
@use 'mixins' as *;

.bar {
  display: none;

  @include respond-to-max(md) {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: var(--color-surface);
    border-top: var(--border);
    z-index: var(--z-sticky);
    padding-bottom: env(safe-area-inset-bottom);
  }
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 9px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  transition: color var(--dur-fast);
  padding: var(--space-1);

  &[data-active='true'] {
    color: var(--color-text);
  }
}

.tabIcon { font-size: 20px; }
```

---

## 25. CSS Variable Reference Card

```
SURFACES          --color-bg · --color-surface · --color-surface-2
BORDERS           --color-border · --color-border-strong
TEXT              --color-text · --color-text-muted · --color-text-subtle · --color-text-inverse
PRIMARY ACTION    --color-primary · --color-primary-hover · --color-on-primary
STATUS            --color-{success|warning|danger|info}-{fg|bg}

FONTS             --font-display · --font-sans · --font-mono
SIZES             --fs-100 … --fs-900
WEIGHTS           --fw-regular(400) · --fw-medium(500) · --fw-semibold(600) · --fw-bold(700)
LINE-HEIGHT       --lh-tight(1.2) · --lh-snug(1.35) · --lh-normal(1.5) · --lh-relaxed(1.65)
TRACKING          --tracking-tight · --tracking-normal · --tracking-label(0.04em)

SPACE             --space-0 through --space-20
RADIUS            --radius-none · --radius-sm(2px) · --radius-md(4px) · --radius-lg(8px) · --radius-full
SHADOW            --shadow-none · --shadow-sm · --shadow-md · --shadow-lg
BORDER            --border · --border-strong · --border-focus

LAYOUT            --container-max(1280px) · --sidebar-w(248px) · --sidebar-w-collapsed(64px) · --topbar-h(56px)
MOTION            --dur-fast(120ms) · --dur-base(180ms) · --dur-slow(240ms) · --ease-standard · --ease-emphasized
Z-INDEX           --z-dropdown(1000) → --z-tooltip(1600)
```
