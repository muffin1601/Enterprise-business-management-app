# Watcon Business Management System — Project Plan & Software Requirements Specification (SRS)

> **Status:** Planning / Architecture (no code yet)
> **Date:** 2026-05-29
> **Author:** Watcon (report@watcon.net)
> **Source material analysed:** `watcon business management app.docx` (full build chat log) + 9 HTML/JSX prototype files in `files/`.

---

## 0. How This Document Was Derived

This plan is reverse-engineered from two sources:

1. **The Word document** — a chronological chat log of an iterative prototyping session (24–28 May 2026) describing requirements module-by-module in the user's own words.
2. **The HTML/JSX prototypes** — working single-file prototypes that encode the actual data models, calculations, and UX already validated by the user:

| File | Module | State |
|------|--------|-------|
| `watcon_app.html` | Unified app (Dashboard + Quotes + Customers + Items + Stock) | Most complete; compiled build |
| `watcon_quotes_v4.html` | Quotes (final iteration) | Canonical quotes spec |
| `watcon_quotes_v3.html`, `watcon_quotes_module.html` | Quotes (earlier) | Superseded |
| `watcon_customer_module.html` | Customers + Running Bill | Canonical customer spec |
| `watcon_item_module_v2.html`, `watcon_item_module.jsx` | Items + Import calculator | Canonical item spec |
| `watcon_stock_report_v2.html`, `watcon_stock_report.html` | Stock Reports | Canonical reporting spec |

Where the prototypes and the doc disagree, the **latest prototype wins** (it reflects the most recent user decision). The prototypes are **in-memory, single-user, no-auth demos** — this plan specifies the production system they imply.

---

## 1. Project Overview

### 1.1 Vision
Watcon Management Software is a **complete, multi-department business management system** for a construction-materials / interior-fit-out trading business (tiles, pipes, fireplaces, engineered wood, sanitaryware, etc.). It handles the full commercial lifecycle: **Item/Inventory → Quotation → Sales Order → Delivery Challan → Payments/Running Bill → Reporting**, plus back-office departments (HR, Finance, Logistics, Customer Service, Admin).

### 1.2 Design Language (Non-negotiable)
> *"the look and feel is very modern japanese classical. black and white."*

- **Aesthetic:** Japanese wabi-sabi minimalism — ink-on-washi, pure monochrome (black/white/greys), hairline borders, generous whitespace.
- **Typography:** Serif display (Noto Serif JP) for headings; clean sans for body.
- **Principle:** "Nothing unnecessary." This becomes the design-token foundation in the Tailwind theme.

### 1.3 Business Domain Characteristics (drive the data model)
- Products can be **domestic or imported** (multi-currency landed-cost costing).
- Products have **variations** (size / make / finish / brand) that behave as **independent stock items**.
- Quotes are **multi-location / multi-area** (e.g. Ground Floor vs First Floor) with **per-area installation** and **per-area client selection**.
- Items can carry **optional/alternate items** ("we quoted Kajaria, here's the Somany alternative").
- The **Running Bill** is the central financial truth per customer: material delivered (via challans) − post-sale discount vs. payments received = outstanding.
- Reports (stock) must be **shareable** as **PDF** via print, save, email, and WhatsApp.

---

## 2. Stakeholders & User Roles

The prototypes implement two roles (`employee`, `admin`); the doc explicitly names more departments and an Admin Panel with "user management, access control, audit logs." The production system needs a richer, configurable RBAC model. Recommended role set:

| Role | Description | Origin |
|------|-------------|--------|
| **Super Admin** | Full system access, user/role management, audit logs, configuration. | Doc: "Admin Panel — user management, access control, audit logs" |
| **Admin** | All operational modules; **stock adjustment**; post-sale discounts; pricing overrides. | Prototype `role==='admin'` |
| **Sales / Employee** | Create customers, quotes, sales orders, challans; view items; **cannot adjust stock**. | Prototype `role==='employee'` |
| **Inventory / Store** | Manage items, stock receipts, stock adjustments, purchase entries. | Implied by Item + Stock modules |
| **Finance / Accounts** | Payments, running bills, P&L, expense approvals, payroll. | Doc: Finance module |
| **HR** | Employee records, leave, appraisals, onboarding. | Doc: HR module |
| **Logistics** | Shipment/challan dispatch, vendor management. | Doc: Logistics module |
| **Customer Service** | Tickets, SLA tracking. | Doc: Customer Service module |
| **Viewer / Read-only** | Dashboards & reports only. | Assumption |

