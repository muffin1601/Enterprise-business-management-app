-- 0011_vendors.sql
-- Vendors module: vendors, vendor_contacts, vendor_bank_accounts,
-- vendor_notes, vendor_documents.
-- Mirrors the customers module structure exactly.
-- RLS uses app.is_member / app.has_permission helpers from 0002.
-- Audit coverage via app.fn_audit trigger (0004).
-- Includes seed data for 6 realistic Indian vendors.

-- ── vendors ───────────────────────────────────────────────────────────────────

create table public.vendors (
  id                  uuid        primary key default gen_random_uuid(),
  org_id              uuid        not null references public.organizations(id) on delete restrict,
  code                text        not null,
  name                text        not null,
  type                text        not null default 'supplier'
                                  check (type in (
                                    'supplier','manufacturer','trader',
                                    'service_provider','contractor','importer','other'
                                  )),
  status              text        not null default 'active'
                                  check (status in ('active','inactive','blacklisted')),
  contact_person      text,
  phone               text,
  email               text,
  website             text,
  gstin               text,
  pan                 text,
  msme_no             text,
  billing_address     text,
  shipping_address    text,
  city                text,
  state               text,
  pincode             text,
  country             text        not null default 'India',
  payment_terms       text        not null default 'net_30'
                                  check (payment_terms in (
                                    'immediate','net_7','net_15','net_30',
                                    'net_45','net_60','net_90','advance'
                                  )),
  credit_limit        numeric     not null default 0,
  currency            text        not null default 'INR',
  industry            text,
  tags                text[],
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid,
  updated_by          uuid,
  deleted_at          timestamptz
);

create unique index uq_vendor_code
  on public.vendors (org_id, code)
  where deleted_at is null;

create index idx_vendor_org    on public.vendors (org_id);
create index idx_vendor_status on public.vendors (status);
create index idx_vendor_type   on public.vendors (type);
create index idx_vendor_name   on public.vendors (name);

-- ── vendor_contacts ───────────────────────────────────────────────────────────

create table public.vendor_contacts (
  id             uuid        primary key default gen_random_uuid(),
  org_id         uuid        not null,
  vendor_id      uuid        not null references public.vendors(id) on delete cascade,
  name           text        not null,
  designation    text,
  email          text,
  phone          text,
  department     text,
  is_primary     boolean     not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid,
  updated_by     uuid,
  deleted_at     timestamptz
);

create index idx_vendor_contacts_vendor on public.vendor_contacts (vendor_id);
create index idx_vendor_contacts_org    on public.vendor_contacts (org_id);

-- ── vendor_bank_accounts ──────────────────────────────────────────────────────

create table public.vendor_bank_accounts (
  id              uuid        primary key default gen_random_uuid(),
  org_id          uuid        not null,
  vendor_id       uuid        not null references public.vendors(id) on delete cascade,
  account_name    text        not null,
  account_no      text        not null,
  bank_name       text        not null,
  branch          text,
  ifsc_code       text        not null,
  account_type    text        not null default 'current'
                              check (account_type in ('savings','current','cc','od')),
  is_primary      boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  deleted_at      timestamptz
);

create index idx_vendor_bank_vendor on public.vendor_bank_accounts (vendor_id);
create index idx_vendor_bank_org    on public.vendor_bank_accounts (org_id);

-- ── vendor_notes ──────────────────────────────────────────────────────────────

create table public.vendor_notes (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null,
  vendor_id   uuid        not null references public.vendors(id) on delete cascade,
  content     text        not null,
  is_pinned   boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz
);

create index idx_vendor_notes_vendor on public.vendor_notes (vendor_id);
create index idx_vendor_notes_org    on public.vendor_notes (org_id);

-- ── vendor_documents ──────────────────────────────────────────────────────────

create table public.vendor_documents (
  id          uuid        primary key default gen_random_uuid(),
  org_id      uuid        not null,
  vendor_id   uuid        not null references public.vendors(id) on delete cascade,
  name        text        not null,
  category    text        not null default 'other'
              check (category in (
                'gst_certificate','pan_card','msme_certificate',
                'trade_license','contract','nda','bank_details','other'
              )),
  file_url    text        not null,
  file_path   text        not null,
  file_size   bigint,
  mime_type   text,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  deleted_at  timestamptz
);

