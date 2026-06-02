import { redirect } from 'next/navigation'
import { getActionContext } from '@/lib/auth/action-context'
import {
  listRolesWithCounts, getAllPermissions, getRolePermissionKeys,
} from '@/features/admin/server/queries'
import { RolesPageShell } from '@/features/admin/components/roles-page-shell'

export const metadata = { title: 'Roles & Permissions · Watcon' }

export default async function RolesPage() {
  const ctx = await getActionContext()
  if (!ctx.has('admin.roles') && !ctx.has('admin.users')) redirect('/users')

  const [roles, allPermissions] = await Promise.all([
    listRolesWithCounts(),
    getAllPermissions(),
  ])

  // Fetch granted permissions for every role in parallel
  const grantedByRole: Record<string, string[]> = {}
  await Promise.all(
    roles.map(async r => {
      grantedByRole[r.id] = await getRolePermissionKeys(r.id)
    })
  )

  return (
    <main style={{ fontFamily: 'var(--font-body)', display:'flex', flexDirection:'column', gap:20 }}>
      <div>
        <div style={{ fontSize:22, fontWeight:300, fontFamily:'var(--font-heading)', color:'var(--c-ink)', letterSpacing:'0.02em' }}>
          Roles & Permissions
        </div>
        <div style={{ fontSize:12, color:'var(--c-tertiary)', marginTop:3 }}>
          {roles.length} role{roles.length !== 1 ? 's' : ''} · Define what each role can access
        </div>
      </div>
      <RolesPageShell
        roles={roles}
        allPermissions={allPermissions}
        grantedByRole={grantedByRole}
        canManage={ctx.has('admin.roles')}
      />
    </main>
  )
}
