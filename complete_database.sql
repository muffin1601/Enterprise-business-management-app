-- ===========================================================================
-- 1. EXTENSIONS
-- ===========================================================================
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ===========================================================================
-- 2. SCHEMAS
-- ===========================================================================
create schema if not exists app;

-- ===========================================================================
-- 3. ENUMS
-- ===========================================================================
do $$ begin create type public.record_status as enum ('active','inactive'); exception when duplicate_object then null; end $$;
do $$ begin create type public.audit_action as enum ('insert','update','delete','restore','login','permission_change'); exception when duplicate_object then null; end $$;
do $$ begin create type public.currency_code as enum ('INR','USD','EUR','CNY'); exception when duplicate_object then null; end $$;
do $$ begin create type public.transport_type as enum ('lumpsum','percent'); exception when duplicate_object then null; end $$;

-- ===========================================================================
-- 4. HELPER FUNCTIONS
-- ===========================================================================
create or replace function app.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ===========================================================================
-- 5. TABLES
-- ===========================================================================
create table if not exists public.organizations (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text,
  legal_name         text,
  gstin              text,
  pan                text,
  address            text,
  logo_url           text,
  currency           public.currency_code not null default 'INR',
  status             public.record_status not null default 'active',
  stripe_customer_id text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid,
  updated_by         uuid,
  deleted_at         timestamptz
);

create table if not exists public.users (
  id              uuid primary key,
  email           text not null,
  full_name       text,
  phone           text,
  avatar_url      text,
  status          public.record_status not null default 'active',
  is_super_admin  boolean not null default false,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.organization_settings (
  org_id                uuid primary key,
  financial_year_start  smallint not null default 4,
  default_gst_pct       numeric(6,3) default 18,
  place_of_supply       text,
  approval_limits       jsonb not null default '{}'::jsonb,
  theme                 jsonb,
  feature_flags         jsonb not null default '{}'::jsonb,
  notification_defaults jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid,
  updated_by            uuid
);

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid,
  key         text not null,
  name        text,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);

create table if not exists public.permissions (
  key         text primary key,
  description text,
  module      text
);

create table if not exists public.role_permissions (
  role_id        uuid not null,
  permission_key text not null,
  primary key (role_id, permission_key)
);

create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  user_id     uuid not null,
  is_default  boolean not null default false,
  is_billable boolean not null default true,
  joined_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  user_id    uuid not null,
  role_id    uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  email       text not null,
  role_id     uuid,
  token       text not null,
  status      text not null default 'pending',
  invited_by  uuid,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);

create table if not exists public.number_sequences (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  doc_type    text not null,
  mask        text not null,
  period_key  text not null,
  next_value  integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);

create table if not exists public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  actor_id       uuid,
  entity_type    text not null,
  entity_id      uuid not null,
  action         public.audit_action not null,
  before         jsonb,
  after          jsonb,
  changed_fields text[],
  ip             inet,
  user_agent     text,
  request_id     text,
  at             timestamptz not null default now()
);

