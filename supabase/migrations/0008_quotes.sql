-- 0008_quotes.sql
-- Quotes module — quotes, quote_locations, quote_items.
-- RLS uses app.is_member / app.has_permission helpers from 0002.
-- Audit coverage via app.fn_audit trigger (0004).

-- ── quotes ───────────────────────────────────────────────────────────────────
create table public.quotes (
  id                    uuid        primary key default gen_random_uuid(),
  org_id                uuid        not null references public.organizations(id) on delete restrict,
  quote_no              text        not null,
  revision              integer     not null default 0,
  parent_id             uuid        references public.quotes(id) on delete set null,
  customer_id           uuid        references public.customers(id) on delete set null,
  subject               text,
  date                  date        not null default current_date,
  valid_until           date,
  status                text        not null default 'draft'
                                    check (status in ('draft','sent','accepted','revised','cancelled')),
  gst_mode              text        not null default 'add'
                                    check (gst_mode in ('add','inclusive','none')),
  gst_pct               numeric     not null default 18,
  transport             numeric     not null default 0,
  transport_note        text,
  logo_url              text,
  include_boq_summary   boolean     not null default true,
  notes                 text,
  terms                 jsonb       not null default '[]',
  material_subtotal     numeric     not null default 0,
  gst_amount            numeric     not null default 0,
  grand_total           numeric     not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid,
  updated_by            uuid,
  deleted_at            timestamptz
);

create unique index uq_quotes_no on public.quotes (org_id, quote_no) where deleted_at is null;
create index idx_quotes_org        on public.quotes (org_id);
create index idx_quotes_customer   on public.quotes (customer_id);
create index idx_quotes_status     on public.quotes (status);
create index idx_quotes_parent     on public.quotes (parent_id);

-- ── quote_locations ───────────────────────────────────────────────────────────
create table public.quote_locations (
  id                    uuid        primary key default gen_random_uuid(),
  org_id                uuid        not null,
  quote_id              uuid        not null references public.quotes(id) on delete cascade,
  name                  text        not null default 'Location 1',
  sort_order            integer     not null default 0,
  is_included           boolean     not null default true,
  material_subtotal     numeric     default 0,
  installation_charge   numeric     default 0,
  installation_note     text,
  location_total        numeric     default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_quote_locations_quote  on public.quote_locations (quote_id);
create index idx_quote_locations_org    on public.quote_locations (org_id);

-- ── quote_items ───────────────────────────────────────────────────────────────
create table public.quote_items (
  id                    uuid        primary key default gen_random_uuid(),
  org_id                uuid        not null,
  quote_id              uuid        not null references public.quotes(id) on delete cascade,
  location_id           uuid        not null references public.quote_locations(id) on delete cascade,
  item_id               uuid        references public.items(id) on delete set null,
  name                  text        not null,
  description           text,
  brand                 text,
  unit                  text,
  rate                  numeric     not null default 0,
  qty                   numeric     not null default 1,
  discount_pct          numeric     not null default 0,
  taxable_value         numeric     not null default 0,
  total                 numeric     not null default 0,
  sort_order            integer     not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_quote_items_quote     on public.quote_items (quote_id);
create index idx_quote_items_location  on public.quote_items (location_id);
create index idx_quote_items_org       on public.quote_items (org_id);
create index idx_quote_items_item      on public.quote_items (item_id);

-- ── updated_at helper (self-contained — safe if fn already exists) ────────────
create or replace function app.fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── updated_at triggers ───────────────────────────────────────────────────────
create trigger tg_quotes_updated_at
  before update on public.quotes
  for each row execute function app.fn_set_updated_at();

create trigger tg_quote_locations_updated_at
  before update on public.quote_locations
  for each row execute function app.fn_set_updated_at();

create trigger tg_quote_items_updated_at
  before update on public.quote_items
  for each row execute function app.fn_set_updated_at();

-- ── audit triggers (skip gracefully if app.fn_audit doesn't exist) ────────────
do $$ begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'fn_audit'
  ) then
    execute $t$
      create trigger tg_quotes_audit
        after insert or update or delete on public.quotes
        for each row execute function app.fn_audit();
      create trigger tg_quote_locations_audit
        after insert or update or delete on public.quote_locations
        for each row execute function app.fn_audit();
      create trigger tg_quote_items_audit
        after insert or update or delete on public.quote_items
        for each row execute function app.fn_audit();
    $t$;
  end if;
end $$;

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table public.quotes          enable row level security;
alter table public.quote_locations enable row level security;
alter table public.quote_items     enable row level security;

-- quotes policies
create policy "quotes: members can select"
  on public.quotes for select
  using (app.is_member(org_id) and deleted_at is null);

create policy "quotes: members can insert"
  on public.quotes for insert
  with check (app.has_permission('quotes.create', org_id));

create policy "quotes: members can update"
  on public.quotes for update
  using  (app.has_permission('quotes.edit', org_id) and deleted_at is null)
  with check (app.has_permission('quotes.edit', org_id));

create policy "quotes: members can delete"
  on public.quotes for delete
  using (app.has_permission('quotes.delete', org_id));

-- quote_locations policies
create policy "quote_locations: members can select"
  on public.quote_locations for select
  using (app.is_member(org_id));

create policy "quote_locations: members can insert"
  on public.quote_locations for insert
  with check (app.has_permission('quotes.create', org_id));

create policy "quote_locations: members can update"
  on public.quote_locations for update
  using  (app.has_permission('quotes.edit', org_id))
  with check (app.has_permission('quotes.edit', org_id));

create policy "quote_locations: members can delete"
  on public.quote_locations for delete
  using (app.has_permission('quotes.delete', org_id));

-- quote_items policies
create policy "quote_items: members can select"
  on public.quote_items for select
  using (app.is_member(org_id));

create policy "quote_items: members can insert"
  on public.quote_items for insert
  with check (app.has_permission('quotes.create', org_id));

create policy "quote_items: members can update"
  on public.quote_items for update
  using  (app.has_permission('quotes.edit', org_id))
  with check (app.has_permission('quotes.edit', org_id));

create policy "quote_items: members can delete"
  on public.quote_items for delete
  using (app.has_permission('quotes.delete', org_id));
