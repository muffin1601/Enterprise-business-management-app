-- 0010_invoices.sql
-- Replaces the existing stub invoices/invoice_items tables with the full
-- SO-linked invoices module. Also drops legacy payments/payment_allocations
-- that were part of the old stub design.
-- Safe to run: all drops use IF EXISTS.

-- ── 1. Drop legacy tables (cascade removes their FKs, policies, indexes) ──────

drop table if exists public.payment_allocations  cascade;
drop table if exists public.payments             cascade;
drop table if exists public.invoice_items        cascade;
drop table if exists public.invoices             cascade;

-- Drop legacy enum type if it exists (our new design uses text + check)
drop type if exists public.invoice_status cascade;

-- ── 2. invoices ───────────────────────────────────────────────────────────────

create table public.invoices (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null references public.organizations(id) on delete restrict,
  invoice_no          text        not null,
  so_id               uuid        not null references public.sales_orders(id) on delete restrict,
  quote_id            uuid        references public.quotes(id) on delete set null,
  customer_id         uuid        references public.customers(id) on delete set null,
  subject             text,
  date                date        not null default current_date,
  due_date            date,
  status              text        not null default 'draft'
                                  check (status in (
                                    'draft',
                                    'issued',
                                    'paid',
                                    'partially_paid',
                                    'cancelled'
                                  )),
  -- GST
  place_of_supply     text,
  gst_mode            text        not null default 'add'
                                  check (gst_mode in ('add','inclusive','none')),
  gst_pct             numeric     not null default 18,
  is_igst             boolean     not null default false,
  -- Financials (snapshot, immutable after issued)
  taxable_value       numeric     not null default 0,
  transport           numeric     not null default 0,
  transport_note      text,
  cgst_amount         numeric     not null default 0,
  sgst_amount         numeric     not null default 0,
  igst_amount         numeric     not null default 0,
  total_gst           numeric     not null default 0,
  grand_total         numeric     not null default 0,
  -- Payment tracking (auto-updated by trigger)
  amount_paid         numeric     not null default 0,
  balance_due         numeric     not null default 0,
  payment_terms       text,
  -- Document
  notes               text,
  terms               jsonb       not null default '[]',
  logo_url            text,
  -- Issue metadata
  issued_at           timestamptz,
  issued_by           uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid,
  deleted_at          timestamptz
);

create unique index uq_invoice_no
  on public.invoices (org_id, invoice_no)
  where deleted_at is null;

