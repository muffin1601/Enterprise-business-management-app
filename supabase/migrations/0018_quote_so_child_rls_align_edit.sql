-- ─────────────────────────────────────────────────────────────────────────────
-- 0018 · Align quote & sales-order child-table write policies with *.edit
--
-- BUG: Saving an edited quote / sales order replaces its locations & items by
-- DELETE-then-INSERT (features/quotes/server/actions.ts and
-- features/sales-orders/server/actions.ts → upsert* helpers). The original RLS
-- policies (0008_quotes.sql, 0009_sales_orders.sql) gated child rows as:
--   • INSERT on  <module>.create
--   • DELETE on  <module>.delete
-- A non-owner user whose role has <module>.edit but NOT <module>.delete (e.g. the
-- seeded `employee` role — see 0003_seed_roles_permissions.sql) cannot delete the
-- old child rows. Under RLS a DELETE whose USING clause matches no rows deletes
-- nothing AND raises no error, so the replace silently degrades into "insert
-- only": stale locations/items survive while fresh copies are added, so the
-- document accumulates duplicates and edits appear "not to save". Org owners and
-- super admins bypass app.has_permission(), which is why it reproduces only for
-- non-owner staff.
--
-- FIX: Editing a parent document owns the lifecycle of its child rows. Gate child
-- INSERT and DELETE on <module>.edit, keeping the original create/delete grants
-- via OR so privileged roles and the create-new-document flow are unaffected.
--
-- (invoice_items and ri_items already gate DELETE on *.edit — no change needed.)
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ Quotes ═══════════════════════════════════════════════════════════════════
drop policy if exists "quote_locations: members can insert" on public.quote_locations;
create policy "quote_locations: members can insert"
  on public.quote_locations for insert
  with check (app.has_permission('quotes.edit', org_id) or app.has_permission('quotes.create', org_id));

drop policy if exists "quote_locations: members can delete" on public.quote_locations;
create policy "quote_locations: members can delete"
  on public.quote_locations for delete
  using (app.has_permission('quotes.edit', org_id) or app.has_permission('quotes.delete', org_id));

drop policy if exists "quote_items: members can insert" on public.quote_items;
create policy "quote_items: members can insert"
  on public.quote_items for insert
  with check (app.has_permission('quotes.edit', org_id) or app.has_permission('quotes.create', org_id));

drop policy if exists "quote_items: members can delete" on public.quote_items;
create policy "quote_items: members can delete"
  on public.quote_items for delete
  using (app.has_permission('quotes.edit', org_id) or app.has_permission('quotes.delete', org_id));

-- ══ Sales Orders ═════════════════════════════════════════════════════════════
drop policy if exists "so_locations: members can insert" on public.so_locations;
create policy "so_locations: members can insert"
  on public.so_locations for insert
  with check (app.has_permission('sales_orders.edit', org_id) or app.has_permission('sales_orders.create', org_id));

drop policy if exists "so_locations: members can delete" on public.so_locations;
create policy "so_locations: members can delete"
  on public.so_locations for delete
  using (app.has_permission('sales_orders.edit', org_id) or app.has_permission('sales_orders.delete', org_id));

drop policy if exists "so_items: members can insert" on public.so_items;
create policy "so_items: members can insert"
  on public.so_items for insert
  with check (app.has_permission('sales_orders.edit', org_id) or app.has_permission('sales_orders.create', org_id));

drop policy if exists "so_items: members can delete" on public.so_items;
create policy "so_items: members can delete"
  on public.so_items for delete
  using (app.has_permission('sales_orders.edit', org_id) or app.has_permission('sales_orders.delete', org_id));
