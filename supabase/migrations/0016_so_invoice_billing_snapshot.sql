-- 0016_so_invoice_billing_snapshot.sql
-- Per-document Bill To snapshot for Sales Orders and Invoices.
--
-- Rationale: clients sometimes ask to change billing / shipping / contact
-- details for a SPECIFIC order without touching the shared customer master
-- (which would retroactively change every other document for that customer).
-- We snapshot the Bill To details onto the document, mirroring how financials
-- are already snapshotted on sales_orders / invoices.
--
-- Ship To (delivery_address / site_contact_name / site_contact_phone) already
-- exists on sales_orders; this migration only adds the Bill To snapshot.
-- All columns are nullable and backfilled, so existing rows and the
-- invoice-creation flow keep working unchanged.

-- ── 1. sales_orders: Bill To snapshot ─────────────────────────────────────────

alter table public.sales_orders
  add column if not exists bill_to_name    text,
  add column if not exists bill_to_address text,
  add column if not exists bill_to_phone   text,
  add column if not exists bill_to_email   text,
  add column if not exists bill_to_gstin   text;

-- Backfill from the customer master so existing SOs show the same Bill To
-- after the UI switches to reading the snapshot first.
update public.sales_orders so
set
  bill_to_name    = coalesce(so.bill_to_name,    nullif(c.billing_name, ''), c.name),
  bill_to_address = coalesce(so.bill_to_address, nullif(c.billing_address, '')),
  bill_to_phone   = coalesce(so.bill_to_phone,   c.phone),
  bill_to_email   = coalesce(so.bill_to_email,   c.email),
  bill_to_gstin   = coalesce(so.bill_to_gstin,   c.gstin)
from public.customers c
where so.customer_id = c.id
  and so.bill_to_name is null;

-- ── 2. invoices: Bill To snapshot ─────────────────────────────────────────────

alter table public.invoices
  add column if not exists bill_to_name    text,
  add column if not exists bill_to_address text,
  add column if not exists bill_to_phone   text,
  add column if not exists bill_to_email   text,
  add column if not exists bill_to_gstin   text;

-- Backfill invoices from their parent SO snapshot first, falling back to the
-- customer master for invoices created before the SO snapshot existed.
update public.invoices inv
set
  bill_to_name    = coalesce(inv.bill_to_name,    so.bill_to_name,    nullif(c.billing_name, ''), c.name),
  bill_to_address = coalesce(inv.bill_to_address, so.bill_to_address, nullif(c.billing_address, '')),
  bill_to_phone   = coalesce(inv.bill_to_phone,   so.bill_to_phone,   c.phone),
  bill_to_email   = coalesce(inv.bill_to_email,   so.bill_to_email,   c.email),
  bill_to_gstin   = coalesce(inv.bill_to_gstin,   so.bill_to_gstin,   c.gstin)
from public.sales_orders so
left join public.customers c on c.id = so.customer_id
where inv.so_id = so.id
  and inv.bill_to_name is null;
