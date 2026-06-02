-- 0012_purchase_orders.sql
-- Purchase Orders module: purchase_orders, po_items, po_status_history,
-- goods_receipts, grn_items.
-- A PO can ONLY be created from an invoice with status = 'issued'.
-- GRN trigger auto-updates items.stock and PO status.
-- RLS uses app.is_member / app.has_permission helpers from 0002.

-- ── purchase_orders ───────────────────────────────────────────────────────────

create table public.purchase_orders (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null references public.organizations(id) on delete restrict,
  po_no               text        not null,
  invoice_id          uuid        not null references public.invoices(id) on delete restrict,
  vendor_id           uuid        not null references public.vendors(id) on delete restrict,
  customer_ref        text,
  subject             text,
  date                date        not null default current_date,
  expected_delivery   date,
  status              text        not null default 'draft'
                                  check (status in (
                                    'draft',
                                    'pending_approval',
                                    'approved',
                                    'sent',
                                    'partially_received',
                                    'received',
                                    'closed',
                                    'cancelled'
                                  )),
  -- Commercial
  gst_mode            text        not null default 'add'
                                  check (gst_mode in ('add','inclusive','none')),
  gst_pct             numeric     not null default 18,
  is_igst             boolean     not null default false,
  transport           numeric     not null default 0,
  transport_note      text,
  -- Financials (auto-calculated)
  taxable_value       numeric     not null default 0,
  cgst_amount         numeric     not null default 0,
  sgst_amount         numeric     not null default 0,
  igst_amount         numeric     not null default 0,
  total_gst           numeric     not null default 0,
  grand_total         numeric     not null default 0,
  -- Payment
  payment_terms       text,
  advance_amount      numeric     not null default 0,
  advance_paid        boolean     not null default false,
  -- Document
  notes               text,
  terms               jsonb       not null default '[]',
  internal_notes      text,
  -- Approval / dispatch metadata
  approved_by         uuid,
  approved_at         timestamptz,
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid,
  deleted_at          timestamptz
);

create unique index uq_po_no
  on public.purchase_orders (org_id, po_no)
  where deleted_at is null;

