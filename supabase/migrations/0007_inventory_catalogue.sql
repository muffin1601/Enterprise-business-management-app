-- 0007_inventory_catalogue.sql
-- Item Management (catalogue) — DATABASE_SCHEMA.md §3.4 subset: item_families,
-- brands, units, items, item_variations. Procurement (suppliers, purchase_orders,
-- goods_receipts) and the stock ledger (stock_movements / stock_adjustments) are
-- deferred to their own module; items.last_supplier_id is kept as a plain uuid
-- here (its FK to suppliers is added when that module lands).
--
-- RLS maps to the inventory permission keys (PERMISSIONS.md §2): items.view /
-- items.create / items.edit / items.delete. Audit coverage is the generic
-- app.fn_audit trigger (0004) — every table here has both `id` and `org_id`.

create type public.transport_type as enum ('lumpsum', 'percent');

-- ── lookups ──────────────────────────────────────────────────────────────────
create table public.item_families (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete restrict,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);
create unique index uq_item_families_name on public.item_families (org_id, lower(name)) where deleted_at is null;
create index idx_item_families_org on public.item_families (org_id);

create table public.brands (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete restrict,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);
create unique index uq_brands_name on public.brands (org_id, lower(name)) where deleted_at is null;
create index idx_brands_org on public.brands (org_id);

create table public.units (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete restrict,
  code       text not null,
  name       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);
create unique index uq_units_code on public.units (org_id, code) where deleted_at is null;
create index idx_units_org on public.units (org_id);

-- ── items ────────────────────────────────────────────────────────────────────
create table public.items (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references public.organizations(id) on delete restrict,
  parent_id            uuid references public.items(id) on delete set null,
  family_id            uuid references public.item_families(id) on delete set null,
  brand_id             uuid references public.brands(id) on delete set null,
  unit_id              uuid references public.units(id) on delete set null,
  sku                  text,
  name                 text not null,
  variant_label        text,
  image_url            text,
  is_imported          boolean not null default false,
  is_template          boolean not null default false,
  delivery_days        integer,
  purchase_price       numeric(14,2),
  selling_price        numeric(14,2),
  stock                numeric(14,3) not null default 0,
  last_purchase_price  numeric(14,2),
  last_purchase_date   date,
  last_supplier_id     uuid,                       -- FK → suppliers added by Procurement module
  import_currency      public.currency_code,
  import_price         numeric(14,2),
  exchange_rate        numeric(12,6),
  import_discount_pct  numeric(6,3),
  transport_type       public.transport_type,
  transport_value      numeric(14,2),
  custom_duty_pct      numeric(6,3),
  profit_multiplier    numeric(8,4),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index idx_items_org on public.items (org_id);
create index idx_items_org_active on public.items (org_id) where deleted_at is null;
create index idx_items_org_family on public.items (org_id, family_id);
create index idx_items_org_brand on public.items (org_id, brand_id);
create index idx_items_parent on public.items (parent_id);
create unique index uq_items_sku on public.items (org_id, sku) where deleted_at is null;
create index idx_items_name_trgm on public.items using gin (name gin_trgm_ops);

create table public.item_variations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete restrict,
  item_id    uuid not null references public.items(id) on delete cascade,
  size       text, make text, finish text, brand text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);
create index idx_item_variations_item on public.item_variations (item_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.item_families  enable row level security; alter table public.item_families  force row level security;
alter table public.brands         enable row level security; alter table public.brands         force row level security;
alter table public.units          enable row level security; alter table public.units          force row level security;
alter table public.items          enable row level security; alter table public.items          force row level security;
alter table public.item_variations enable row level security; alter table public.item_variations force row level security;

-- Lookups: any member reads; items.create/edit manages.
create policy fam_select on public.item_families for select using ( app.is_member(org_id) );
create policy fam_write  on public.item_families for all
  using ( app.has_permission('items.create', org_id) or app.has_permission('items.edit', org_id) )
  with check ( app.is_member(org_id) );

create policy brand_select on public.brands for select using ( app.is_member(org_id) );
create policy brand_write  on public.brands for all
  using ( app.has_permission('items.create', org_id) or app.has_permission('items.edit', org_id) )
  with check ( app.is_member(org_id) );

create policy unit_select on public.units for select using ( app.is_member(org_id) );
create policy unit_write  on public.units for all
  using ( app.has_permission('items.create', org_id) or app.has_permission('items.edit', org_id) )
  with check ( app.is_member(org_id) );

-- Items: granular by permission. Soft-delete is an UPDATE of deleted_at, so the
-- update policy admits items.edit OR items.delete.
create policy items_select on public.items for select using ( app.has_permission('items.view', org_id) );
create policy items_insert on public.items for insert with check ( app.has_permission('items.create', org_id) );
create policy items_update on public.items for update
  using ( app.has_permission('items.edit', org_id) or app.has_permission('items.delete', org_id) )
  with check ( app.is_member(org_id) );
create policy items_delete on public.items for delete using ( app.has_permission('items.delete', org_id) );

create policy itemvar_select on public.item_variations for select using ( app.has_permission('items.view', org_id) );
create policy itemvar_write  on public.item_variations for all
  using ( app.has_permission('items.create', org_id) or app.has_permission('items.edit', org_id) )
  with check ( app.is_member(org_id) );

-- ── Audit + updated_at triggers (generic helpers from 0002/0004) ─────────────
create trigger trg_fam_updated   before update on public.item_families   for each row execute function app.set_updated_at();
create trigger trg_brand_updated before update on public.brands          for each row execute function app.set_updated_at();
create trigger trg_unit_updated  before update on public.units           for each row execute function app.set_updated_at();
create trigger trg_items_updated before update on public.items           for each row execute function app.set_updated_at();
create trigger trg_itemvar_updated before update on public.item_variations for each row execute function app.set_updated_at();

create trigger trg_audit_item_families  after insert or update or delete on public.item_families  for each row execute function app.fn_audit();
create trigger trg_audit_brands         after insert or update or delete on public.brands         for each row execute function app.fn_audit();
create trigger trg_audit_units          after insert or update or delete on public.units          for each row execute function app.fn_audit();
create trigger trg_audit_items          after insert or update or delete on public.items          for each row execute function app.fn_audit();
create trigger trg_audit_item_variations after insert or update or delete on public.item_variations for each row execute function app.fn_audit();
