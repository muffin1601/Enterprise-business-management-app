-- 0001_identity_tables.sql
-- Platform / Identity & Access tables — DATABASE_SCHEMA.md §3.1.
-- Columns, types, constraints, and ON DELETE actions follow the schema doc.

-- organizations — tenant root. `id` IS the org_id (RLS keys on id).
create table public.organizations (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text unique,
  legal_name         text,
  gstin              text,
  pan                text,
  address            text,
  logo_url           text,
  currency           public.currency_code not null default 'INR',
  status             public.record_status not null default 'active',
  stripe_customer_id text unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid,
  updated_by         uuid,
  deleted_at         timestamptz
);

-- users — profile mirror of auth.users (no org_id). id = auth.users.id.
create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null unique,
  full_name       text,
  phone           text,
  avatar_url      text,
  status          public.record_status not null default 'active',
  is_super_admin  boolean not null default false,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- organization_settings — 1:1 with org (PK == org_id), no soft delete.
create table public.organization_settings (
  org_id                uuid primary key references public.organizations(id) on delete cascade,
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

-- roles — system templates (org_id NULL) + org-scoped custom roles.
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references public.organizations(id) on delete restrict,
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
-- UNIQUE(org_id,key) — note: NULLs are distinct, so enforce system-role
-- uniqueness with a partial index too.
create unique index uq_roles_org_key on public.roles (org_id, key);
create unique index uq_roles_system_key on public.roles (key) where org_id is null;

-- permissions — global catalog (no org_id, no soft delete).
create table public.permissions (
  key         text primary key,
  description text,
  module      text
);

-- role_permissions — junction (no envelope).
create table public.role_permissions (
  role_id        uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

-- memberships — user ↔ org (M:N), no soft delete.
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete restrict,
  user_id     uuid not null references public.users(id) on delete cascade,
  is_default  boolean not null default false,
  is_billable boolean not null default true,
  joined_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  unique (org_id, user_id)
);
create index idx_memberships_user on public.memberships (user_id);

-- user_roles — per-org role assignment (no soft delete).
create table public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete restrict,
  user_id    uuid not null references public.users(id) on delete cascade,
  role_id    uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (org_id, user_id, role_id)
);

-- invitations — pending member invites.
create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete restrict,
  email       text not null,
  role_id     uuid references public.roles(id) on delete set null,
  token       text not null unique,
  status      text not null default 'pending',
  invited_by  uuid references public.users(id),
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);
create unique index uq_invitations_org_email_pending
  on public.invitations (org_id, lower(email)) where status = 'pending';

-- number_sequences — document numbering masks + counters.
create table public.number_sequences (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete restrict,
  doc_type    text not null,
  mask        text not null,
  period_key  text not null,
  next_value  integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz,
  unique (org_id, doc_type, period_key)
);

-- audit_logs — append-only (no soft delete, no updated_at).
create table public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete restrict,
  actor_id       uuid,
  entity_type    text not null,
  entity_id      uuid not null,
  action         public.audit_action not null,
  before         jsonb,
  after          jsonb,
  changed_fields text[],
  ip             inet,
  at             timestamptz not null default now()
);
create index idx_audit_entity on public.audit_logs (org_id, entity_type, entity_id, at);
create index idx_audit_actor  on public.audit_logs (actor_id, at);