> **Login (from the doc):** App opens to a login screen (User ID + Password). Demo credentials in early prototype: `emp001 / pass123` and `admin / admin123`. Admin login revealed an **Administration** section in the sidebar. → Production: real auth (Supabase Auth) + role-gated navigation.

---

## 3. Modules

### 3.1 Currently Described / Prototyped (✅ have working UX & data model)

| # | Module | Status | Canonical source |
|---|--------|--------|------------------|
| M1 | **Authentication & Dashboard** | Prototyped (login + dashboard shell) | doc + `watcon_app.html` |
| M2 | **Items / Inventory** (catalogue, variations-as-items, import landed-cost calculator, stock, last-purchase, sales history) | Prototyped (v2) | `watcon_item_module_v2.html` |
| M3 | **Stock Reports** (hierarchical filter family→variation→brand, date range, stock value, sales movement, PDF/Print/Email/WhatsApp) | Prototyped (v2) | `watcon_stock_report_v2.html` |
| M4 | **Customers** (billing vs delivery identity, **Running Bill** ledger, payments view) | Prototyped | `watcon_customer_module.html` |
| M5 | **Quotes / Quotation** (multi-location, line items, alternates, per-location installation, GST modes, BOQ summary, per-area selection, revisions, PDF) | Prototyped (v4) | `watcon_quotes_v4.html` |

### 3.2 Explicitly Planned in the Doc (described, not yet built)

| # | Module | Notes from doc |
|---|--------|----------------|
| M6 | **Sales Orders** | "we will create separate module for it" — converts an accepted quote into an order. |
| M7 | **Delivery Challans** | Feeds the Running Bill; lists material sent to site with qty × rate, value, date, challan number. |
| M8 | **Payments** | Recording receipts (NEFT/RTGS/Cheque/Cash), against customer/running bill. |
| M9 | **Finance / P&L** | "budgets, payroll, expense approvals, P&L". |
| M10 | **Human Resources** | "employee records, leave, appraisals, onboarding". |
| M11 | **Logistics** | "shipment tracking, vendor management". |
| M12 | **Customer Service** | "ticket system, SLA tracking". |
| M13 | **Admin Panel** | "user management, access control, audit logs". |

### 3.3 Recommended Additional Modules (gap-filling — see §9)
Purchase Orders / Procurement, Vendor/Supplier master, GST/Tax reporting, Notifications, Document/File storage, Global Search, Settings/Company profile.

---

## 4. Feature List (Detailed)

### M1 — Authentication & Dashboard
- Login with User ID + password; role-based session.
- Role-gated sidebar (Administration section only for admins).
- Minimalist monochrome dashboard: time-of-day greeting, department load bars, activity feed, priority tasks, quick stats (total quote value, outstanding receivables, pending quotes, catalogue item count), system module status.

### M2 — Items / Inventory
- **Catalogue:** card grid, search by name/ID, filter Domestic/Imported, low-stock visual flag (<100 units → red).
- **Item detail:** last purchase price + supplier, current stock, selling price, cost price, delivery time, full variation list, import breakdown (imported items).
- **New item creation:** product photo, name, purchase price, selling price, unit, approx. delivery time, brand.
- **Variations** (size / make / finish / brand): each saved variation **spawns its own independent item** (e.g. `ITM-XXXX-V1`, `ITM-XXXX-V2`) carrying parent name/pricing, tagged "Variant" with a parent reference link.
- **Import landed-cost calculator** (see §7.1): currency (USD/EUR/CNY) × exchange rate → discount % → transport (lumpsum ₹ **or** % of discounted cost) → custom duty % → profit multiplier → **selling price**, with full cost trail shown.
- **Edit mode:** all fields editable inline (incl. image).
- **Admin-only stock adjustment:** add/reduce with **mandatory reason**; every change logged (date, type, qty, reason); employees see a "Stock: Admin only" lock badge.
- **Sales/stock movement report per item:** date-range, which customer took what qty/value, totals.

### M3 — Stock Reports
- Two modes: **Complete Stock Report** (all items) and **Individual Item Report** (one item).
- **Hierarchical search/filter:** item family → variation → brand (cascading; e.g. "pipe" → GI Pipe family → "20mm Medium Duty" → "Tata Steel"). Reports can be generated for an item, a variation, or a brand.
- Date-range picker (affects sales movement, not stock position).
- Current stock position table (stock, purchase price, selling price, **stock value = stock × purchase price**, low-stock flag) + totals.
- Sales movement table (date, item, customer, qty, value) + grand total.
- Summary strip: item count, total stock units, stock cost value, period sales.
- **Export/Share:** Print (clean A4), Save PDF (jsPDF, **locked mm columns** so layout never breaks), Email (PDF), WhatsApp (PDF — see §9 limitation), Copy as text.
- Deselect individual items from the complete report; live preview.

