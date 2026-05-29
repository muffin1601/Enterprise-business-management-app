-- 0002_rls_helpers_policies_triggers.sql
-- Helper functions (RLS_POLICIES.md §2.1, verbatim), identity RLS policies
-- (§4.1, verbatim), supporting triggers, and the org-provisioning function.

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.1 Carried-over identity/permission helpers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function app.current_orgs()
returns setof uuid language sql stable security definer set search_path = app, public as $$
  select m.org_id from public.memberships m where m.user_id = auth.uid();
$$;

create or replace function app.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select exists (select 1 from public.memberships m
                 where m.user_id = auth.uid() and m.org_id = p_org);
$$;

create or replace function app.is_super_admin()
returns boolean language sql stable security definer set search_path = app, public as $$
  select coalesce(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_super_admin')::boolean,
    false);
$$;

create or replace function app.is_org_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and ur.org_id = p_org and r.key = 'company_owner');
$$;

create or replace function app.has_permission(p_key text, p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select app.is_super_admin()
      or app.is_org_owner(p_org)
      or exists (
        select 1
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        where ur.user_id = auth.uid()
          and ur.org_id = p_org
          and rp.permission_key = p_key);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.2 Billing-aware helpers — MVP BOOTSTRAP STUBS.
-- The full bodies (RLS_POLICIES.md §2.2) read subscriptions/plan_features/
-- usage_records, which the Billing module creates. Until then these fail-OPEN
-- (return true) so the MVP "default plan" works instead of blocking every write
-- (see CRITICAL_GAPS.md G-19). REPLACE both when the billing tables exist.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function app.has_active_subscription(p_org uuid)
returns boolean language sql stable security definer set search_path = app, public as $$
  select true;  -- MVP bootstrap (G-19). TODO: replace with §2.2 body in billing module.
$$;

create or replace function app.within_plan_limit(p_org uuid, p_metric text)
returns boolean language sql stable security definer set search_path = app, public as $$
  select true;  -- MVP bootstrap. TODO: replace with §2.2 body (usage_metric enum) in billing module.
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable + FORCE RLS on every identity table (default-deny, §1.1)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.organizations         enable row level security;
alter table public.organizations         force  row level security;
alter table public.organization_settings enable row level security;
alter table public.organization_settings force  row level security;
alter table public.users                 enable row level security;
alter table public.users                 force  row level security;
alter table public.memberships           enable row level security;
alter table public.memberships           force  row level security;
alter table public.roles                  enable row level security;
alter table public.roles                  force  row level security;
alter table public.permissions            enable row level security;
alter table public.permissions            force  row level security;
alter table public.role_permissions       enable row level security;
alter table public.role_permissions       force  row level security;
alter table public.user_roles             enable row level security;
alter table public.user_roles             force  row level security;
alter table public.invitations            enable row level security;
alter table public.invitations            force  row level security;
alter table public.number_sequences       enable row level security;
alter table public.number_sequences       force  row level security;
alter table public.audit_logs             enable row level security;
alter table public.audit_logs             force  row level security;

-- ── organizations (§4.1) ─────────────────────────────────────────────────────
create policy org_select on public.organizations for select
  using ( app.is_super_admin() or app.is_member(id) );
create policy org_update on public.organizations for update
  using ( app.is_org_owner(id) or app.is_super_admin() )
  with check ( app.is_member(id) or app.is_super_admin() );
-- No insert/delete policy → provisioning is the SECURITY DEFINER function below.

-- ── organization_settings (§4.1) ─────────────────────────────────────────────
create policy os_select on public.organization_settings for select
  using ( app.is_member(org_id) );
create policy os_write on public.organization_settings for all
  using ( app.has_permission('settings.manage', org_id) )
  with check ( app.is_member(org_id) );

-- ── users (§4.1) ─────────────────────────────────────────────────────────────
create policy users_select on public.users for select
  using ( id = auth.uid()
          or app.is_super_admin()
          or exists (select 1 from public.memberships m1
                     join public.memberships m2 on m1.org_id = m2.org_id
                     where m1.user_id = auth.uid() and m2.user_id = public.users.id) );
create policy users_update_self on public.users for update
  using ( id = auth.uid() or app.is_super_admin() )
  with check ( id = auth.uid() or app.is_super_admin() );

-- ── memberships (§4.1) ───────────────────────────────────────────────────────
create policy mem_select on public.memberships for select
  using ( user_id = auth.uid()
          or app.has_permission('admin.users', org_id)
          or app.is_super_admin() );
create policy mem_insert on public.memberships for insert
  with check ( app.has_permission('admin.users', org_id)
               and app.has_active_subscription(org_id)
               and ( is_billable = false or app.within_plan_limit(org_id, 'seats') ) );
create policy mem_update on public.memberships for update
  using ( app.has_permission('admin.users', org_id) )
  with check ( app.is_member(org_id) );
create policy mem_delete on public.memberships for delete
  using ( app.has_permission('admin.users', org_id) and user_id <> auth.uid() );

-- ── roles (§4.1) ─────────────────────────────────────────────────────────────
create policy roles_select on public.roles for select
  using ( org_id is null or app.is_member(org_id) );
create policy roles_write on public.roles for all
  using ( org_id is not null and app.has_permission('admin.roles', org_id) )
  with check ( app.is_member(org_id) and is_system = false );

-- ── permissions (§4.1) ───────────────────────────────────────────────────────
create policy perm_select on public.permissions for select using ( auth.uid() is not null );
create policy perm_write on public.permissions for all
  using ( app.is_super_admin() ) with check ( app.is_super_admin() );

-- ── role_permissions (§4.1) ──────────────────────────────────────────────────
create policy rp_select on public.role_permissions for select
  using ( exists (select 1 from public.roles r where r.id = role_id
                  and (r.org_id is null or app.is_member(r.org_id))) );
create policy rp_write on public.role_permissions for all
  using ( exists (select 1 from public.roles r where r.id = role_id
                  and r.org_id is not null and app.has_permission('admin.roles', r.org_id)) )
  with check ( exists (select 1 from public.roles r where r.id = role_id
                  and r.org_id is not null and app.is_member(r.org_id)) );

-- ── user_roles (§4.1) ────────────────────────────────────────────────────────
create policy ur_select on public.user_roles for select
  using ( user_id = auth.uid() or app.has_permission('admin.users', org_id) );
create policy ur_write on public.user_roles for all
  using ( app.has_permission('admin.users', org_id) )
  with check ( app.is_member(org_id)
               and exists (select 1 from public.roles r
                           where r.id = role_id and (r.org_id = org_id or r.org_id is null)) );

-- ── invitations (§4.1) ───────────────────────────────────────────────────────
create policy inv_select on public.invitations for select
  using ( app.has_permission('admin.users', org_id) and deleted_at is null );
create policy inv_insert on public.invitations for insert
  with check ( app.has_permission('admin.users', org_id)
               and app.has_active_subscription(org_id)
               and app.within_plan_limit(org_id, 'seats') );
create policy inv_update on public.invitations for update
  using ( app.has_permission('admin.users', org_id) )
  with check ( app.is_member(org_id) );
create policy inv_delete on public.invitations for delete using ( app.is_org_owner(org_id) );

-- ── number_sequences (§4.1) ──────────────────────────────────────────────────
create policy nseq_select on public.number_sequences for select
  using ( app.is_member(org_id) );
create policy nseq_write on public.number_sequences for all
  using ( app.has_permission('settings.manage', org_id)
          or app.has_permission('quotes.create', org_id)
          or app.has_permission('invoices.create', org_id)
          or app.has_permission('sales_orders.create', org_id)
          or app.has_permission('challans.create', org_id) )
  with check ( app.is_member(org_id) );

-- ── audit_logs (§4.1) — append-only, immutable ───────────────────────────────
create policy audit_select on public.audit_logs for select
  using ( app.is_member(org_id)
          and ( app.is_org_owner(org_id) or app.has_permission('admin.audit', org_id) ) );
create policy audit_insert on public.audit_logs for insert
  with check ( app.is_member(org_id) and (actor_id = auth.uid() or actor_id is null) );
-- NO update / delete policy → permanently immutable.

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- set updated_at on every UPDATE
create or replace function app.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_org_updated      before update on public.organizations         for each row execute function app.set_updated_at();
create trigger trg_os_updated        before update on public.organization_settings for each row execute function app.set_updated_at();
create trigger trg_users_updated     before update on public.users                 for each row execute function app.set_updated_at();
create trigger trg_mem_updated       before update on public.memberships           for each row execute function app.set_updated_at();
create trigger trg_roles_updated     before update on public.roles                 for each row execute function app.set_updated_at();
create trigger trg_inv_updated       before update on public.invitations           for each row execute function app.set_updated_at();
create trigger trg_nseq_updated      before update on public.number_sequences      for each row execute function app.set_updated_at();

-- Block self-elevation of is_super_admin (RLS_POLICIES.md §4.1 / §7.4 note).
create or replace function app.block_super_admin_change()
returns trigger language plpgsql as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin and not app.is_super_admin() then
    raise exception 'is_super_admin cannot be changed by a non-super-admin';
  end if;
  return new;
end $$;
create trigger trg_users_block_sa before update on public.users
  for each row execute function app.block_super_admin_change();

-- Mirror auth.users → public.users on signup (API_DESIGN.md §5.3 user.created).
-- SECURITY DEFINER so it can insert despite RLS; idempotent on email/id conflict.
create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, app as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger trg_auth_user_created
  after insert on auth.users for each row execute function app.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Org provisioning (RLS_POLICIES.md §1.4 "creates the first membership before
-- one exists"). SECURITY DEFINER atomic transaction; validates auth.uid().
-- Returns the new org id. Callable by authenticated users only.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_organization(
  p_name       text,
  p_slug       text default null,
  p_legal_name text default null,
  p_gstin      text default null,
  p_address    text default null
)
returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
  v_owner_role uuid;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'organization name is required' using errcode = '22023';
  end if;

  insert into public.organizations (name, slug, legal_name, gstin, address, created_by)
    values (p_name, nullif(p_slug,''), nullif(p_legal_name,''), nullif(p_gstin,''),
            nullif(p_address,''), v_uid)
    returning id into v_org;

  insert into public.organization_settings (org_id, created_by) values (v_org, v_uid);

  insert into public.memberships (org_id, user_id, is_default, is_billable, created_by)
    values (v_org, v_uid, true, true, v_uid);

  select id into v_owner_role from public.roles where key = 'company_owner' and org_id is null;
  if v_owner_role is null then
    raise exception 'company_owner system role not seeded' using errcode = 'P0001';
  end if;
  insert into public.user_roles (org_id, user_id, role_id, created_by)
    values (v_org, v_uid, v_owner_role, v_uid);

  insert into public.audit_logs (org_id, actor_id, entity_type, entity_id, action, after)
    values (v_org, v_uid, 'organizations', v_org, 'insert',
            jsonb_build_object('name', p_name, 'slug', p_slug));

  return v_org;
end $$;

revoke all on function public.create_organization(text,text,text,text,text) from public;
grant execute on function public.create_organization(text,text,text,text,text) to authenticated;