create index idx_vendor_docs_vendor on public.vendor_documents (vendor_id);
create index idx_vendor_docs_org    on public.vendor_documents (org_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────

create trigger tg_vendors_updated_at
  before update on public.vendors
  for each row execute function app.fn_set_updated_at();

create trigger tg_vendor_contacts_updated_at
  before update on public.vendor_contacts
  for each row execute function app.fn_set_updated_at();

create trigger tg_vendor_bank_updated_at
  before update on public.vendor_bank_accounts
  for each row execute function app.fn_set_updated_at();

create trigger tg_vendor_notes_updated_at
  before update on public.vendor_notes
  for each row execute function app.fn_set_updated_at();

-- ── audit triggers ────────────────────────────────────────────────────────────

do $$ begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.proname = 'fn_audit'
  ) then
    execute $t$
      create trigger tg_vendors_audit
        after insert or update or delete on public.vendors
        for each row execute function app.fn_audit();
      create trigger tg_vendor_contacts_audit
        after insert or update or delete on public.vendor_contacts
        for each row execute function app.fn_audit();
      create trigger tg_vendor_bank_audit
        after insert or update or delete on public.vendor_bank_accounts
        for each row execute function app.fn_audit();
    $t$;
  end if;
end $$;

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table public.vendors              enable row level security;
alter table public.vendor_contacts      enable row level security;
alter table public.vendor_bank_accounts enable row level security;
alter table public.vendor_notes         enable row level security;
alter table public.vendor_documents     enable row level security;

-- vendors
create policy "vendors: members can select"
  on public.vendors for select using (app.is_member(org_id) and deleted_at is null);
create policy "vendors: members can insert"
  on public.vendors for insert with check (app.has_permission('vendors.create', org_id));
create policy "vendors: members can update"
  on public.vendors for update
  using  (app.has_permission('vendors.edit', org_id) and deleted_at is null)
  with check (app.has_permission('vendors.edit', org_id));
create policy "vendors: members can delete"
  on public.vendors for delete using (app.has_permission('vendors.delete', org_id));

-- vendor_contacts
create policy "vendor_contacts: members can select"
  on public.vendor_contacts for select using (app.is_member(org_id));
create policy "vendor_contacts: members can insert"
  on public.vendor_contacts for insert with check (app.has_permission('vendors.edit', org_id));
create policy "vendor_contacts: members can update"
  on public.vendor_contacts for update
  using  (app.has_permission('vendors.edit', org_id))
  with check (app.has_permission('vendors.edit', org_id));
create policy "vendor_contacts: members can delete"
  on public.vendor_contacts for delete using (app.has_permission('vendors.edit', org_id));

-- vendor_bank_accounts
create policy "vendor_bank: members can select"
  on public.vendor_bank_accounts for select using (app.is_member(org_id));
create policy "vendor_bank: members can insert"
  on public.vendor_bank_accounts for insert with check (app.has_permission('vendors.edit', org_id));
create policy "vendor_bank: members can update"
  on public.vendor_bank_accounts for update
  using  (app.has_permission('vendors.edit', org_id))
  with check (app.has_permission('vendors.edit', org_id));
create policy "vendor_bank: members can delete"
  on public.vendor_bank_accounts for delete using (app.has_permission('vendors.edit', org_id));

-- vendor_notes
create policy "vendor_notes: members can select"
  on public.vendor_notes for select using (app.is_member(org_id));
create policy "vendor_notes: members can insert"
  on public.vendor_notes for insert with check (app.has_permission('vendors.edit', org_id));
create policy "vendor_notes: members can update"
  on public.vendor_notes for update
  using  (app.has_permission('vendors.edit', org_id))
  with check (app.has_permission('vendors.edit', org_id));