create table if not exists public.item_families (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table if not exists public.brands (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table if not exists public.units (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  code       text not null,
  name       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

create table if not exists public.items (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null,
  parent_id            uuid,
  family_id            uuid,
  brand_id             uuid,
  unit_id              uuid,
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
  last_supplier_id     uuid,
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

create table if not exists public.item_variations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  item_id    uuid not null,
  size       text, make text, finish text, brand text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid, updated_by uuid, deleted_at timestamptz
);

-- ===========================================================================
-- 6. CONSTRAINTS
-- ===========================================================================
alter table public.organizations add constraint uq_organizations_slug unique (slug);
alter table public.organizations add constraint uq_organizations_stripe unique (stripe_customer_id);
alter table public.users add constraint uq_users_email unique (email);
alter table public.memberships add constraint uq_memberships_org_user unique (org_id, user_id);
alter table public.user_roles add constraint uq_user_roles unique (org_id, user_id, role_id);
alter table public.number_sequences add constraint uq_number_sequences unique (org_id, doc_type, period_key);
alter table public.invitations add constraint uq_invitations_token unique (token);

-- ===========================================================================
-- 7. FOREIGN KEYS
-- ===========================================================================
alter table public.users                 add constraint users_id_fkey                  foreign key (id)         references auth.users(id)            on delete cascade;
alter table public.organization_settings  add constraint os_org_fkey                    foreign key (org_id)     references public.organizations(id)  on delete cascade;
alter table public.roles                  add constraint roles_org_fkey                 foreign key (org_id)     references public.organizations(id)  on delete restrict;
alter table public.role_permissions       add constraint rp_role_fkey                   foreign key (role_id)    references public.roles(id)          on delete cascade;
alter table public.role_permissions       add constraint rp_perm_fkey                   foreign key (permission_key) references public.permissions(key) on delete cascade;
alter table public.memberships            add constraint mem_org_fkey                   foreign key (org_id)     references public.organizations(id)  on delete restrict;
alter table public.memberships            add constraint mem_user_fkey                  foreign key (user_id)    references public.users(id)          on delete cascade;
alter table public.user_roles             add constraint ur_org_fkey                    foreign key (org_id)     references public.organizations(id)  on delete restrict;
alter table public.user_roles             add constraint ur_user_fkey                   foreign key (user_id)    references public.users(id)          on delete cascade;
alter table public.user_roles             add constraint ur_role_fkey                   foreign key (role_id)    references public.roles(id)          on delete cascade;
alter table public.invitations            add constraint inv_org_fkey                   foreign key (org_id)     references public.organizations(id)  on delete restrict;
alter table public.invitations            add constraint inv_role_fkey                  foreign key (role_id)    references public.roles(id)          on delete set null;
alter table public.invitations            add constraint inv_invited_by_fkey            foreign key (invited_by) references public.users(id);
alter table public.number_sequences       add constraint nseq_org_fkey                  foreign key (org_id)     references public.organizations(id)  on delete restrict;
alter table public.audit_logs             add constraint audit_org_fkey                 foreign key (org_id)     references public.organizations(id)  on delete restrict;
alter table public.item_families          add constraint fam_org_fkey                   foreign key (org_id)     references public.organizations(id)  on delete restrict;
alter table public.brands                 add constraint brand_org_fkey                 foreign key (org_id)     references public.organizations(id)  on delete restrict;
alter table public.units                  add constraint unit_org_fkey                  foreign key (org_id)     references public.organizations(id)  on delete restrict;
alter table public.items                  add constraint items_org_fkey                 foreign key (org_id)     references public.organizations(id)  on delete restrict;
alter table public.items                  add constraint items_parent_fkey              foreign key (parent_id)  references public.items(id)          on delete set null;
alter table public.items                  add constraint items_family_fkey              foreign key (family_id)  references public.item_families(id)  on delete set null;
alter table public.items                  add constraint items_brand_fkey               foreign key (brand_id)   references public.brands(id)         on delete set null;
alter table public.items                  add constraint items_unit_fkey                foreign key (unit_id)    references public.units(id)          on delete set null;
alter table public.item_variations        add constraint itemvar_org_fkey               foreign key (org_id)     references public.organizations(id)  on delete restrict;
alter table public.item_variations        add constraint itemvar_item_fkey              foreign key (item_id)    references public.items(id)          on delete cascade;

-- ===========================================================================
-- 8. INDEXES
-- ===========================================================================
create unique index if not exists uq_roles_org_key on public.roles (org_id, key);
create unique index if not exists uq_roles_system_key on public.roles (key) where org_id is null;
create index if not exists idx_memberships_user on public.memberships (user_id);
create unique index if not exists uq_invitations_org_email_pending on public.invitations (org_id, lower(email)) where status = 'pending';
create index if not exists idx_audit_entity on public.audit_logs (org_id, entity_type, entity_id, at);
create index if not exists idx_audit_actor  on public.audit_logs (actor_id, at);
create unique index if not exists uq_item_families_name on public.item_families (org_id, lower(name)) where deleted_at is null;
create index if not exists idx_item_families_org on public.item_families (org_id);
create unique index if not exists uq_brands_name on public.brands (org_id, lower(name)) where deleted_at is null;
create index if not exists idx_brands_org on public.brands (org_id);
create unique index if not exists uq_units_code on public.units (org_id, code) where deleted_at is null;
create index if not exists idx_units_org on public.units (org_id);
create index if not exists idx_items_org on public.items (org_id);
create index if not exists idx_items_org_active on public.items (org_id) where deleted_at is null;
create index if not exists idx_items_org_family on public.items (org_id, family_id);
create index if not exists idx_items_org_brand on public.items (org_id, brand_id);
create index if not exists idx_items_parent on public.items (parent_id);
create unique index if not exists uq_items_sku on public.items (org_id, sku) where deleted_at is null;
create index if not exists idx_items_name_trgm on public.items using gin (name gin_trgm_ops);
create index if not exists idx_item_variations_item on public.item_variations (item_id);

-- ===========================================================================
-- 9. TRIGGERS
-- ===========================================================================
create or replace function app.block_super_admin_change()
returns trigger language plpgsql as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin and not app.is_super_admin() then
    raise exception 'is_super_admin cannot be changed by a non-super-admin';
  end if;
  return new;
end $$;

create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger trg_org_updated      before update on public.organizations         for each row execute function app.set_updated_at();
create trigger trg_os_updated       before update on public.organization_settings for each row execute function app.set_updated_at();
create trigger trg_users_updated    before update on public.users                 for each row execute function app.set_updated_at();
create trigger trg_mem_updated      before update on public.memberships           for each row execute function app.set_updated_at();
create trigger trg_roles_updated    before update on public.roles                 for each row execute function app.set_updated_at();
create trigger trg_inv_updated      before update on public.invitations           for each row execute function app.set_updated_at();
create trigger trg_nseq_updated     before update on public.number_sequences      for each row execute function app.set_updated_at();
create trigger trg_fam_updated      before update on public.item_families         for each row execute function app.set_updated_at();
create trigger trg_brand_updated    before update on public.brands                for each row execute function app.set_updated_at();
create trigger trg_unit_updated     before update on public.units                 for each row execute function app.set_updated_at();
create trigger trg_items_updated    before update on public.items                 for each row execute function app.set_updated_at();
create trigger trg_itemvar_updated  before update on public.item_variations       for each row execute function app.set_updated_at();
create trigger trg_users_block_sa   before update on public.users                 for each row execute function app.block_super_admin_change();
create trigger trg_auth_user_created after insert on auth.users                   for each row execute function app.handle_new_user();

-- ===========================================================================
-- 10. AUDIT FUNCTIONS
-- ===========================================================================
create or replace function app.fn_audit_redact(p_table text, p_row jsonb)
returns jsonb language plpgsql immutable as $$
declare v_drop text[]; v_mask text[]; k text;
begin
  v_drop := case p_table when 'invitations' then array['token'] else array[]::text[] end;
  v_mask := case p_table when 'users' then array['phone','email'] else array[]::text[] end;
  for k in select jsonb_object_keys(p_row) loop
    if k ~* '(token|secret|password|api_key)$' then v_drop := array_append(v_drop, k); end if;
  end loop;
  foreach k in array v_drop loop
    if p_row ? k then p_row := jsonb_set(p_row, array[k], '"<redacted>"'); end if;
  end loop;
  foreach k in array v_mask loop
    if p_row ? k and p_row ->> k is not null then
      p_row := jsonb_set(p_row, array[k], to_jsonb('***'|| right(p_row ->> k, 4)));
    end if;
  end loop;
  return p_row;
end $$;

create or replace function app.fn_audit()
returns trigger language plpgsql security definer set search_path = app, public as $$
declare
  v_actor uuid; v_org uuid; v_before jsonb; v_after jsonb; v_changed text[];
  v_action public.audit_action;
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  v_actor := nullif(v_claims ->> 'sub', '')::uuid;
  if (tg_op = 'INSERT') then
    v_action := 'insert'; v_after := app.fn_audit_redact(tg_table_name, to_jsonb(new)); v_org := new.org_id;
  elsif (tg_op = 'UPDATE') then
    v_action := 'update';
    v_before := app.fn_audit_redact(tg_table_name, to_jsonb(old));
    v_after  := app.fn_audit_redact(tg_table_name, to_jsonb(new));
    v_org := new.org_id;
    select array_agg(key) into v_changed from jsonb_each(v_after) a
      where a.value is distinct from (v_before -> a.key) and a.key not in ('updated_at');
    if v_changed is null then return null; end if;
  elsif (tg_op = 'DELETE') then
    v_action := 'delete'; v_before := app.fn_audit_redact(tg_table_name, to_jsonb(old)); v_org := old.org_id;
  end if;
  insert into public.audit_logs
    (org_id, actor_id, entity_type, entity_id, action, before, after, changed_fields, ip, user_agent, request_id, at)
  values
    (v_org, v_actor, tg_table_name,
     coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'))::uuid,
     v_action, v_before, v_after, v_changed,
     nullif(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for','')::inet,
     current_setting('request.headers', true)::jsonb ->> 'user-agent',
     nullif(current_setting('app.request_id', true), ''), now());
  return null;
end $$;

create or replace function app.fn_audit_org_settings()
returns trigger language plpgsql security definer set search_path = app, public as $$
declare
  v_actor uuid := nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid;
  v_before jsonb; v_after jsonb; v_changed text[]; v_action public.audit_action; v_org uuid;
begin
  if (tg_op = 'INSERT') then
    v_action := 'insert'; v_after := app.fn_audit_redact('organization_settings', to_jsonb(new)); v_org := new.org_id;
  elsif (tg_op = 'UPDATE') then
    v_action := 'update';
    v_before := app.fn_audit_redact('organization_settings', to_jsonb(old));
    v_after  := app.fn_audit_redact('organization_settings', to_jsonb(new));
    v_org := new.org_id;
    select array_agg(key) into v_changed from jsonb_each(v_after) a
      where a.value is distinct from (v_before -> a.key) and a.key not in ('updated_at');
    if v_changed is null then return null; end if;
  elsif (tg_op = 'DELETE') then
    v_action := 'delete'; v_before := app.fn_audit_redact('organization_settings', to_jsonb(old)); v_org := old.org_id;
  end if;
  insert into public.audit_logs
    (org_id, actor_id, entity_type, entity_id, action, before, after, changed_fields, ip, user_agent, request_id, at)
  values
    (v_org, v_actor, 'organization_settings', v_org, v_action, v_before, v_after, v_changed,
     nullif(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for','')::inet,
     current_setting('request.headers', true)::jsonb ->> 'user-agent',
     nullif(current_setting('app.request_id', true), ''), now());
  return null;
end $$;

create or replace function app.fn_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only (% blocked)', tg_op using errcode = 'check_violation';
end $$;

-- ===========================================================================
-- 11. AUDIT TRIGGERS
-- ===========================================================================
create trigger trg_audit_memberships     after insert or update or delete on public.memberships     for each row execute function app.fn_audit();
create trigger trg_audit_user_roles       after insert or update or delete on public.user_roles      for each row execute function app.fn_audit();
create trigger trg_audit_invitations      after insert or update or delete on public.invitations     for each row execute function app.fn_audit();
create trigger trg_audit_items            after insert or update or delete on public.items           for each row execute function app.fn_audit();
create trigger trg_audit_item_families    after insert or update or delete on public.item_families   for each row execute function app.fn_audit();
create trigger trg_audit_brands           after insert or update or delete on public.brands          for each row execute function app.fn_audit();
create trigger trg_audit_units            after insert or update or delete on public.units           for each row execute function app.fn_audit();
create trigger trg_audit_item_variations  after insert or update or delete on public.item_variations for each row execute function app.fn_audit();
create trigger trg_audit_org_settings     after insert or update or delete on public.organization_settings for each row execute function app.fn_audit_org_settings();
create trigger trg_audit_no_update        before update or delete on public.audit_logs for each row execute function app.fn_audit_immutable();
revoke update, delete on public.audit_logs from authenticated, anon, service_role;

-- ===========================================================================
-- 12. RLS HELPER FUNCTIONS
-- ===========================================================================
create or replace function app.current_orgs()
returns setof uuid language sql stable security definer set search_path = app, public as $$
  select m.org_id from public.memberships m where m.user_id = auth.uid();
$$;

create or replace function app.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.org_id = p_org);
$$;

create or replace function app.is_super_admin()
returns boolean language sql stable security definer set search_path = app, public as $$
  select coalesce((current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_super_admin')::boolean, false);
$$;

create or replace function app.is_org_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
                 where ur.user_id = auth.uid() and ur.org_id = p_org and r.key = 'company_owner');
$$;

create or replace function app.has_permission(p_key text, p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select app.is_super_admin() or app.is_org_owner(p_org)
      or exists (select 1 from public.user_roles ur
                 join public.role_permissions rp on rp.role_id = ur.role_id
                 where ur.user_id = auth.uid() and ur.org_id = p_org and rp.permission_key = p_key);
$$;

create or replace function app.has_active_subscription(p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$ select true; $$;

create or replace function app.within_plan_limit(p_org uuid, p_metric text)
returns boolean language sql stable security definer set search_path = app, public as $$ select true; $$;

create or replace function public.create_organization(
  p_name text, p_slug text default null, p_legal_name text default null,
  p_gstin text default null, p_address text default null)
returns uuid language plpgsql security definer set search_path = public, app as $$
declare v_uid uuid := auth.uid(); v_org uuid; v_owner_role uuid;
begin
  if v_uid is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  if coalesce(btrim(p_name), '') = '' then raise exception 'organization name is required' using errcode = '22023'; end if;
  insert into public.organizations (name, slug, legal_name, gstin, address, created_by)
    values (p_name, nullif(p_slug,''), nullif(p_legal_name,''), nullif(p_gstin,''), nullif(p_address,''), v_uid)
    returning id into v_org;
  insert into public.organization_settings (org_id, created_by) values (v_org, v_uid);
  insert into public.memberships (org_id, user_id, is_default, is_billable, created_by)
    values (v_org, v_uid, true, true, v_uid);
  select id into v_owner_role from public.roles where key = 'company_owner' and org_id is null;
  if v_owner_role is null then raise exception 'company_owner system role not seeded' using errcode = 'P0001'; end if;
  insert into public.user_roles (org_id, user_id, role_id, created_by) values (v_org, v_uid, v_owner_role, v_uid);
  insert into public.audit_logs (org_id, actor_id, entity_type, entity_id, action, after)
    values (v_org, v_uid, 'organizations', v_org, 'insert', jsonb_build_object('name', p_name, 'slug', p_slug));
  return v_org;
end $$;
revoke all on function public.create_organization(text,text,text,text,text) from public;
grant execute on function public.create_organization(text,text,text,text,text) to authenticated;

create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email');
  v_inv public.invitations%rowtype; v_is_default boolean;
begin
  if v_uid is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  select * into v_inv from public.invitations where token = p_token;
  if not found then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if v_inv.status <> 'pending' then raise exception 'invitation is no longer pending' using errcode = 'P0001'; end if;
  if v_inv.expires_at < now() then
    update public.invitations set status = 'expired' where id = v_inv.id;
    raise exception 'invitation has expired' using errcode = 'P0001';
  end if;
  if v_email is null or lower(v_inv.email) <> v_email then
    raise exception 'invitation email does not match the signed-in account' using errcode = '42501';
  end if;
  v_is_default := not exists (select 1 from public.memberships m where m.user_id = v_uid);
  insert into public.memberships (org_id, user_id, is_default, is_billable, created_by)
    values (v_inv.org_id, v_uid, v_is_default, true, v_uid) on conflict (org_id, user_id) do nothing;
  if v_inv.role_id is not null then
    insert into public.user_roles (org_id, user_id, role_id, created_by)
      values (v_inv.org_id, v_uid, v_inv.role_id, v_uid) on conflict (org_id, user_id, role_id) do nothing;
  end if;
  update public.invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
  return v_inv.org_id;
end $$;
revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

create or replace function public.invitation_preview(p_token text)
returns table (org_name text, email text, role_name text, status text, expired boolean)
language sql security definer set search_path = public, app stable as $$
  select o.name, i.email, r.name, i.status, (i.expires_at < now()) as expired
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  left join public.roles r on r.id = i.role_id
  where i.token = p_token;
$$;
revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to authenticated;

create or replace function public.set_user_status(p_user_id uuid, p_org uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public, app as $$
declare
  v_actor uuid := auth.uid(); v_old public.record_status;
  v_new public.record_status := case when p_active then 'active' else 'inactive' end;
begin
  if v_actor is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  if not app.has_permission('admin.users', p_org) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.memberships m where m.org_id = p_org and m.user_id = p_user_id) then
    raise exception 'target is not a member of this organization' using errcode = 'P0002';
  end if;
  if p_user_id = v_actor then raise exception 'you cannot change your own status' using errcode = 'P0001'; end if;
  if not p_active and exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = p_user_id and ur.org_id = p_org and r.key = 'company_owner') then
    raise exception 'cannot deactivate the company owner' using errcode = 'P0001';
  end if;
  select status into v_old from public.users where id = p_user_id;
  if v_old is distinct from v_new then
    update public.users set status = v_new where id = p_user_id;
    insert into public.audit_logs (org_id, actor_id, entity_type, entity_id, action, before, after, changed_fields)
    values (p_org, v_actor, 'users', p_user_id, 'update',
            jsonb_build_object('status', v_old), jsonb_build_object('status', v_new), array['status']);
  end if;
end $$;
revoke all on function public.set_user_status(uuid, uuid, boolean) from public;
grant execute on function public.set_user_status(uuid, uuid, boolean) to authenticated;

-- ===========================================================================
-- 13. ENABLE RLS
-- ===========================================================================
alter table public.organizations         enable row level security;
alter table public.organization_settings enable row level security;
alter table public.users                 enable row level security;
alter table public.memberships           enable row level security;
alter table public.roles                 enable row level security;
alter table public.permissions           enable row level security;
alter table public.role_permissions      enable row level security;
alter table public.user_roles            enable row level security;
alter table public.invitations           enable row level security;
alter table public.number_sequences      enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.item_families         enable row level security;
alter table public.brands                enable row level security;
alter table public.units                 enable row level security;
alter table public.items                 enable row level security;
alter table public.item_variations       enable row level security;

-- ===========================================================================
-- 14. FORCE RLS
-- ===========================================================================
alter table public.organizations         force row level security;
alter table public.organization_settings force row level security;
alter table public.users                 force row level security;
alter table public.memberships           force row level security;
alter table public.roles                 force row level security;
alter table public.permissions           force row level security;
alter table public.role_permissions      force row level security;
alter table public.user_roles            force row level security;
alter table public.invitations           force row level security;
alter table public.number_sequences      force row level security;
alter table public.audit_logs            force row level security;
alter table public.item_families         force row level security;
alter table public.brands                force row level security;
alter table public.units                 force row level security;
alter table public.items                 force row level security;
alter table public.item_variations       force row level security;

-- ===========================================================================
-- 15. ALL POLICIES
-- ===========================================================================
create policy org_select on public.organizations for select using ( app.is_super_admin() or app.is_member(id) );
create policy org_update on public.organizations for update using ( app.is_org_owner(id) or app.is_super_admin() ) with check ( app.is_member(id) or app.is_super_admin() );

create policy os_select on public.organization_settings for select using ( app.is_member(org_id) );
create policy os_write on public.organization_settings for all using ( app.has_permission('settings.manage', org_id) ) with check ( app.is_member(org_id) );

create policy users_select on public.users for select using ( id = auth.uid() or app.is_super_admin()
  or exists (select 1 from public.memberships m1 join public.memberships m2 on m1.org_id = m2.org_id
             where m1.user_id = auth.uid() and m2.user_id = public.users.id) );
create policy users_update_self on public.users for update using ( id = auth.uid() or app.is_super_admin() ) with check ( id = auth.uid() or app.is_super_admin() );

create policy mem_select on public.memberships for select using ( user_id = auth.uid() or app.has_permission('admin.users', org_id) or app.is_super_admin() );
create policy mem_insert on public.memberships for insert with check ( app.has_permission('admin.users', org_id) and app.has_active_subscription(org_id) and ( is_billable = false or app.within_plan_limit(org_id, 'seats') ) );
create policy mem_update on public.memberships for update using ( app.has_permission('admin.users', org_id) ) with check ( app.is_member(org_id) );
create policy mem_delete on public.memberships for delete using ( app.has_permission('admin.users', org_id) and user_id <> auth.uid() );

create policy roles_select on public.roles for select using ( org_id is null or app.is_member(org_id) );
create policy roles_write on public.roles for all using ( org_id is not null and app.has_permission('admin.roles', org_id) ) with check ( app.is_member(org_id) and is_system = false );

create policy perm_select on public.permissions for select using ( auth.uid() is not null );
create policy perm_write on public.permissions for all using ( app.is_super_admin() ) with check ( app.is_super_admin() );

create policy rp_select on public.role_permissions for select using ( exists (select 1 from public.roles r where r.id = role_id and (r.org_id is null or app.is_member(r.org_id))) );
create policy rp_write on public.role_permissions for all using ( exists (select 1 from public.roles r where r.id = role_id and r.org_id is not null and app.has_permission('admin.roles', r.org_id)) ) with check ( exists (select 1 from public.roles r where r.id = role_id and r.org_id is not null and app.is_member(r.org_id)) );

create policy ur_select on public.user_roles for select using ( user_id = auth.uid() or app.has_permission('admin.users', org_id) );
create policy ur_write on public.user_roles for all using ( app.has_permission('admin.users', org_id) ) with check ( app.is_member(org_id) and exists (select 1 from public.roles r where r.id = role_id and (r.org_id = org_id or r.org_id is null)) );

create policy inv_select on public.invitations for select using ( app.has_permission('admin.users', org_id) and deleted_at is null );
create policy inv_insert on public.invitations for insert with check ( app.has_permission('admin.users', org_id) and app.has_active_subscription(org_id) and app.within_plan_limit(org_id, 'seats') );
create policy inv_update on public.invitations for update using ( app.has_permission('admin.users', org_id) ) with check ( app.is_member(org_id) );
create policy inv_delete on public.invitations for delete using ( app.is_org_owner(org_id) );

create policy nseq_select on public.number_sequences for select using ( app.is_member(org_id) );
create policy nseq_write on public.number_sequences for all using ( app.has_permission('settings.manage', org_id) or app.has_permission('quotes.create', org_id) or app.has_permission('invoices.create', org_id) or app.has_permission('sales_orders.create', org_id) or app.has_permission('challans.create', org_id) ) with check ( app.is_member(org_id) );

create policy audit_select on public.audit_logs for select using ( app.is_member(org_id) and ( app.is_org_owner(org_id) or app.has_permission('admin.audit', org_id) ) );
create policy audit_insert on public.audit_logs for insert with check ( app.is_member(org_id) and (actor_id = auth.uid() or actor_id is null) );

create policy fam_select on public.item_families for select using ( app.is_member(org_id) );
create policy fam_write on public.item_families for all using ( app.has_permission('items.create', org_id) or app.has_permission('items.edit', org_id) ) with check ( app.is_member(org_id) );

create policy brand_select on public.brands for select using ( app.is_member(org_id) );
create policy brand_write on public.brands for all using ( app.has_permission('items.create', org_id) or app.has_permission('items.edit', org_id) ) with check ( app.is_member(org_id) );

create policy unit_select on public.units for select using ( app.is_member(org_id) );
create policy unit_write on public.units for all using ( app.has_permission('items.create', org_id) or app.has_permission('items.edit', org_id) ) with check ( app.is_member(org_id) );

create policy items_select on public.items for select using ( app.has_permission('items.view', org_id) );
create policy items_insert on public.items for insert with check ( app.has_permission('items.create', org_id) );
create policy items_update on public.items for update using ( app.has_permission('items.edit', org_id) or app.has_permission('items.delete', org_id) ) with check ( app.is_member(org_id) );
create policy items_delete on public.items for delete using ( app.has_permission('items.delete', org_id) );

create policy itemvar_select on public.item_variations for select using ( app.has_permission('items.view', org_id) );
create policy itemvar_write on public.item_variations for all using ( app.has_permission('items.create', org_id) or app.has_permission('items.edit', org_id) ) with check ( app.is_member(org_id) );

-- ===========================================================================
-- 16. SEED PERMISSIONS
-- ===========================================================================
insert into public.permissions (key, module) values
  ('dashboard.view','dashboard'),
  ('items.view','inventory'),('items.create','inventory'),('items.edit','inventory'),('items.delete','inventory'),
  ('stock.adjust','inventory'),('pricing.override','inventory'),
  ('stock_report.view','reports'),('stock_report.export','reports'),
  ('customers.view','crm'),('customers.create','crm'),('customers.edit','crm'),('customers.delete','crm'),
  ('running_bill.view','crm'),
  ('quotes.view','sales'),('quotes.create','sales'),('quotes.edit','sales'),('quotes.revise','sales'),
  ('quotes.delete','sales'),('quotes.export','sales'),
  ('sales_orders.view','sales'),('sales_orders.create','sales'),('sales_orders.edit','sales'),('sales_orders.delete','sales'),
  ('challans.view','logistics'),('challans.create','logistics'),('challans.edit','logistics'),
  ('challans.post','logistics'),('challans.delete','logistics'),
  ('payments.view','finance'),('payments.record','finance'),('payments.delete','finance'),
  ('invoices.view','finance'),('invoices.create','finance'),('invoices.edit','finance'),
  ('invoices.issue','finance'),('invoices.delete','finance'),
  ('discount.post_sale','finance'),('discount.approve','finance'),
  ('finance.view','finance'),('finance.manage','finance'),
  ('expenses.create','finance'),('expenses.approve','finance'),
  ('payroll.view','finance'),('payroll.manage','finance'),
  ('reports.sales.view','reports'),('reports.inventory.view','reports'),('reports.financial.view','reports'),
  ('reports.hr.view','reports'),('reports.export','reports'),
  ('hr.view','hr'),('hr.manage','hr'),('leave.approve','hr'),
  ('support.view','support'),('support.manage','support'),
  ('admin.users','admin'),('admin.roles','admin'),('admin.audit','admin'),('settings.manage','admin'),
  ('org.manage','system'),('system.config','system')
on conflict (key) do nothing;

-- ===========================================================================
-- 17. SEED ROLES
-- ===========================================================================
insert into public.roles (org_id, key, name, is_system) values
  (null,'company_owner','Company Owner', true),
  (null,'manager',      'Manager',       true),
  (null,'employee',     'Employee',      true),
  (null,'accountant',   'Accountant',    true),
  (null,'hr',           'HR',            true)
on conflict (key) where org_id is null do nothing;

-- ===========================================================================
-- 18. ROLE PERMISSIONS
-- ===========================================================================
insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r cross join unnest(array[
  'dashboard.view','items.view','items.create','items.edit','stock.adjust','pricing.override',
  'stock_report.view','stock_report.export','customers.view','customers.create','customers.edit',
  'running_bill.view','quotes.view','quotes.create','quotes.edit','quotes.revise','quotes.delete',
  'quotes.export','sales_orders.view','sales_orders.create','sales_orders.edit','sales_orders.delete',
  'challans.view','challans.create','challans.edit','challans.post','challans.delete','payments.view',
  'invoices.view','discount.post_sale','discount.approve','finance.view','expenses.create','expenses.approve',
  'reports.sales.view','reports.inventory.view','reports.financial.view','reports.hr.view','reports.export',
  'hr.view','leave.approve','support.view','support.manage'
]) k where r.key = 'manager' and r.org_id is null
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r cross join unnest(array[
  'dashboard.view','items.view','stock_report.view','customers.view','customers.create','customers.edit',
  'running_bill.view','quotes.view','quotes.create','quotes.edit','quotes.revise','quotes.export',
  'sales_orders.view','sales_orders.create','challans.view','challans.create','invoices.view',
  'reports.sales.view','reports.inventory.view','support.view','expenses.create'
]) k where r.key = 'employee' and r.org_id is null
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r cross join unnest(array[
  'dashboard.view','items.view','stock_report.view','stock_report.export','customers.view','customers.edit',
  'running_bill.view','quotes.view','sales_orders.view','challans.view','payments.view','payments.record',
  'payments.delete','invoices.view','invoices.create','invoices.edit','invoices.issue','invoices.delete',
  'discount.post_sale','discount.approve','finance.view','finance.manage','expenses.create','expenses.approve',
  'payroll.view','payroll.manage','reports.sales.view','reports.inventory.view','reports.financial.view',
  'reports.export','admin.audit'
]) k where r.key = 'accountant' and r.org_id is null
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r cross join unnest(array[
  'dashboard.view','payroll.view','reports.hr.view','reports.export','hr.view','hr.manage',
  'leave.approve','expenses.create'
]) k where r.key = 'hr' and r.org_id is null
on conflict do nothing;

-- ===========================================================================
-- 19. DEFAULT DATA
-- ===========================================================================
insert into public.users (id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name')
from auth.users
on conflict (id) do nothing;
