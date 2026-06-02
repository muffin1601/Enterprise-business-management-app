-- 0009_sales_orders.sql
-- Sales Orders module: sales_orders, so_locations, so_items, so_status_history.
-- A sales order can ONLY be created from a quote with status = 'accepted'.
-- Enforced via: unique index on quote_id + check in server action.
-- RLS uses app.is_member / app.has_permission helpers from 0002.
-- Audit coverage via app.fn_audit trigger (0004).

-- ── sales_orders ──────────────────────────────────────────────────────────────

create table public.sales_orders (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null references public.organizations(id) on delete restrict,
  so_no               text        not null,
  quote_id            uuid        not null references public.quotes(id) on delete restrict,
  customer_id         uuid        references public.customers(id) on delete set null,
  subject             text,
  date                date        not null default current_date,
  expected_delivery   date,
  status              text        not null default 'confirmed'
                                  check (status in (
                                    'confirmed',
                                    'processing',
                                    'ready',
                                    'dispatched',
                                    'delivered',
                                    'invoiced',
                                    'closed',
                                    'cancelled'
                                  )),
  priority            text        not null default 'normal'
                                  check (priority in ('low','normal','high','urgent')),
  -- Financial snapshot (immutable after creation)
  gst_mode            text        not null default 'add'
                                  check (gst_mode in ('add','inclusive','none')),
  gst_pct             numeric     not null default 18,
  transport           numeric     not null default 0,
  transport_note      text,
  material_subtotal   numeric     not null default 0,
  gst_amount          numeric     not null default 0,
  grand_total         numeric     not null default 0,
  -- Advance payment tracking
  advance_amount      numeric     not null default 0,
  advance_received    boolean     not null default false,
  advance_date        date,
  advance_note        text,
  -- Delivery
  delivery_address    text,
  site_contact_name   text,
  site_contact_phone  text,
  -- Documents & notes
  notes               text,
  terms               jsonb       not null default '[]',
  internal_notes      text,
  logo_url            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid,
  deleted_at          timestamptz
);

-- One SO per accepted quote (soft-delete aware)
create unique index uq_so_no
  on public.sales_orders (org_id, so_no)
  where deleted_at is null;

create unique index uq_so_quote
  on public.sales_orders (quote_id)
  where deleted_at is null;

create index idx_so_org      on public.sales_orders (org_id);
create index idx_so_customer on public.sales_orders (customer_id);
create index idx_so_status   on public.sales_orders (status);
create index idx_so_quote    on public.sales_orders (quote_id);
create index idx_so_date     on public.sales_orders (date);

-- ── so_locations ──────────────────────────────────────────────────────────────

create table public.so_locations (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null,
  so_id               uuid        not null references public.sales_orders(id) on delete cascade,
  quote_location_id   uuid        references public.quote_locations(id) on delete set null,
  name                text        not null default 'Location 1',
  sort_order          integer     not null default 0,
  is_included         boolean     not null default true,
  material_subtotal   numeric     not null default 0,
  installation_charge numeric     not null default 0,
  installation_note   text,
  location_total      numeric     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_so_locations_so  on public.so_locations (so_id);
create index idx_so_locations_org on public.so_locations (org_id);

-- ── so_items ─────────────────────────────────────────────────────────────────

create table public.so_items (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null,
  so_id               uuid        not null references public.sales_orders(id) on delete cascade,
  location_id         uuid        not null references public.so_locations(id) on delete cascade,
  quote_item_id       uuid        references public.quote_items(id) on delete set null,
  item_id             uuid        references public.items(id) on delete set null,
  name                text        not null,
  description         text,
  brand               text,
  unit                text,
  rate                numeric     not null default 0,
  qty                 numeric     not null default 1,
  qty_delivered       numeric     not null default 0,
  discount_pct        numeric     not null default 0,
  taxable_value       numeric     not null default 0,
  total               numeric     not null default 0,
  sort_order          integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_so_items_so       on public.so_items (so_id);
create index idx_so_items_location on public.so_items (location_id);
create index idx_so_items_org      on public.so_items (org_id);
create index idx_so_items_item     on public.so_items (item_id);

-- ── so_status_history ─────────────────────────────────────────────────────────

create table public.so_status_history (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null,
  so_id       uuid        not null references public.sales_orders(id) on delete cascade,
  from_status text,
  to_status   text        not null,
  note        text,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);

create index idx_so_history_so  on public.so_status_history (so_id);
create index idx_so_history_org on public.so_status_history (org_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────

create trigger tg_so_updated_at
  before update on public.sales_orders
  for each row execute function app.fn_set_updated_at();

create trigger tg_so_locations_updated_at
  before update on public.so_locations
  for each row execute function app.fn_set_updated_at();

create trigger tg_so_items_updated_at
  before update on public.so_items
  for each row execute function app.fn_set_updated_at();

-- ── audit triggers ────────────────────────────────────────────────────────────
do $$ begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'fn_audit'
  ) then
    execute $t$
      create trigger tg_so_audit
        after insert or update or delete on public.sales_orders
        for each row execute function app.fn_audit();
      create trigger tg_so_locations_audit
        after insert or update or delete on public.so_locations
        for each row execute function app.fn_audit();
      create trigger tg_so_items_audit
        after insert or update or delete on public.so_items
        for each row execute function app.fn_audit();
    $t$;
  end if;
end $$;

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.sales_orders     enable row level security;
alter table public.so_locations     enable row level security;
alter table public.so_items         enable row level security;
alter table public.so_status_history enable row level security;

-- sales_orders
create policy "so: members can select"
  on public.sales_orders for select
  using (app.is_member(org_id) and deleted_at is null);

create policy "so: members can insert"
  on public.sales_orders for insert
  with check (app.has_permission('sales_orders.create', org_id));

create policy "so: members can update"
  on public.sales_orders for update
  using  (app.has_permission('sales_orders.edit', org_id) and deleted_at is null)
  with check (app.has_permission('sales_orders.edit', org_id));

create policy "so: members can delete"
  on public.sales_orders for delete
  using (app.has_permission('sales_orders.delete', org_id));

-- so_locations
create policy "so_locations: members can select"
  on public.so_locations for select
  using (app.is_member(org_id));

create policy "so_locations: members can insert"
  on public.so_locations for insert
  with check (app.has_permission('sales_orders.create', org_id));

create policy "so_locations: members can update"
  on public.so_locations for update
  using  (app.has_permission('sales_orders.edit', org_id))
  with check (app.has_permission('sales_orders.edit', org_id));

create policy "so_locations: members can delete"
  on public.so_locations for delete
  using (app.has_permission('sales_orders.delete', org_id));

-- so_items
create policy "so_items: members can select"
  on public.so_items for select
  using (app.is_member(org_id));

create policy "so_items: members can insert"
  on public.so_items for insert
  with check (app.has_permission('sales_orders.create', org_id));

create policy "so_items: members can update"
  on public.so_items for update
  using  (app.has_permission('sales_orders.edit', org_id))
  with check (app.has_permission('sales_orders.edit', org_id));

create policy "so_items: members can delete"
  on public.so_items for delete
  using (app.has_permission('sales_orders.delete', org_id));

-- so_status_history (append-only for members)
create policy "so_history: members can select"
  on public.so_status_history for select
  using (app.is_member(org_id));

create policy "so_history: members can insert"
  on public.so_status_history for insert
  with check (app.has_permission('sales_orders.edit', org_id));