### M4 — Customers
- **List:** card grid with billed / received / outstanding per customer; search by name/phone/email/ID; filter Active/Inactive.
- **Separate identities:** customer name & site can differ from **billing name & billing address** (GST invoicing); "Same as Billing" copy button.
- Fields: contact person, phone, email, GSTIN, PAN, notes.
- **Detail view metrics:** Total Billed, Post-Sale Discount, Total Received, Outstanding.
- Quick links to: Payments, Quotes, Sales Orders, Delivery Challans, **Running Bill**.
- **Running Bill (core feature):** every delivery challan (date, challan no., material items with qty × rate), total material sent + value, **less post-sale discount**, net payable, all payments received (date, mode, reference), total received, **outstanding balance**.
- New/edit customer form.

### M5 — Quotes / Quotation
- **Header:** auto reference number, revision number, date, status (Draft/Sent/Accepted/Revised/Cancelled), company logo upload, subject.
- **Customer:** select existing **or create new customer inline** (modal) without leaving the quote.
- **Multiple locations/areas** per quote (e.g. Ground Floor, First Floor) — each its own section with its own items and subtotal; rename/delete.
- **Line items** (per location): product image, name, brand (one or many), unit, **rate (editable at quote time)**, qty, line-wise discount %; live total recalculation on any change.
- **Optional/alternate items** per line: same qty as main item, shown with price but **excluded from total**, tagged "ALT"; **"Use/Make Primary"** swaps an alternate into the main slot (the old main becomes an alternate — nothing lost).
- **Per-location installation charge** (optional): **lumpsum ₹**, **% of location subtotal**, or **per-unit rate**, with an installation note. Each location shows a **location total including installation**.
- **GST modes:** **Add GST** (calculated at %), **Included in price** (no separate amount), **No GST** (absent entirely).
- **Transport charges** + note.
- **Per-area client selection:** each area can be ticked/unticked; totals sum **only selected areas** (client chooses which areas to proceed with).
- **Total display modes:** **Grand Total only**, **Each Area total only** (no grand total), or **Each Area + Grand Total**.
- **Terms & Conditions:** categorised (Delivery, GST, Payment, Warranty, Installation, Exclusion, Other), editable inline, add/remove; pre-loaded defaults.
- **BOQ Summary page:** separate printed cover page — company logo, client name/contact/billing address, quote no., revision, project/subject, area names with area totals; grand total only if total-mode requests it.
- **Revisions:** "Create Revision" increments revision and saves a new version.
- **Output:** Preview + Print Quote / Print BOQ Summary / Print Both; **PDF built from data (not innerHTML copy)** with `table-layout:fixed` and locked column widths so the layout is preserved.

### M6–M13 (planned modules) — feature outlines
- **Sales Orders:** convert accepted quote → SO; SO line items, locked pricing, status (open/partially-delivered/fulfilled/cancelled), link to challans & invoices.
- **Delivery Challans:** create from SO/items; challan no., date, line items (qty/unit/rate/value), site delivery address, post-delivery discount; feeds Running Bill; print/PDF.
- **Payments:** record receipts against customer (date, amount, mode, reference), allocate to running bill; receipt PDF.
- **Finance / P&L:** expense entry & approvals, budgets, payroll, P&L statement, GST output/input summaries.
- **HR:** employee master, leave management, appraisals, onboarding workflow.
- **Logistics:** shipment/dispatch tracking, vendor management.
- **Customer Service:** ticketing, SLA tracking, status workflow.
- **Admin Panel:** user CRUD, role/permission assignment, audit log viewer, company settings.

---

## 5. Software Requirements Specification (SRS)

### 5.1 Purpose & Scope
Specifies functional and non-functional requirements for the Watcon Business Management System — a web application unifying inventory, sales, customer, and back-office operations for a construction-materials trading business, replacing the in-memory HTML prototypes with a persistent, multi-user, role-secured product.

### 5.2 Functional Requirements (selected, traceable)

