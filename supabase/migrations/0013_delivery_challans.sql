-- 0013_delivery_challans.sql
-- Delivery Challans module: delivery_challans, dc_items, dc_status_history.
-- A DC can only be created from an 'issued' invoice when ALL items have
-- sufficient stock. Stock is deducted atomically when DC is dispatched.
-- Uses existing challans.* permissions from 0003.
-- RLS uses app.is_member / app.has_permission helpers from 0002.

-- ── delivery_challans ─────────────────────────────────────────────────────────

create table public.delivery_challans (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null references public.organizations(id) on delete restrict,
  dc_no               text        not null,
  invoice_id          uuid        not null references public.invoices(id) on delete restrict,
  customer_id         uuid        references public.customers(id) on delete set null,
  so_id               uuid        references public.sales_orders(id) on delete set null,
  subject             text,
  date                date        not null default current_date,
  dispatch_date       date,
  expected_delivery   date,
  status              text        not null default 'draft'
                                  check (status in ('draft','dispatched','delivered','cancelled')),
  -- Dispatch logistics
  vehicle_no          text,
  driver_name         text,
  lr_no               text,
  transporter_name    text,
  delivery_address    text,
  site_contact_name   text,
  site_contact_phone  text,
  -- Document
  notes               text,
  internal_notes      text,
  -- Stock deduction tracking (idempotency guard)
  stock_deducted      boolean     not null default false,
  stock_deducted_at   timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid,
  deleted_at          timestamptz
);

create unique index uq_dc_no
  on public.delivery_challans (org_id, dc_no)
  where deleted_at is null;

create index idx_dc_org      on public.delivery_challans (org_id);
create index idx_dc_invoice  on public.delivery_challans (invoice_id);
create index idx_dc_customer on public.delivery_challans (customer_id);
create index idx_dc_so       on public.delivery_challans (so_id);
create index idx_dc_status   on public.delivery_challans (status);
create index idx_dc_date     on public.delivery_challans (date);

-- ── dc_items ──────────────────────────────────────────────────────────────────

create table public.dc_items (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null,
  dc_id               uuid        not null references public.delivery_challans(id) on delete cascade,
  invoice_item_id     uuid        references public.invoice_items(id) on delete set null,
  item_id             uuid        references public.items(id) on delete set null,
  name                text        not null,
  description         text,
  hsn_code            text,
  brand               text,
  unit                text,
  -- Quantities
  invoice_qty         numeric     not null default 0,
  qty_dispatched      numeric     not null default 0
                                  check (qty_dispatched >= 0),
  -- Stock snapshot at DC creation (for audit/reference)
  stock_at_creation   numeric     not null default 0,
  sort_order          integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_dc_items_dc   on public.dc_items (dc_id);
create index idx_dc_items_item on public.dc_items (item_id);

-- ── dc_status_history ─────────────────────────────────────────────────────────

create table public.dc_status_history (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null,
  dc_id       uuid        not null references public.delivery_challans(id) on delete cascade,
  from_status text,
  to_status   text        not null,
  note        text,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);

create index idx_dc_history_dc  on public.dc_status_history (dc_id);
create index idx_dc_history_org on public.dc_status_history (org_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────

create trigger tg_dc_updated_at
  before update on public.delivery_challans
  for each row execute function app.fn_set_updated_at();

create trigger tg_dc_items_updated_at
  before update on public.dc_items
  for each row execute function app.fn_set_updated_at();

-- ── audit triggers ────────────────────────────────────────────────────────────

do $$ begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'fn_audit'
  ) then
    execute $t$
      create trigger tg_dc_audit
        after insert or update or delete on public.delivery_challans
        for each row execute function app.fn_audit();
      create trigger tg_dc_items_audit
        after insert or update or delete on public.dc_items
        for each row execute function app.fn_audit();
    $t$;
  end if;
end $$;

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.delivery_challans enable row level security;
alter table public.dc_items          enable row level security;
alter table public.dc_status_history enable row level security;

-- delivery_challans
create policy "dc: members can select"
  on public.delivery_challans for select
  using (app.is_member(org_id) and deleted_at is null);
create policy "dc: members can insert"
  on public.delivery_challans for insert
  with check (app.has_permission('challans.create', org_id));
create policy "dc: members can update"
  on public.delivery_challans for update
  using  ((app.has_permission('challans.edit', org_id) or app.has_permission('challans.post', org_id)) and deleted_at is null)
  with check (app.has_permission('challans.edit', org_id) or app.has_permission('challans.post', org_id));
create policy "dc: members can delete"
  on public.delivery_challans for delete
  using (app.has_permission('challans.delete', org_id));

-- dc_items
create policy "dc_items: members can select"
  on public.dc_items for select using (app.is_member(org_id));
create policy "dc_items: members can insert"
  on public.dc_items for insert with check (app.has_permission('challans.create', org_id));
create policy "dc_items: members can update"
  on public.dc_items for update
  using  (app.has_permission('challans.edit', org_id))
  with check (app.has_permission('challans.edit', org_id));
create policy "dc_items: members can delete"
  on public.dc_items for delete using (app.has_permission('challans.edit', org_id));

-- dc_status_history
create policy "dc_history: members can select"
  on public.dc_status_history for select using (app.is_member(org_id));
create policy "dc_history: members can insert"
  on public.dc_status_history for insert
  with check (app.has_permission('challans.edit', org_id) or app.has_permission('challans.post', org_id));