-- One active invoice per SO (cancelled invoices don't block re-invoicing)
create unique index uq_invoice_so
  on public.invoices (so_id)
  where deleted_at is null and status != 'cancelled';

create index idx_inv_org      on public.invoices (org_id);
create index idx_inv_customer on public.invoices (customer_id);
create index idx_inv_so       on public.invoices (so_id);
create index idx_inv_quote    on public.invoices (quote_id);
create index idx_inv_status   on public.invoices (status);
create index idx_inv_date     on public.invoices (date);
create index idx_inv_due      on public.invoices (due_date);

-- ── 3. invoice_items ──────────────────────────────────────────────────────────

create table public.invoice_items (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null,
  invoice_id          uuid        not null references public.invoices(id) on delete cascade,
  so_item_id          uuid        references public.so_items(id) on delete set null,
  item_id             uuid        references public.items(id) on delete set null,
  name                text        not null,
  description         text,
  hsn_code            text,
  brand               text,
  unit                text,
  rate                numeric     not null default 0,
  qty                 numeric     not null default 1,
  discount_pct        numeric     not null default 0,
  taxable_value       numeric     not null default 0,
  gst_pct             numeric     not null default 18,
  cgst_pct            numeric     not null default 9,
  sgst_pct            numeric     not null default 9,
  igst_pct            numeric     not null default 0,
  cgst_amount         numeric     not null default 0,
  sgst_amount         numeric     not null default 0,
  igst_amount         numeric     not null default 0,
  total               numeric     not null default 0,
  sort_order          integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_inv_items_invoice on public.invoice_items (invoice_id);
create index idx_inv_items_org     on public.invoice_items (org_id);
create index idx_inv_items_so_item on public.invoice_items (so_item_id);
create index idx_inv_items_item    on public.invoice_items (item_id);

-- ── 4. invoice_payments ───────────────────────────────────────────────────────

create table public.invoice_payments (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null,
  invoice_id      uuid        not null references public.invoices(id) on delete cascade,
  amount          numeric     not null check (amount > 0),
  payment_date    date        not null default current_date,
  payment_mode    text        not null default 'bank_transfer'
                              check (payment_mode in ('cash','bank_transfer','cheque','upi','other')),
  reference_no    text,
  note            text,
  recorded_by     uuid,
  created_at      timestamptz not null default now()
);

create index idx_inv_payments_invoice on public.invoice_payments (invoice_id);
create index idx_inv_payments_org     on public.invoice_payments (org_id);

-- ── 5. invoice_status_history ─────────────────────────────────────────────────

create table public.invoice_status_history (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null,
  invoice_id  uuid        not null references public.invoices(id) on delete cascade,
  from_status text,
  to_status   text        not null,
  note        text,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);

create index idx_inv_history_invoice on public.invoice_status_history (invoice_id);
create index idx_inv_history_org     on public.invoice_status_history (org_id);

-- ── 6. Payment recalculation trigger ─────────────────────────────────────────

create or replace function app.fn_recalc_invoice_payment()
returns trigger language plpgsql security definer as $$
declare
  v_invoice_id uuid;
  v_paid       numeric;
  v_grand      numeric;
  v_balance    numeric;
  v_status     text;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);

  select coalesce(sum(amount), 0)
    into v_paid
    from public.invoice_payments
   where invoice_id = v_invoice_id;

  select grand_total, status
    into v_grand, v_status
    from public.invoices
   where id = v_invoice_id;

  v_balance := greatest(0, v_grand - v_paid);

  if v_status in ('issued', 'partially_paid') then
    if v_balance = 0 then
      v_status := 'paid';
    else
      v_status := 'partially_paid';
    end if;
  end if;

  update public.invoices
     set amount_paid = v_paid,
         balance_due = v_balance,
         status      = v_status,
         updated_at  = now()
   where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;

create trigger tg_invoice_payment_recalc
  after insert or delete on public.invoice_payments
  for each row execute function app.fn_recalc_invoice_payment();

-- ── 7. updated_at triggers ────────────────────────────────────────────────────

create trigger tg_invoices_updated_at
  before update on public.invoices
  for each row execute function app.fn_set_updated_at();

create trigger tg_invoice_items_updated_at
  before update on public.invoice_items
  for each row execute function app.fn_set_updated_at();

-- ── 8. Audit triggers ─────────────────────────────────────────────────────────

do $$ begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'fn_audit'
  ) then
    execute $t$
      create trigger tg_invoices_audit
        after insert or update or delete on public.invoices
        for each row execute function app.fn_audit();
      create trigger tg_invoice_items_audit
        after insert or update or delete on public.invoice_items
        for each row execute function app.fn_audit();
      create trigger tg_invoice_payments_audit
        after insert or delete on public.invoice_payments
        for each row execute function app.fn_audit();
    $t$;
  end if;
end $$;

-- ── 9. Row Level Security ─────────────────────────────────────────────────────

alter table public.invoices               enable row level security;
alter table public.invoice_items          enable row level security;
alter table public.invoice_payments       enable row level security;
alter table public.invoice_status_history enable row level security;

-- invoices
create policy "invoices: members can select"
  on public.invoices for select
  using (app.is_member(org_id) and deleted_at is null);

create policy "invoices: members can insert"
  on public.invoices for insert
  with check (app.has_permission('invoices.create', org_id));

create policy "invoices: members can update"
  on public.invoices for update
  using  (app.has_permission('invoices.edit', org_id) and deleted_at is null)
  with check (app.has_permission('invoices.edit', org_id));

create policy "invoices: members can delete"
  on public.invoices for delete
  using (app.has_permission('invoices.delete', org_id));

-- invoice_items
create policy "invoice_items: members can select"
  on public.invoice_items for select
  using (app.is_member(org_id));

create policy "invoice_items: members can insert"
  on public.invoice_items for insert
  with check (app.has_permission('invoices.create', org_id));

create policy "invoice_items: members can update"
  on public.invoice_items for update
  using  (app.has_permission('invoices.edit', org_id))
  with check (app.has_permission('invoices.edit', org_id));

create policy "invoice_items: members can delete"
  on public.invoice_items for delete
  using (app.has_permission('invoices.edit', org_id));

-- invoice_payments
create policy "invoice_payments: members can select"
  on public.invoice_payments for select
  using (app.is_member(org_id));

create policy "invoice_payments: members can insert"
  on public.invoice_payments for insert
  with check (app.has_permission('invoices.edit', org_id));

create policy "invoice_payments: members can delete"
  on public.invoice_payments for delete
  using (app.has_permission('invoices.edit', org_id));

-- invoice_status_history
create policy "invoice_history: members can select"
  on public.invoice_status_history for select
  using (app.is_member(org_id));

create policy "invoice_history: members can insert"
  on public.invoice_status_history for insert
  with check (app.has_permission('invoices.edit', org_id));