-- One active PO per invoice+vendor (cancelled POs don't block re-ordering)
create unique index uq_po_invoice_vendor
  on public.purchase_orders (invoice_id, vendor_id)
  where deleted_at is null and status != 'cancelled';

create index idx_po_org     on public.purchase_orders (org_id);
create index idx_po_vendor  on public.purchase_orders (vendor_id);
create index idx_po_invoice on public.purchase_orders (invoice_id);
create index idx_po_status  on public.purchase_orders (status);
create index idx_po_date    on public.purchase_orders (date);

-- ── po_items ──────────────────────────────────────────────────────────────────

create table public.po_items (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null,
  po_id               uuid        not null references public.purchase_orders(id) on delete cascade,
  invoice_item_id     uuid        references public.invoice_items(id) on delete set null,
  item_id             uuid        references public.items(id) on delete set null,
  name                text        not null,
  description         text,
  hsn_code            text,
  brand               text,
  unit                text,
  -- Demand
  invoice_qty         numeric     not null default 0,
  -- Stock snapshot at PO creation time
  stock_at_creation   numeric     not null default 0,
  -- Ordering
  qty_ordered         numeric     not null default 0,
  qty_received        numeric     not null default 0,
  -- Pricing (purchase rates — different from selling rates on invoice)
  rate                numeric     not null default 0,
  discount_pct        numeric     not null default 0,
  taxable_value       numeric     not null default 0,
  gst_pct             numeric     not null default 18,
  cgst_pct            numeric     not null default 9,
  sgst_pct            numeric     not null default 9,
  igst_pct            numeric     not null default 0,
  cgst_amount         numeric     not null default 0,
  sgst_amount         numeric     not null default 0,
  igst_amount         numeric     not null default 0,
  total               numeric     not null default 0,
  sort_order          integer     not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_po_items_po       on public.po_items (po_id);
create index idx_po_items_item     on public.po_items (item_id);
create index idx_po_items_inv_item on public.po_items (invoice_item_id);

-- ── po_status_history ─────────────────────────────────────────────────────────

create table public.po_status_history (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null,
  po_id       uuid        not null references public.purchase_orders(id) on delete cascade,
  from_status text,
  to_status   text        not null,
  note        text,
  changed_by  uuid,
  changed_at  timestamptz not null default now()
);

create index idx_po_history_po  on public.po_status_history (po_id);
create index idx_po_history_org on public.po_status_history (org_id);

-- ── goods_receipts ────────────────────────────────────────────────────────────

create table public.goods_receipts (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null,
  po_id         uuid        not null references public.purchase_orders(id) on delete restrict,
  grn_no        text        not null,
  date          date        not null default current_date,
  delivery_note text,
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid
);

create index idx_grn_po  on public.goods_receipts (po_id);
create index idx_grn_org on public.goods_receipts (org_id);

-- ── grn_items ─────────────────────────────────────────────────────────────────

create table public.grn_items (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        not null,
  grn_id        uuid        not null references public.goods_receipts(id) on delete cascade,
  po_item_id    uuid        not null references public.po_items(id) on delete restrict,
  item_id       uuid        references public.items(id) on delete set null,
  qty_received  numeric     not null check (qty_received > 0),
  batch_no      text,
  created_at    timestamptz not null default now()
);

create index idx_grn_items_grn     on public.grn_items (grn_id);
create index idx_grn_items_po_item on public.grn_items (po_item_id);

-- ── GRN trigger: roll up qty_received, update stock, auto-transition PO ──────

create or replace function app.fn_grn_post()
returns trigger language plpgsql security definer as $$
declare
  v_po_item_id    uuid;
  v_po_id         uuid;
  v_item_id       uuid;
  v_total_received numeric;
  v_all_received  boolean;
begin
  v_po_item_id := coalesce(new.po_item_id, old.po_item_id);
  v_item_id    := coalesce(new.item_id,    old.item_id);

  -- Roll up total qty_received for this po_item
  select coalesce(sum(qty_received), 0)
    into v_total_received
    from public.grn_items
   where po_item_id = v_po_item_id;

  update public.po_items
     set qty_received = v_total_received
   where id = v_po_item_id;

  -- Update items.stock (inward movement)
  if TG_OP = 'INSERT' and v_item_id is not null then
    update public.items set stock = stock + new.qty_received where id = v_item_id;
  elsif TG_OP = 'DELETE' and v_item_id is not null then
    update public.items set stock = greatest(0, stock - old.qty_received) where id = v_item_id;
  end if;

  -- Get po_id
  select po_id into v_po_id from public.po_items where id = v_po_item_id;

  -- Auto-transition PO status
  select bool_and(qty_received >= qty_ordered)
    into v_all_received
    from public.po_items
   where po_id = v_po_id and qty_ordered > 0;

  if v_all_received = true then
    update public.purchase_orders
       set status = 'received', updated_at = now()
     where id = v_po_id and status not in ('received','closed','cancelled');
  elsif v_total_received > 0 then
    update public.purchase_orders
       set status = 'partially_received', updated_at = now()
     where id = v_po_id and status = 'sent';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger tg_grn_post
  after insert or delete on public.grn_items
  for each row execute function app.fn_grn_post();

-- ── updated_at triggers ───────────────────────────────────────────────────────

create trigger tg_po_updated_at
  before update on public.purchase_orders
  for each row execute function app.fn_set_updated_at();

create trigger tg_po_items_updated_at
  before update on public.po_items
  for each row execute function app.fn_set_updated_at();

-- ── audit triggers ────────────────────────────────────────────────────────────

do $$ begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'fn_audit'
  ) then
    execute $t$
      create trigger tg_po_audit
        after insert or update or delete on public.purchase_orders
        for each row execute function app.fn_audit();
      create trigger tg_po_items_audit
        after insert or update or delete on public.po_items
        for each row execute function app.fn_audit();
      create trigger tg_grn_audit
        after insert or delete on public.goods_receipts
        for each row execute function app.fn_audit();
    $t$;
  end if;
end $$;

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.purchase_orders    enable row level security;
alter table public.po_items           enable row level security;
alter table public.po_status_history  enable row level security;
alter table public.goods_receipts     enable row level security;
alter table public.grn_items          enable row level security;

-- purchase_orders
create policy "po: members can select"
  on public.purchase_orders for select
  using (app.is_member(org_id) and deleted_at is null);
create policy "po: members can insert"
  on public.purchase_orders for insert
  with check (app.has_permission('purchase_orders.create', org_id));
create policy "po: members can update"
  on public.purchase_orders for update
  using  (app.has_permission('purchase_orders.edit', org_id) and deleted_at is null)
  with check (app.has_permission('purchase_orders.edit', org_id) or app.has_permission('purchase_orders.approve', org_id));
create policy "po: members can delete"
  on public.purchase_orders for delete
  using (app.has_permission('purchase_orders.delete', org_id));

-- po_items
create policy "po_items: members can select"
  on public.po_items for select using (app.is_member(org_id));
create policy "po_items: members can insert"
  on public.po_items for insert with check (app.has_permission('purchase_orders.create', org_id));
create policy "po_items: members can update"
  on public.po_items for update
  using  (app.has_permission('purchase_orders.edit', org_id))
  with check (app.has_permission('purchase_orders.edit', org_id));
create policy "po_items: members can delete"
  on public.po_items for delete using (app.has_permission('purchase_orders.edit', org_id));

-- po_status_history
create policy "po_history: members can select"
  on public.po_status_history for select using (app.is_member(org_id));
create policy "po_history: members can insert"
  on public.po_status_history for insert
  with check (app.has_permission('purchase_orders.edit', org_id) or app.has_permission('purchase_orders.approve', org_id));

-- goods_receipts
create policy "grn: members can select"
  on public.goods_receipts for select using (app.is_member(org_id));
create policy "grn: members can insert"
  on public.goods_receipts for insert
  with check (app.has_permission('purchase_orders.receive', org_id));
create policy "grn: members can delete"
  on public.goods_receipts for delete
  using (app.has_permission('purchase_orders.receive', org_id));

-- grn_items
create policy "grn_items: members can select"
  on public.grn_items for select using (app.is_member(org_id));
create policy "grn_items: members can insert"
  on public.grn_items for insert
  with check (app.has_permission('purchase_orders.receive', org_id));
create policy "grn_items: members can delete"
  on public.grn_items for delete
  using (app.has_permission('purchase_orders.receive', org_id));

-- ── Permissions seed ──────────────────────────────────────────────────────────

insert into public.permissions (key, module) values
  ('purchase_orders.view',    'procurement'),
  ('purchase_orders.create',  'procurement'),
  ('purchase_orders.edit',    'procurement'),
  ('purchase_orders.approve', 'procurement'),
  ('purchase_orders.delete',  'procurement'),
  ('purchase_orders.receive', 'procurement')
on conflict (key) do nothing;

-- Grant to manager (all PO permissions)
insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r
cross join unnest(array[
  'purchase_orders.view','purchase_orders.create','purchase_orders.edit',
  'purchase_orders.approve','purchase_orders.delete','purchase_orders.receive'
]) k
where r.key = 'manager' and r.org_id is null
on conflict do nothing;

-- Grant to employee (view, create, edit, receive)
insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r
cross join unnest(array[
  'purchase_orders.view','purchase_orders.create','purchase_orders.edit','purchase_orders.receive'
]) k
where r.key = 'employee' and r.org_id is null
on conflict do nothing;

-- Grant to accountant (view, receive)
insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r
cross join unnest(array['purchase_orders.view','purchase_orders.receive']) k
where r.key = 'accountant' and r.org_id is null
on conflict do nothing;
