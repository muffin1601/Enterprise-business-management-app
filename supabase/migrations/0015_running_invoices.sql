-- 0015_running_invoices.sql
-- Running Invoices (progressive billing) module.
-- Converts delivered DC quantities into tax invoices using SO agreed prices.
-- Anti-double-billing via so_items.qty_invoiced.
-- Immutable after posted; cancellations reverse qty_invoiced.

-- ── Addendum to existing tables ───────────────────────────────────────────────

-- Track how much of each SO line has already been invoiced (prevents double-billing)
alter table public.so_items
  add column if not exists qty_invoiced numeric not null default 0;
 
-- Mark delivery challans as included in a running invoice
alter table public.delivery_challans
  add column if not exists invoiced_at          timestamptz,
  add column if not exists running_invoice_id   uuid;

-- ── running_invoices ──────────────────────────────────────────────────────────

create table public.running_invoices (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null references public.organizations(id) on delete restrict,
  ri_no               text        not null,
  so_id               uuid        not null references public.sales_orders(id) on delete restrict,
  customer_id         uuid        references public.customers(id) on delete set null,
  subject             text,
  date                date        not null default current_date,
  due_date            date,
  status              text        not null default 'draft'
                                  check (status in (
                                    'draft',
                                    'validated',
                                    'posted',
                                    'sent',
                                    'cancelled'
                                  )),
  -- Billing snapshot (from customer at creation time)
  billing_name        text,
  billing_address     text,
  customer_gstin      text,
  -- GST
  place_of_supply     text,
  is_igst             boolean     not null default false,
  gst_pct             numeric     not null default 18,
  -- Financials (immutable after posted)
  taxable_value       numeric     not null default 0,
  cgst_amount         numeric     not null default 0,
  sgst_amount         numeric     not null default 0,
  igst_amount         numeric     not null default 0,
  total_gst           numeric     not null default 0,
  grand_total         numeric     not null default 0,
  -- E-invoicing (future)
  irn                 text,
  irn_ack_no          text,
  irn_ack_date        date,
  signed_qr           text,
  -- Payment
  amount_received     numeric     not null default 0,
  balance_due         numeric     not null default 0,
  payment_terms       text,
  -- Document
  notes               text,
  internal_notes      text,
  -- Post metadata
  posted_at           timestamptz,
  posted_by           uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid,
  deleted_at          timestamptz
);

create unique index uq_ri_no
  on public.running_invoices (org_id, ri_no)
  where deleted_at is null;

create index idx_ri_org      on public.running_invoices (org_id);
create index idx_ri_so       on public.running_invoices (so_id);
create index idx_ri_customer on public.running_invoices (customer_id);
create index idx_ri_status   on public.running_invoices (status);
create index idx_ri_date     on public.running_invoices (date);

-- FK back from delivery_challans to running_invoices
alter table public.delivery_challans
  add constraint fk_dc_running_invoice
  foreign key (running_invoice_id)
  references public.running_invoices(id)
  on delete set null;

-- ── ri_challans ───────────────────────────────────────────────────────────────

create table public.ri_challans (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null,
  ri_id           uuid        not null references public.running_invoices(id) on delete cascade,
  dc_id           uuid        not null references public.delivery_challans(id) on delete restrict,
  included_at     timestamptz not null default now()
);

create unique index uq_ri_dc on public.ri_challans (ri_id, dc_id);
create index idx_ri_challans_ri  on public.ri_challans (ri_id);
create index idx_ri_challans_dc  on public.ri_challans (dc_id);

-- ── ri_items ──────────────────────────────────────────────────────────────────