| ID | Requirement | Source | Priority |
|----|-------------|--------|----------|
| FR-AUTH-1 | System shall require login (ID/email + password) before access. | Doc | Must |
| FR-AUTH-2 | Navigation and actions shall be gated by the user's role. | Doc + proto | Must |
| FR-ITEM-1 | User shall create items with photo, name, purchase price, selling price, unit, delivery time, brand. | Doc | Must |
| FR-ITEM-2 | An item may be domestic or imported; imported items shall use the landed-cost calculator to derive selling price. | Doc | Must |
| FR-ITEM-3 | Adding variations (size/make/finish/brand) shall generate one independent item per variation, linked to a parent. | Doc | Must |
| FR-ITEM-4 | Item detail shall show last purchase price, supplier, current stock, and sales movement by date range and customer. | Doc | Must |
| FR-ITEM-5 | Only Admin (or stock-permitted roles) may adjust stock; every adjustment requires a reason and is logged. | Doc + proto | Must |
| FR-STK-1 | Reports shall filter hierarchically by item family → variation → brand, with date range. | Doc | Must |
| FR-STK-2 | Reports shall be exportable as PDF and shareable via Print, Save, Email, WhatsApp. | Doc | Must |
| FR-STK-3 | PDF layout shall preserve table columns (fixed widths) regardless of content. | Doc | Must |
| FR-CUST-1 | Customers shall support distinct billing name/address and delivery name/address. | Doc | Must |
| FR-CUST-2 | System shall compute a Running Bill: total material delivered − post-sale discount vs payments received = outstanding. | Doc | Must |
| FR-QT-1 | A quote shall support multiple locations/areas, each with its own items, subtotal, and optional installation charge. | Doc | Must |
| FR-QT-2 | Line totals shall recalculate live on rate/qty/discount change. | Doc | Must |
| FR-QT-3 | Installation charge shall support lumpsum, % of subtotal, or per-unit modes per location. | Doc | Must |
| FR-QT-4 | Each line item may have optional alternate items (same qty, priced, excluded from total) that can be promoted to primary. | Doc | Must |
| FR-QT-5 | GST shall support Add / Included / None modes. | Doc | Must |
| FR-QT-6 | Areas shall be individually selectable; totals reflect only selected areas. | Doc | Must |
| FR-QT-7 | Total display shall support Grand only / Each area only / Each + Grand. | Doc | Must |
| FR-QT-8 | A quote shall produce a separate BOQ summary page and support quote/BOQ/both printing. | Doc | Must |
| FR-QT-9 | Quotes shall support revisions (incrementing revision number, preserving history). | Doc | Must |
| FR-QT-10 | A new customer shall be creatable inline during quote creation. | Doc | Must |
| FR-SO-1 | An accepted quote shall be convertible into a Sales Order. | Doc | Should |
| FR-DC-1 | Delivery challans shall record material sent to site and feed the Running Bill. | Doc | Must |
| FR-PAY-1 | Payments shall be recorded against a customer with date/amount/mode/reference. | Doc | Must |
| FR-ADM-1 | Admin Panel shall provide user management, role assignment, and audit logs. | Doc | Should |

### 5.3 Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-UX-1 | UI shall follow the Japanese minimal monochrome design system (Noto Serif JP headings, hairline borders, whitespace). |
| NFR-PERF-1 | List views shall paginate/virtualise; report generation for ≤10k rows shall complete <3s. |
| NFR-SEC-1 | Row-Level Security (RLS) enforced at the database; no client may read/write outside its permitted scope. |
| NFR-SEC-2 | All money and stock mutations shall be auditable (who/when/what/old→new). |
| NFR-DATA-1 | Monetary amounts stored in INR with appropriate precision (numeric/decimal, not float). |
| NFR-DATA-2 | Images/logos stored in object storage (Supabase Storage), referenced by URL — not base64 in rows. |
| NFR-AVAIL-1 | Target 99.5% availability; daily automated backups. |
| NFR-I18N-1 | Currency display ₹ (INR); dates ISO-8601 stored, locale-formatted in UI. |
| NFR-AUDIT-1 | Immutable audit trail for stock, pricing overrides, discounts, and payments. |

---

## 6. Database Entities (Conceptual Data Model)

> Currency fields = `numeric(14,2)`. Stock/qty = `numeric(14,3)`. All tables include `id (uuid)`, `created_at`, `updated_at`, `created_by`. Soft-delete via `deleted_at` where appropriate. `org_id` included for multi-tenant readiness (single org for now).

### 6.1 Identity & Access
- **users** — `id, email, full_name, phone, status, last_login_at` (mirrors Supabase `auth.users`).
- **roles** — `id, key, name, description`.
- **permissions** — `id, key, description` (e.g. `stock.adjust`, `quote.create`).
- **role_permissions** — `role_id, permission_id`.
- **user_roles** — `user_id, role_id`.
- **audit_logs** — `id, actor_id, entity_type, entity_id, action, before (jsonb), after (jsonb), at`.

