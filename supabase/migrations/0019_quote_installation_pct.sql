-- ─────────────────────────────────────────────────────────────────────────────
-- 0019 · Percentage-based installation charge per quote location
--
-- Adds an optional `installation_pct` to quote_locations. When set (NOT NULL),
-- the location's installation_charge is derived as a percentage of that
-- location's material_subtotal (computed server-side in calculateQuoteTotals).
-- When NULL, installation_charge is a flat amount entered directly (legacy
-- behaviour). installation_charge remains the authoritative stored value so all
-- downstream readers (preview, list cards, sales-order conversion) are unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

alter table quote_locations
  add column if not exists installation_pct numeric(6,3);