create table public.ri_items (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null,
  ri_id               uuid        not null references public.running_invoices(id) on delete cascade,
  dc_id               uuid        not null references public.delivery_challans(id) on delete restrict,
  dc_item_id          uuid        not null references public.dc_items(id) on delete restrict,
  so_item_id          uuid        references public.so_items(id) on delete set null,
  item_id             uuid        references public.items(id) on delete set null,
  -- Snapshot
  name                text        not null,
  description         text,
  hsn_code            text,
  brand               text,
  unit                text,
  -- Quantities (source: DC)
  qty_delivered       numeric     not null default 0,
  qty_already_billed  numeric     not null default 0,  -- snapshot of so_item.qty_invoiced at creation
  qty_to_bill         numeric     not null default 0,
  -- Pricing (source: SO)
  unit_price          numeric     not null default 0,
  discount_pct        numeric     not null default 0,
  -- GST
  gst_pct             numeric     not null default 18,
  cgst_pct            numeric     not null default 9,
  sgst_pct            numeric     not null default 9,
  igst_pct            numeric     not null default 0,
  -- Computed totals
  taxable_value       numeric     not null default 0,
  cgst_amount         numeric     not null default 0,
  sgst_amount         numeric     not null default 0,
  igst_amount         numeric     not null default 0,
  total               numeric     not null default 0,
  sort_order          integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_ri_items_ri      on public.ri_items (ri_id);
create index idx_ri_items_dc      on public.ri_items (dc_id);
create index idx_ri_items_so_item on public.ri_items (so_item_id);

-- ── ri_status_history ─────────────────────────────────────────────────────────

create table public.ri_status_history (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null,
  ri_id       uuid        not null references public.running_invoices(id) on delete cascade,
  from_status text,
  to_status   text        not null,
  note        text,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);

create index idx_ri_history_ri  on public.ri_status_history (ri_id);
create index idx_ri_history_org on public.ri_status_history (org_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────

create trigger tg_ri_updated_at
  before update on public.running_invoices
  for each row execute function app.fn_set_updated_at();

create trigger tg_ri_items_updated_at
  before update on public.ri_items
  for each row execute function app.fn_set_updated_at();

-- ── audit triggers ────────────────────────────────────────────────────────────

do $$ begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'fn_audit'
  ) then
    execute $t$
      create trigger tg_ri_audit
        after insert or update or delete on public.running_invoices
        for each row execute function app.fn_audit();
      create trigger tg_ri_items_audit
        after insert or update or delete on public.ri_items
        for each row execute function app.fn_audit();
    $t$;
  end if;
end $$;

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.running_invoices  enable row level security;
alter table public.ri_challans       enable row level security;
alter table public.ri_items          enable row level security;
alter table public.ri_status_history enable row level security;

-- running_invoices
create policy "ri: members can select"
  on public.running_invoices for select
  using (app.is_member(org_id) and deleted_at is null);
create policy "ri: members can insert"
  on public.running_invoices for insert
  with check (app.has_permission('running_bill.create', org_id));
create policy "ri: members can update"
  on public.running_invoices for update
  using  ((app.has_permission('running_bill.edit', org_id) or app.has_permission('running_bill.post', org_id)) and deleted_at is null)
  with check (app.has_permission('running_bill.edit', org_id) or app.has_permission('running_bill.post', org_id));
create policy "ri: members can delete"
  on public.running_invoices for delete
  using (app.has_permission('running_bill.delete', org_id));

-- ri_challans
create policy "ri_challans: members can select"
  on public.ri_challans for select using (app.is_member(org_id));
create policy "ri_challans: members can insert"
  on public.ri_challans for insert with check (app.has_permission('running_bill.create', org_id));
create policy "ri_challans: members can delete"
  on public.ri_challans for delete using (app.has_permission('running_bill.edit', org_id));

-- ri_items
create policy "ri_items: members can select"
  on public.ri_items for select using (app.is_member(org_id));
create policy "ri_items: members can insert"
  on public.ri_items for insert with check (app.has_permission('running_bill.create', org_id));
create policy "ri_items: members can update"
  on public.ri_items for update
  using  (app.has_permission('running_bill.edit', org_id))
  with check (app.has_permission('running_bill.edit', org_id));
create policy "ri_items: members can delete"
  on public.ri_items for delete using (app.has_permission('running_bill.edit', org_id));

-- ri_status_history
create policy "ri_history: members can select"
  on public.ri_status_history for select using (app.is_member(org_id));
create policy "ri_history: members can insert"
  on public.ri_status_history for insert
  with check (app.has_permission('running_bill.edit', org_id) or app.has_permission('running_bill.post', org_id));

-- ── Permissions seed ──────────────────────────────────────────────────────────

insert into public.permissions (key, module) values
  ('running_bill.create', 'crm'),
  ('running_bill.edit',   'crm'),
  ('running_bill.post',   'crm'),
  ('running_bill.delete', 'crm')
on conflict (key) do nothing;

-- Grant to manager
insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r
cross join unnest(array[
  'running_bill.view','running_bill.create','running_bill.edit',
  'running_bill.post','running_bill.delete'
]) k
where r.key = 'manager' and r.org_id is null
on conflict do nothing;

-- Grant to employee (create + edit)
insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r
cross join unnest(array[
  'running_bill.view','running_bill.create','running_bill.edit'
]) k
where r.key = 'employee' and r.org_id is null
on conflict do nothing;

-- Grant to accountant (view + post)
insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r
cross join unnest(array['running_bill.view','running_bill.post']) k
where r.key = 'accountant' and r.org_id is null
on conflict do nothing;
