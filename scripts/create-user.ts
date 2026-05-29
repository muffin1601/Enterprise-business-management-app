import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

/**
 * Dev helper: create (or reset the password of) a login user via the Supabase
 * Admin API, with email pre-confirmed so it can sign in immediately.
 *
 *   SEED_EMAIL=sana@watcon.net SEED_PASSWORD='...' npx tsx scripts/create-user.ts
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.SEED_EMAIL ?? 'sana@watcon.net'
const password = process.env.SEED_PASSWORD ?? 'Watcon@2026'
const fullName = process.env.SEED_NAME ?? 'Sana'

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserByEmail(target: string) {
  // listUsers is paginated; scan a few pages defensively.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) break
  }
  return null
}

async function main() {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (!error && data.user) {
    console.log(`✅ Created user ${email} (id: ${data.user.id})`)
  } else {
    // Already exists → reset its password and ensure it's confirmed.
    const existing = await findUserByEmail(email)
    if (!existing) {
      console.error('❌ Create failed and user not found:', error?.message)
      process.exit(1)
    }
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (updErr) {
      console.error('❌ Could not update existing user:', updErr.message)
      process.exit(1)
    }
    console.log(`✅ Reset password for existing user ${email} (id: ${existing.id})`)
  }

  console.log('\n──────── LOGIN ────────')
  console.log(`Email:    ${email}`)
  console.log(`Password: ${password}`)
  console.log('───────────────────────')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
