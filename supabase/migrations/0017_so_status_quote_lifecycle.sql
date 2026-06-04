-- 0017_so_status_quote_lifecycle.sql
-- Realign Sales Order status to the quote lifecycle.
--
-- Old statuses: confirmed, processing, ready, dispatched, delivered,
--               invoiced, closed, cancelled.
-- New statuses: draft, sent, accepted, revised, cancelled  (same as quotes).
--
-- Delivery progress (dispatched/delivered) now lives on delivery challans, and
-- billing progress lives on invoices / running invoices — those flows are
-- decoupled from SO status and no longer mutate it.
--
-- Data mapping: 'cancelled' stays 'cancelled'; every other old status maps to
-- 'accepted' (the order is live). Default for new rows becomes 'accepted'.

-- ── 1. Drop the old CHECK constraint and default ──────────────────────────────

alter table public.sales_orders
  drop constraint if exists sales_orders_status_check;

alter table public.sales_orders
  alter column status drop default;

-- ── 2. Remap existing data BEFORE applying the new constraint ──────────────────

update public.sales_orders
set status = case
  when status = 'cancelled' then 'cancelled'
  else 'accepted'
end;

-- ── 3. Apply the new default + CHECK constraint ───────────────────────────────

alter table public.sales_orders
  alter column status set default 'accepted';

alter table public.sales_orders

  add constraint sales_orders_status_check
  check (status in ('draft', 'sent', 'accepted', 'revised', 'cancelled'));

-- Note: so_status_history.from_status / to_status are free-text audit records
-- and intentionally keep their historical values (no constraint to update).