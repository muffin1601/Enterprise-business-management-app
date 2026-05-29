-- 0004_audit_triggers.sql
-- Audit logging (AUDIT_LOGS.md). Adds the additive context columns, the generic
-- capture trigger fn_audit() + redaction fn_audit_redact() (§3a, §5.1), the
-- append-only immutability guard (§2.2), trigger attachments for the
-- security-significant identity tables (§4 #6–7), and the read views (§6).
--
-- Scope note: fn_audit() is generic over tables that have BOTH an `id` PK and an
-- `org_id` column. In the identity domain that is memberships, user_roles, and
-- invitations — the membership/invitation/role-change events §4 calls out.
--   • organizations has no org_id column (its id IS the org) and is already
--     audited by the create_organization RPC (0002) — not re-attached here.
--   • organization_settings keys on org_id (no `id`) → deferred to the Company
--     settings module, which will attach a settings-specific trigger.
--   • users login is recorded as an app-layer intent event (lib/audit), per §4 #9.

-- ── Additive context columns (AUDIT_LOGS.md §2; nullable, immutability intact) ─
alter table public.audit_logs add column if not exists user_agent text;
alter table public.audit_logs add column if not exists request_id text;

-- ─────────────────────────────────────────────────────────────────────────────
-- §5.1 Redaction — strip/mask PII & secrets BEFORE anything is persisted.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function app.fn_audit_redact(p_table text, p_row jsonb)
returns jsonb language plpgsql immutable as $$
declare
  v_drop text[];   -- fully removed (replaced with "<redacted>")
  v_mask text[];   -- last-4 partial mask
  k text;
begin
  v_drop := case p_table
    when 'invitations' then array['token']
    else array[]::text[] end;

  v_mask := case p_table
    when 'users'     then array['phone','email']
    else array[]::text[] end;

  -- pattern-based secret scrub (defence in depth)
  for k in select jsonb_object_keys(p_row) loop
    if k ~* '(token|secret|password|api_key)$' then
      v_drop := array_append(v_drop, k);
    end if;
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

-- ─────────────────────────────────────────────────────────────────────────────
-- §3a Generic capture trigger. SECURITY DEFINER (owned by a BYPASSRLS role on
-- Supabase) so it can always append regardless of the caller's RLS, and fires
-- AFTER the write in the same txn so no write escapes it.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function app.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_actor   uuid;
  v_org     uuid;
  v_before  jsonb;
  v_after   jsonb;
  v_changed text[];
  v_action  public.audit_action;
  v_claims  jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  v_actor := nullif(v_claims ->> 'sub', '')::uuid;

  if (tg_op = 'INSERT') then
    v_action := 'insert';
    v_after  := app.fn_audit_redact(tg_table_name, to_jsonb(new));
    v_org    := new.org_id;
  elsif (tg_op = 'UPDATE') then
    v_action := 'update';
    v_before := app.fn_audit_redact(tg_table_name, to_jsonb(old));
    v_after  := app.fn_audit_redact(tg_table_name, to_jsonb(new));
    v_org    := new.org_id;
    select array_agg(key)
      into v_changed
      from jsonb_each(v_after) a
      where a.value is distinct from (v_before -> a.key)
        and a.key not in ('updated_at');
    if v_changed is null then
      return null;  -- no-op update (only updated_at bumped)
    end if;
  elsif (tg_op = 'DELETE') then
    v_action := 'delete';
    v_before := app.fn_audit_redact(tg_table_name, to_jsonb(old));
    v_org    := old.org_id;
  end if;

  insert into public.audit_logs
    (org_id, actor_id, entity_type, entity_id, action,
     before, after, changed_fields, ip, user_agent, request_id, at)
  values
    (v_org, v_actor, tg_table_name,
     coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'))::uuid,
     v_action, v_before, v_after, v_changed,
     nullif(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for','')::inet,
     current_setting('request.headers', true)::jsonb ->> 'user-agent',
     nullif(current_setting('app.request_id', true), ''),
     now());

  return null;  -- AFTER trigger
end $$;

-- ── Attach to the security-significant identity tables (§4 #6–7) ──────────────
create trigger trg_audit_memberships
  after insert or update or delete on public.memberships
  for each row execute function app.fn_audit();

create trigger trg_audit_user_roles
  after insert or update or delete on public.user_roles
  for each row execute function app.fn_audit();

create trigger trg_audit_invitations
  after insert or update or delete on public.invitations
  for each row execute function app.fn_audit();

-- ─────────────────────────────────────────────────────────────────────────────
-- §2.2 Append-only enforcement — block UPDATE/DELETE even for the service role.
-- (0002 already declared SELECT/INSERT-only RLS; this is belt-and-braces.)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function app.fn_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only (% blocked)', tg_op
    using errcode = 'check_violation';
end $$;

create trigger trg_audit_no_update
  before update or delete on public.audit_logs
  for each row execute function app.fn_audit_immutable();

revoke update, delete on public.audit_logs from authenticated, anon, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- §6 Read views (security_barrier; gated by admin.audit / owner via the views'
-- own predicates, consistent with the audit_select policy in 0002).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace view public.v_audit_entity_history
with (security_barrier) as
  select a.id, a.at, a.action, a.actor_id, u.full_name as actor_name,
         a.entity_type, a.entity_id, a.changed_fields, a.before, a.after,
         a.ip, a.request_id
  from public.audit_logs a
  left join public.users u on u.id = a.actor_id
  where app.is_member(a.org_id)
    and (app.is_org_owner(a.org_id) or app.has_permission('admin.audit', a.org_id));

create or replace view public.v_audit_actor_activity
with (security_barrier) as
  select a.at, a.action, a.entity_type, a.entity_id, a.changed_fields, a.org_id
  from public.audit_logs a
  where app.is_member(a.org_id)
    and (app.is_org_owner(a.org_id) or app.has_permission('admin.audit', a.org_id));