### 6.2 Catalogue / Inventory
- **item_families** — `id, name` (e.g. "GI Pipe"). *(optional normalisation of `family`)*
- **brands** — `id, name`.
- **units** — `id, code` (SQM, MTR, NOS, BOX, KG…).
- **suppliers** — `id, name, contact, phone, email, gstin, address`.
- **items** —
  `id, parent_id (self-fk, null for parents), family_id, name, variant_label, brand_id, unit_id, image_url,`
  `is_imported (bool), is_template (bool), purchase_price, selling_price, stock, delivery_days,`
  `last_purchase_price, last_purchase_date, last_supplier_id,`
  *import fields:* `import_currency (USD/EUR/CNY), import_price, exchange_rate, import_discount_pct, transport_type (lumpsum/percent), transport_value, custom_duty_pct, profit_multiplier`.
- **item_variations** *(optional spec table for parents)* — `id, item_id, size, make, finish, brand`.
- **stock_adjustments** — `id, item_id, type (add/sub), qty, reason, adjusted_by, at`.
- **stock_movements** *(sales/issue history)* — `id, item_id, date, qty, value, customer_id, challan_id`.

### 6.3 Customers & Receivables
- **customers** —
  `id, name, status (active/inactive), contact_person, phone, email, gstin, pan,`
  `billing_name, billing_address, delivery_name, delivery_address, same_as_billing (bool), notes,`
  `post_sale_discount`.
- **payments** — `id, customer_id, date, amount, mode (NEFT/RTGS/Cheque/Cash/UPI), reference, notes`.

### 6.4 Quotations
- **quotes** —
  `id, ref_no, revision, parent_quote_id (revision chain), status (draft/sent/accepted/revised/cancelled),`
  `date, subject, customer_id, company_logo_url,`
  `gst_pct, gst_mode (yes/incl/no), transport, transport_note,`
  `total_mode (grand/each/both), show_boq (bool)`.
- **quote_locations** — `id, quote_id, name, sort_order, selected (bool)`.
- **quote_location_installation** — `quote_location_id, enabled, mode (lumpsum/percent/perunit), lumpsum, percent, perunit, note`.
- **quote_items** — `id, quote_location_id, item_id (nullable ref to catalogue), name, brand, unit, rate, qty, discount_pct, image_url, sort_order`.
- **quote_item_options** *(alternates)* — `id, quote_item_id, name, brand, unit, rate, image_url`.
- **quote_terms** — `id, quote_id, category (Delivery/GST/Payment/Warranty/Installation/Exclusion/Other), text, sort_order`.

### 6.5 Sales Orders, Challans (planned)
- **sales_orders** — `id, so_no, quote_id, customer_id, date, status, notes`.
- **sales_order_items** — `id, sales_order_id, item_id, name, unit, rate, qty, discount_pct`.
- **delivery_challans** — `id, challan_no, customer_id, sales_order_id (nullable), date, delivery_address, discount, notes`.
- **delivery_challan_items** — `id, challan_id, item_id, name, qty, unit, rate, value`.

### 6.6 Back-office (planned, outline)
- **employees, leave_requests, appraisals** (HR)
- **expenses, expense_approvals, budgets, payroll_runs** (Finance)
- **shipments, vendors** (Logistics)
- **tickets, ticket_events** (Customer Service)

### 6.7 Key Relationships
```
customers 1──* quotes 1──* quote_locations 1──* quote_items 1──* quote_item_options
customers 1──* sales_orders 1──* delivery_challans 1──* delivery_challan_items
customers 1──* payments
items (parent) 1──* items (variants)
items 1──* stock_adjustments / stock_movements
suppliers 1──* items
Running Bill(customer) = Σ challan_item.value − post_sale_discount − Σ payments.amount
```

---

## 7. Core Calculation Specifications (must be reproduced exactly)

### 7.1 Import Landed-Cost Calculator
```
base       = import_price × exchange_rate
afterDisc  = base × (1 − import_discount_pct/100)
transport  = (transport_type == 'lumpsum') ? transport_value
                                            : afterDisc × transport_value/100
withTrans  = afterDisc + transport
costPrice  = withTrans × (1 + custom_duty_pct/100)      // stored as purchase_price
sellPrice  = costPrice × profit_multiplier               // stored as selling_price
```

### 7.2 Quote Totals
```
lineTotal(item)      = rate × qty × (1 − discount_pct/100)
installAmt(loc)      = enabled ? switch(mode):
                         lumpsum → lumpsum
                         percent → itemsSubtotal(loc) × percent/100
                         perunit → Σ(item.qty) × perunit
                       : 0
locationTotal(loc)   = itemsSubtotal(loc) + installAmt(loc)
selectedLocations    = locations.filter(selected !== false)
quoteSubtotal        = Σ locationTotal(selectedLocations)
gstAmount            = (gst_mode in ['no','incl']) ? 0 : quoteSubtotal × gst_pct/100
grandTotal           = quoteSubtotal + gstAmount + transport
```
Optional/alternate items are **never** included in any subtotal.

