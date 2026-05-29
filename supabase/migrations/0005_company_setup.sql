-- 0005_company_setup.sql
-- Company Setup module DB layer. No new tables (DATABASE_SCHEMA.md §3.1 already
-- defines organization_settings, invitations, memberships, user_roles).
-- Adds: (1) audit coverage for organization_settings, (2) a SECURITY DEFINER
-- accept-invitation RPC (the invitee is not yet a member, so RLS mem_insert
-- would block a self-insert), (3) a token preview RPC for the accept screen.

-- ─────────────────────────────────────────────────────────────────────────────
-- (1) Audit trigger for organization_settings.
-- The generic app.fn_audit (0004) derives entity_id from `id`; organization_settings
-- keys on org_id (no `id`), so it needs this dedicated variant (AUDIT_LOGS.md §4,
-- "Also audited … organization_settings (esp. approval_limits)").
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function app.fn_audit_org_settings()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_actor   uuid := nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid;
  v_before  jsonb;
  v_after   jsonb;
  v_changed text[];
  v_action  public.audit_action;
  v_org     uuid;
begin
  if (tg_op = 'INSERT') then
    v_action := 'insert';
    v_after  := app.fn_audit_redact('organization_settings', to_jsonb(new));
    v_org    := new.org_id;
  elsif (tg_op = 'UPDATE') then
    v_action := 'update';
    v_before := app.fn_audit_redact('organization_settings', to_jsonb(old));
    v_after  := app.fn_audit_redact('organization_settings', to_jsonb(new));
    v_org    := new.org_id;
    select array_agg(key) into v_changed
      from jsonb_each(v_after) a
      where a.value is distinct from (v_before -> a.key) and a.key not in ('updated_at');
    if v_changed is null then return null; end if;
  elsif (tg_op = 'DELETE') then
    v_action := 'delete';
    v_before := app.fn_audit_redact('organization_settings', to_jsonb(old));
    v_org    := old.org_id;
  end if;

  insert into public.audit_logs
    (org_id, actor_id, entity_type, entity_id, action, before, after, changed_fields,
     ip, user_agent, request_id, at)
  values
    (v_org, v_actor, 'organization_settings', v_org, v_action, v_before, v_after, v_changed,
     nullif(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for','')::inet,
     current_setting('request.headers', true)::jsonb ->> 'user-agent',
     nullif(current_setting('app.request_id', true), ''),
     now());
  return null;
end $$;

create trigger trg_audit_org_settings
  after insert or update or delete on public.organization_settings
  for each row execute function app.fn_audit_org_settings();

-- ─────────────────────────────────────────────────────────────────────────────
-- (2) Accept invitation — SECURITY DEFINER (RLS_POLICIES.md §1.4 provisioning
-- pattern). Validates the token + that the invitee's email matches, then creates
-- the membership + role grant and marks the invite accepted, all atomically.
-- Returns the org id. The fn_audit triggers (0004) capture the membership/role
-- inserts and the invitation status change; actor resolves from the JWT.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = public, app as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email');
  v_inv   public.invitations%rowtype;
  v_is_default boolean;
begin
  if v_uid is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;

  select * into v_inv from public.invitations where token = p_token;
  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'invitation is no longer pending' using errcode = 'P0001';
  end if;
  if v_inv.expires_at < now() then
    update public.invitations set status = 'expired' where id = v_inv.id;
    raise exception 'invitation has expired' using errcode = 'P0001';
  end if;
  if v_email is null or lower(v_inv.email) <> v_email then
    raise exception 'invitation email does not match the signed-in account'
      using errcode = '42501';
  end if;

  -- First org for this user becomes their default.
  v_is_default := not exists (select 1 from public.memberships m where m.user_id = v_uid);

  insert into public.memberships (org_id, user_id, is_default, is_billable, created_by)
    values (v_inv.org_id, v_uid, v_is_default, true, v_uid)
    on conflict (org_id, user_id) do nothing;

  if v_inv.role_id is not null then
    insert into public.user_roles (org_id, user_id, role_id, created_by)
      values (v_inv.org_id, v_uid, v_inv.role_id, v_uid)
      on conflict (org_id, user_id, role_id) do nothing;
  end if;

  update public.invitations
     set status = 'accepted', accepted_at = now()
   where id = v_inv.id;

  return v_inv.org_id;
end $$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- (3) Invitation preview for the accept screen. The invitee cannot SELECT the
-- invitations row (inv_select requires admin.users), so this SECURITY DEFINER
-- function returns only the safe display fields for a valid token. Token =
-- bearer secret; possession is the authorization.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.invitation_preview(p_token text)
returns table (org_name text, email text, role_name text, status text, expired boolean)
language sql security definer set search_path = public, app stable as $$
  select o.name,
         i.email,
         r.name,
         i.status,
         (i.expires_at < now()) as expired
  from public.invitations i
  join public.organizations o on o.id = i.org_id
  left join public.roles r on r.id = i.role_id
  where i.token = p_token;
$$;

revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to authenticated;