create policy "vendor_notes: members can delete"
  on public.vendor_notes for delete using (app.has_permission('vendors.edit', org_id));

-- vendor_documents
create policy "vendor_docs: members can select"
  on public.vendor_documents for select using (app.is_member(org_id));
create policy "vendor_docs: members can insert"
  on public.vendor_documents for insert with check (app.has_permission('vendors.edit', org_id));
create policy "vendor_docs: members can delete"
  on public.vendor_documents for delete using (app.has_permission('vendors.edit', org_id));

-- ── Seed Data — 6 realistic Indian vendors ────────────────────────────────────
-- Idempotent: only inserts if this org has 0 vendors

do $seed$
declare
  v_org uuid;
begin
  select id into v_org from public.organizations order by created_at limit 1;
  if v_org is null then return; end if;
  if exists (select 1 from public.vendors where org_id = v_org limit 1) then return; end if;

  insert into public.vendors
    (org_id, code, name, type, status, contact_person, phone, email,
     gstin, pan, payment_terms, city, state, pincode, billing_address, industry, notes)
  values
    (v_org,'VEN-0001','Kajaria Ceramics Ltd','manufacturer','active',
     'Rajesh Sharma','9876543210','rajesh.sharma@kajaria.com',
     '07AAACK4199N1ZW','AAACK4199N','net_30',
     'New Delhi','Delhi','110001',
     'Plot 1, Sector 5, Noida Industrial Area, Uttar Pradesh 201301',
     'Building Materials',
     'Primary flooring and wall tile supplier. 3-year supply agreement in place. Minimum order qty 500 sqft.'),

    (v_org,'VEN-0002','Asian Paints Ltd','supplier','active',
     'Priya Mehta','9812345678','priya.mehta@asianpaints.com',
     '27AAACA4011F1ZX','AAACA4011F','net_45',
     'Mumbai','Maharashtra','400055',
     'Asian Paints House, 6A Shantinagar, Santacruz East, Mumbai 400055',
     'Paints & Coatings',
     'Premium interior and exterior paint supplier. Monthly auto-replenishment for standard SKUs. 12% trade discount negotiated.'),

    (v_org,'VEN-0003','Hafele India Pvt Ltd','supplier','active',
     'Sunita Joshi','9898765432','sunita.joshi@hafele.in',
     '06AAACH2345M1ZX','AAACH2345M','net_30',
     'Gurugram','Haryana','122015',
     'Plot 31, Sector 18, Udyog Vihar Phase IV, Gurugram 122015',
     'Hardware & Fittings',
     'European hardware fittings and accessories. Premium segment only. Dedicated account manager assigned.'),

    (v_org,'VEN-0004','Godrej Interio','manufacturer','active',
     'Amit Patel','9765432109','amit.patel@godrej.com',
     '27AAACG0696A1ZW','AAACG0696A','net_60',
     'Mumbai','Maharashtra','400079',
     'Plant 11, Pirojshanagar, Vikhroli West, Mumbai 400079',
     'Furniture',
     'Office and commercial furniture. Bulk order discounts available above 50 units. 8-week lead time standard.'),

    (v_org,'VEN-0005','Greenply Industries Ltd','supplier','active',
     'Neha Kapoor','9654321098','neha.kapoor@greenply.com',
     '19AAACG3621L1ZX','AAACG3621L','net_30',
     'Kolkata','West Bengal','700017',
     'Mittal Tower A, 8 Camac Street, Kolkata 700017',
     'Wood Products',
     'Plywood, MDF, and laminates. Preferred supplier for carpentry materials. ISI-certified products only.'),

    (v_org,'VEN-0006','Siemens Ltd India','service_provider','active',
     'Vikram Singh','9543210987','vikram.singh@siemens.com',
     '27AAACS1234Z1ZX','AAACS1234Z','advance',
     'Mumbai','Maharashtra','400018',
     '130, Pandurang Budhkar Marg, Worli, Mumbai 400018',
     'Electrical & Automation',
     'Electrical panels, switchgear and building automation systems. Annual AMC contract active. Payment must be 50% advance.');

end $seed$;
