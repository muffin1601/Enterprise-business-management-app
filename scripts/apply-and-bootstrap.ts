import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync } from 'node:fs'
import postgres from 'postgres'

/**
 * Dev bootstrap: apply the hand-written SQL migrations that `drizzle-kit push`
 * doesn't (functions, RLS policies, triggers, seeds, RPCs), then ensure the
 * seed user has a profile row + a starter org so login lands on the dashboard.
 */
const conn = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!conn) {
  console.error('Missing DIRECT_URL / DATABASE_URL')
  process.exit(1)
}
const email = process.env.SEED_EMAIL ?? 'sana@watcon.net'
const orgName = process.env.SEED_ORG ?? 'Watcon'

const sql = postgres(conn, { prepare: false, max: 1 })

const FILES = [
  'supabase/migrations/0000_extensions_enums.sql',
  'supabase/migrations/0001_identity_tables.sql',
  'supabase/migrations/0002_rls_helpers_policies_triggers.sql',
  'supabase/migrations/0003_seed_roles_permissions.sql',
  'supabase/migrations/0004_audit_triggers.sql',
  'supabase/migrations/0005_company_setup.sql',
]

async function main() {
  for (const f of FILES) {
    const ddl = readFileSync(f, 'utf8')
    try {
      await sql.unsafe(ddl)
      console.log(`OK  applied ${f}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      // Tolerate "already exists" so re-runs are safe; abort on anything else.
      if (/already exists|duplicate/i.test(msg)) {
        console.log(`~~  ${f} partially present (${msg.split('\n')[0]})`)
      } else {
        console.error(`ERR ${f}: ${msg}`)
        process.exit(1)
      }
    }
  }

  // Resolve the auth user id.
  const [u] = await sql<{ id: string }[]>`select id from auth.users where lower(email) = lower(${email})`
  if (!u) {
    console.error(`No auth user for ${email} — run create-user.ts first.`)
    process.exit(1)
  }

  // Backfill profile mirror (trigger didn't exist at signup time).
  await sql`
    insert into public.users (id, email, full_name)
    values (${u.id}, ${email}, ${'Sana'})
    on conflict (id) do nothing`

  // Bootstrap a starter org + owner membership only if none exists.
  const [existing] = await sql<{ org_id: string }[]>`
    select org_id from public.memberships where user_id = ${u.id} limit 1`
  if (existing) {
    console.log(`OK  ${email} already in org ${existing.org_id}`)
  } else {
    const [org] = await sql<{ id: string }[]>`
      insert into public.organizations (name, created_by) values (${orgName}, ${u.id}) returning id`
    await sql`insert into public.organization_settings (org_id, created_by) values (${org!.id}, ${u.id})
             on conflict (org_id) do nothing`
    await sql`insert into public.memberships (org_id, user_id, is_default, is_billable, created_by)
             values (${org!.id}, ${u.id}, true, true, ${u.id})
             on conflict (org_id, user_id) do nothing`
    const [ownerRole] = await sql<{ id: string }[]>`
      select id from public.roles where key = 'company_owner' and org_id is null`
    if (ownerRole) {
      await sql`insert into public.user_roles (org_id, user_id, role_id, created_by)
               values (${org!.id}, ${u.id}, ${ownerRole.id}, ${u.id})
               on conflict do nothing`
    }
    console.log(`OK  created org "${orgName}" (${org!.id}) with ${email} as Company Owner`)
  }

  const [roleCount] = await sql<{ n: number }[]>`select count(*)::int as n from public.roles where org_id is null`
  console.log(`OK  system roles seeded: ${roleCount!.n}`)
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e)
    await sql.end()
    process.exit(1)
  })