### 7.3 Running Bill (per customer)
```
totalBilled  = Σ over challans Σ over items (qty × rate)   // = Σ challan_item.value
totalPaid    = Σ payments.amount
outstanding  = totalBilled − post_sale_discount − totalPaid
```

---

## 8. Permissions Matrix

Actions per role. ✅ = allowed, 👁 = read-only, ⚙ = with approval, — = no access. (Sales = Sales/Employee.)

| Capability | Super Admin | Admin | Sales | Inventory | Finance | HR | Logistics | Cust. Service | Viewer |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 👁 |
| Items: view | ✅ | ✅ | ✅ | ✅ | 👁 | — | 👁 | 👁 | 👁 |
| Items: create/edit | ✅ | ✅ | — | ✅ | — | — | — | — | — |
| Items: **adjust stock** | ✅ | ✅ | — | ✅ | — | — | — | — | — |
| Items: set/override pricing | ✅ | ✅ | — | ✅ | ⚙ | — | — | — | — |
| Stock Reports: view/export | ✅ | ✅ | ✅ | ✅ | ✅ | — | 👁 | — | 👁 |
| Customers: view | ✅ | ✅ | ✅ | 👁 | ✅ | — | 👁 | ✅ | 👁 |
| Customers: create/edit | ✅ | ✅ | ✅ | — | ✅ | — | — | ⚙ | — |
| Running Bill: view | ✅ | ✅ | ✅ | — | ✅ | — | — | 👁 | 👁 |
| Post-sale discount | ✅ | ✅ | ⚙ | — | ✅ | — | — | — | — |
| Quotes: create/edit | ✅ | ✅ | ✅ | — | 👁 | — | — | — | 👁 |
| Quotes: revise | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| Sales Orders: create | ✅ | ✅ | ✅ | — | 👁 | — | 👁 | — | — |
| Delivery Challans: create | ✅ | ✅ | ✅ | ✅ | 👁 | — | ✅ | — | — |
| Payments: record | ✅ | ✅ | ⚙ | — | ✅ | — | — | — | — |
| Finance / P&L | ✅ | ✅ | — | — | ✅ | — | — | — | 👁 |
| HR module | ✅ | ⚙ | — | — | — | ✅ | — | — | — |
| Logistics module | ✅ | ✅ | — | 👁 | — | — | ✅ | — | — |
| Customer Service / Tickets | ✅ | ✅ | 👁 | — | — | — | — | ✅ | 👁 |
| Admin: users/roles | ✅ | ⚙ | — | — | — | — | — | — | — |
| Admin: audit logs | ✅ | ✅ | — | — | 👁 | — | — | — | — |
| Company settings | ✅ | ⚙ | — | — | — | — | — | — | — |

> Enforced in two layers: **Supabase RLS policies** (source of truth) + **UI gating** (Zod-validated permission keys) for UX.

---

## 9. Missing Requirements, Gaps & Assumptions

### 9.1 Gaps to confirm with stakeholder
1. **Auth specifics:** SSO? Email+password vs. user-ID login? Password reset / MFA? *(Assumption: Supabase email/password + role claims; user-ID maps to email.)*
2. **Multi-tenant vs single org:** schema is multi-tenant-ready (`org_id`) but assumed **single organisation** for v1.
3. **Numbering schemes:** auto-format for quote refs (`QT-YYYY-NNN`), SO, challan, payment receipt numbers — need exact masks and reset cadence (yearly?).
4. **GST/tax engine:** Are CGST/SGST/IGST split required on invoices? HSN codes per item? Currently a single GST % — likely insufficient for compliant invoices.
5. **Invoicing / Tax Invoice module:** the doc covers quotes & challans but **not a formal GST Tax Invoice**. Likely required between challan and payment. *(Flagged as a probable missing module.)*
6. **Purchase / Procurement & PO:** items have `last_purchase_price`/`supplier` but no purchase entry workflow — needed to drive stock-in and costing.
7. **Inventory accuracy:** does delivering a challan **auto-decrement stock**? Is there reservation on SO? *(Assumption: challan posting decrements stock and writes a stock_movement.)*
8. **Currency rounding rules** and per-line vs invoice-level rounding.
9. **WhatsApp PDF (known limitation):** browser `wa.me` cannot attach files — confirmed in prototype. Production fully-automatic send requires **WhatsApp Business API** (Twilio/Wati/Interakt) on the server. *(Assumption: v1 uses download-then-attach UX; server API is a Phase-4 enhancement.)*
10. **Email delivery:** mailto vs server-sent email with PDF attachment. *(Assumption: server-side transactional email — Resend/Supabase Edge Function — sends PDFs as attachments.)*
11. **File storage limits:** product images & logos must move from base64 to Supabase Storage with size/type validation.
12. **Reporting depth:** beyond stock — sales reports, receivables ageing, P&L, GST returns. Scope TBD.
13. **Concurrency & audit:** who can override prices/discounts and is approval required? *(Assumption: ⚙ approval flows for discounts/pricing as in matrix.)*
14. **Localisation:** single language (English) + ₹ assumed; Japanese is aesthetic only, not i18n.
15. **Offline / mobile:** prototypes are desktop-web; mobile responsiveness assumed required (field/site use), offline not required for v1.

