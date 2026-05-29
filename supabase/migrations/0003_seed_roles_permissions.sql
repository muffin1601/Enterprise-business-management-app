-- 0003_seed_roles_permissions.sql
-- Reference data: the permission catalog (PERMISSIONS.md §2), the 6 system
-- roles (org_id NULL, is_system), and role→permission grants (PERMISSIONS.md §3).
-- company_owner gets NO rows — it is implicit-all via app.is_org_owner().
-- Idempotent (on conflict do nothing) so re-running is safe.

-- ── Permission catalog ───────────────────────────────────────────────────────
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

-- ── System roles (org_id NULL) ───────────────────────────────────────────────
insert into public.roles (org_id, key, name, is_system) values
  (null,'company_owner','Company Owner', true),
  (null,'manager',      'Manager',       true),
  (null,'employee',     'Employee',      true),
  (null,'accountant',   'Accountant',    true),
  (null,'hr',           'HR',            true)
on conflict (key) where org_id is null do nothing;

-- ── Grants (PERMISSIONS.md §3). ⚙ threshold keys are granted; the ceiling is
--    enforced at the server/approval layer. ──────────────────────────────────
insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r
cross join unnest(array[
  'dashboard.view','items.view','items.create','items.edit','stock.adjust','pricing.override',
  'stock_report.view','stock_report.export','customers.view','customers.create','customers.edit',
  'running_bill.view','quotes.view','quotes.create','quotes.edit','quotes.revise','quotes.delete',
  'quotes.export','sales_orders.view','sales_orders.create','sales_orders.edit','sales_orders.delete',
  'challans.view','challans.create','challans.edit','challans.post','challans.delete','payments.view',
  'invoices.view','discount.post_sale','discount.approve','finance.view','expenses.create','expenses.approve',
  'reports.sales.view','reports.inventory.view','reports.financial.view','reports.hr.view','reports.export',
  'hr.view','leave.approve','support.view','support.manage'
]) k
where r.key = 'manager' and r.org_id is null
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r
cross join unnest(array[
  'dashboard.view','items.view','stock_report.view','customers.view','customers.create','customers.edit',
  'running_bill.view','quotes.view','quotes.create','quotes.edit','quotes.revise','quotes.export',
  'sales_orders.view','sales_orders.create','challans.view','challans.create','invoices.view',
  'reports.sales.view','reports.inventory.view','support.view','expenses.create'
]) k
where r.key = 'employee' and r.org_id is null
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r
cross join unnest(array[
  'dashboard.view','items.view','stock_report.view','stock_report.export','customers.view','customers.edit',
  'running_bill.view','quotes.view','sales_orders.view','challans.view','payments.view','payments.record',
  'payments.delete','invoices.view','invoices.create','invoices.edit','invoices.issue','invoices.delete',
  'discount.post_sale','discount.approve','finance.view','finance.manage','expenses.create','expenses.approve',
  'payroll.view','payroll.manage','reports.sales.view','reports.inventory.view','reports.financial.view',
  'reports.export','admin.audit'
]) k
where r.key = 'accountant' and r.org_id is null
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, k from public.roles r
cross join unnest(array[
  'dashboard.view','payroll.view','reports.hr.view','reports.export','hr.view','hr.manage',
  'leave.approve','expenses.create'
]) k
where r.key = 'hr' and r.org_id is null
on conflict do nothing;
