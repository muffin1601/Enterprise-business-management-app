-- 0006_user_management.sql
-- User Management module DB layer. No new tables.
--
-- Role assignment needs no function: RLS `ur_write`/`ur_cud` already lets an
-- `admin.users` holder INSERT/DELETE user_roles, and trg_audit_user_roles (0004)
-- audits those writes. The one piece that needs a SECURITY DEFINER RPC is
-- activate/deactivate: RLS `users_update_self` only lets a user edit their OWN
-- row (or super admin), so an org admin cannot flip another member's status
-- directly. This RPC enforces the admin.users permission + membership and writes
-- the audit row itself (public.users has no fn_audit trigger — no org_id).
--
-- Caveat: public.users.status is account-level (record_status), not per-org.
-- In a single-company tenant it is the member's active flag; documented so a
-- future per-org membership status (if needed) supersedes it cleanly.

create or replace function public.set_user_status(p_user_id uuid, p_org uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public, app as $$
declare
  v_actor uuid := auth.uid();
  v_old   public.record_status;
  v_new   public.record_status := case when p_active then 'active' else 'inactive' end;
begin
  if v_actor is null then
    raise exception 'unauthenticated' using errcode = '28000';
  end if;
  if not app.has_permission('admin.users', p_org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.memberships m where m.org_id = p_org and m.user_id = p_user_id) then
    raise exception 'target is not a member of this organization' using errcode = 'P0002';
  end if;
  if p_user_id = v_actor then
    raise exception 'you cannot change your own status' using errcode = 'P0001';
  end if;
  -- Never lock out the company owner.
  if not p_active and exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and ur.org_id = p_org and r.key = 'company_owner'
  ) then
    raise exception 'cannot deactivate the company owner' using errcode = 'P0001';
  end if;

  select status into v_old from public.users where id = p_user_id;
  if v_old is distinct from v_new then
    update public.users set status = v_new where id = p_user_id;
    insert into public.audit_logs
      (org_id, actor_id, entity_type, entity_id, action, before, after, changed_fields)
    values
      (p_org, v_actor, 'users', p_user_id, 'update',
       jsonb_build_object('status', v_old), jsonb_build_object('status', v_new), array['status']);
  end if;
end $$;

revoke all on function public.set_user_status(uuid, uuid, boolean) from public;
grant execute on function public.set_user_status(uuid, uuid, boolean) to authenticated;