### 9.2 Explicit Assumptions (carried into architecture)
- Single organisation, India, INR, GST regime.
- Stock is decremented on challan posting; quotes/SOs do not move stock.
- Money stored as `numeric`, never float; rounding at 2 decimals, INR.
- Images in Supabase Storage; rows store URLs.
- Audit logging is mandatory for stock, pricing, discounts, payments.
- RLS is the security source of truth; the Next.js layer never trusts the client.

---

## 10. Recommended Architecture

### 10.1 Stack (as requested)
| Concern | Choice | Role |
|---|---|---|
| Framework | **Next.js (App Router)** | SSR/RSC, route handlers, layouts |
| Language | **TypeScript** (strict) | End-to-end type safety |
| DB & Auth & Storage | **Supabase** (Postgres + Auth + Storage + RLS + Edge Functions) | Backend platform |
| ORM | **Drizzle ORM** | Typed schema, migrations, queries |
| Server state | **React Query (TanStack Query)** | Caching, mutations, optimistic updates |
| Forms | **React Hook Form** | Complex nested forms (quotes!) |
| Validation | **Zod** | Schema validation, shared client/server types |
| Styling | **Tailwind CSS** | Design tokens for the monochrome theme |
| Components | **shadcn/ui** | Accessible primitives, themed to Japanese-minimal |
| PDF | **@react-pdf/renderer** (server) or jsPDF (client) | Data-driven PDFs with locked layout |

### 10.2 High-Level Topology
```
┌──────────────────────────────────────────────────────────────┐
│  Next.js (App Router)                                          │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ RSC pages  │  │ Client comps │  │ Route Handlers / Actions│ │
│  │ (read data)│  │ (RHF + RQ)   │  │ (mutations, PDF, email) │ │
│  └─────┬──────┘  └──────┬───────┘  └───────────┬────────────┘ │
│        │ Drizzle (server-only)                 │ Zod-validated │
└────────┼─────────────────────────────────────-─┼──────────────┘
         ▼                                        ▼
┌──────────────────────────────────────────────────────────────┐
│ Supabase: Postgres (+RLS)  •  Auth  •  Storage  •  Edge Funcs  │
│ (WhatsApp/Email integrations, scheduled jobs)                  │
└──────────────────────────────────────────────────────────────┘
```

### 10.3 Project Structure (proposed)
```
src/
  app/
    (auth)/login/
    (app)/
      dashboard/
      items/            items/[id]/   items/new/
      stock-reports/
      customers/        customers/[id]/
      quotes/           quotes/[id]/  quotes/new/
      sales-orders/  challans/  payments/
      finance/  hr/  logistics/  support/
      admin/            admin/users/  admin/audit/
    api/                # route handlers: pdf, email, whatsapp, webhooks
  components/ui/        # shadcn/ui (themed)
  components/<domain>/  # quote-builder, item-form, running-bill, ...
  db/
    schema/             # Drizzle table definitions (one file per domain)
    migrations/
    queries/            # typed query helpers (server-only)
  lib/
    auth/  rbac/        # permission keys + guards
    calc/               # import-cost, quote-totals, running-bill (pure, unit-tested)
    pdf/                # quote PDF, BOQ, stock report (data-driven, locked columns)
    supabase/           # server & browser clients
  schemas/              # Zod schemas (shared validation + inferred types)
  hooks/                # React Query hooks per entity
```

### 10.4 Key Patterns
- **Data flow:** RSC reads via Drizzle (server) → serialized to client → React Query manages mutations & cache invalidation. Mutations go through Server Actions / route handlers, validated by **Zod**, executed via **Drizzle**, authorised by **RLS**.
- **Forms:** the **Quote Builder** is the hardest form (nested locations → items → options + installation). Use **React Hook Form `useFieldArray`** (nested) + Zod resolver; live totals via derived `watch()` selectors mirroring §7.2 exactly.
- **Calculations** live in `lib/calc/` as **pure functions** with unit tests, shared by UI (live preview) and PDF (print) — guaranteeing the preview and the PDF agree (the recurring prototype bug).
- **PDF** generated **from data, not DOM** (the lesson from the prototypes) with fixed column widths.
- **RBAC:** permission keys (`stock.adjust`, `quote.revise`, …) checked in UI for gating **and** enforced by RLS policies in Postgres.
- **Audit:** Postgres triggers (or a Drizzle mutation wrapper) write `audit_logs` for stock, pricing, discount, and payment changes.

---

## 11. Development Roadmap

### Phase 0 — Foundation (Week 1–2)
- Repo, Next.js + TS + Tailwind + shadcn/ui scaffold; **monochrome design tokens** (Noto Serif JP, hairline borders).
- Supabase project; Drizzle schema for identity/access; migrations pipeline.
- **Auth + RBAC** (login, role claims, route guards) + **RLS baseline**.
- App shell: sidebar nav (role-gated), layout, design system primitives.

### Phase 1 — Inventory Core (Week 3–5)
- `items` schema + Drizzle queries; Supabase Storage for images.
- **Items module:** catalogue, detail, create/edit, **variations-as-items**, **import landed-cost calculator** (`lib/calc`, unit-tested).
- **Stock adjustments** (admin-only) + audit log + stock movement history.
- **Stock Reports** module: hierarchical filters, date range, totals, **data-driven PDF** (locked columns), Print/Save/Email/WhatsApp-download flows.

### Phase 2 — Customers & Quotes (Week 6–9)
- **Customers module:** list, billing/delivery split, detail metrics.
- **Quote Builder:** multi-location, line items, **alternates**, **per-location installation**, **GST modes**, **per-area selection**, **total-display modes**, terms, **revisions**, inline new-customer.
- **Quote/BOQ PDF** (data-driven, locked columns); preview.
- Calc parity tests (preview == PDF).

### Phase 3 — Order-to-Cash (Week 10–12)
- **Sales Orders** (from accepted quotes).
- **Delivery Challans** (post → decrement stock + stock_movement).
- **Payments** recording.
- **Running Bill** ledger assembled from challans + discount + payments; receivables view.
- (Likely) **Tax Invoice** module + GST split — confirm scope (§9.1).

### Phase 4 — Communication & Reporting (Week 13–14)
- Server-side **email with PDF attachment** (Edge Function / Resend).
- **WhatsApp Business API** integration for true PDF send (Twilio/Wati/Interakt).
- Receivables ageing, sales reports, dashboards expanded.

### Phase 5 — Back-office Modules (Week 15+)
- **Finance / P&L**, **HR**, **Logistics**, **Customer Service** — iteratively, each behind RBAC.
- **Admin Panel:** user/role management UI, audit-log viewer, company settings.

### Phase 6 — Hardening
- Performance (pagination/virtualisation), E2E tests, accessibility, backups/DR, observability, security review (RLS coverage audit).

---

## 12. Module Hierarchy (Sitemap)
```
Watcon Management Software
├── Auth (login)
├── Dashboard
├── Sales & CRM
│   ├── Customers ──> Running Bill, Payments(view), linked Quotes/SO/Challans
│   ├── Quotes ──(accept)──> Sales Orders ──> Delivery Challans
│   └── Payments
├── Inventory
│   ├── Items (catalogue, variations, import calculator)
│   ├── Stock Adjustments (admin)
│   └── Stock Reports
├── Finance
│   ├── Running Bills / Receivables
│   ├── Expenses & Approvals, Budgets, Payroll
│   └── P&L, GST Reports
├── Operations
│   ├── Logistics (shipments, vendors)
│   └── Customer Service (tickets, SLA)
├── HR (employees, leave, appraisals, onboarding)
└── Administration
    ├── Users & Roles
    ├── Permissions
    ├── Audit Logs
    └── Company Settings
```

---

## 13. Traceability Summary
Every Must-priority requirement in §5.2 maps to: a prototype source file (validated UX), a database entity (§6), a calculation spec (§7) where applicable, a role in the permissions matrix (§8), and a roadmap phase (§11). Gaps and assumptions (§9) are the open items to confirm before Phase 2–3 implementation.

---

*End of PROJECT_PLAN.md — planning artifact only. No application code has been written. Next step: stakeholder review of §9 open questions, then begin Phase 0.*
