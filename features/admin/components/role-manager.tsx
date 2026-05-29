'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { assignRole, revokeRole } from '@/features/admin/server/actions'
import type { AssignableRole, MemberRole } from '@/features/admin/server/queries'
import { Alert, Badge, Button, Card, Select } from '@/components/ui'
import styles from './users.module.scss'

export interface RoleManagerProps {
  userId: string
  currentRoles: MemberRole[]
  assignableRoles: AssignableRole[]
  /** Owner roles aren't editable here (the owner is implicit-all). */
  locked: boolean
}

export function RoleManager({ userId, currentRoles, assignableRoles, locked }: RoleManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Roles not already held.
  const available = useMemo(() => {
    const held = new Set(currentRoles.map((r) => r.key))
    return assignableRoles.filter((r) => !held.has(r.key))
  }, [assignableRoles, currentRoles])
  const [selected, setSelected] = useState('')

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) => {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok && res.error) setError(res.error.message)
      else router.refresh()
    })
  }

  return (
    <Card>
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>Roles</h2>
          <p className={styles.cardSubtitle}>What this member can do in the organization.</p>
        </div>
      </header>

      <div className={styles.roleList}>
        {currentRoles.length === 0 && <span className={styles.sub}>No roles assigned.</span>}
        {currentRoles.map((r) => (
          <div key={r.key} className={styles.roleItem}>
            <Badge tone="neutral">{r.name}</Badge>
            {!locked && r.key !== 'company_owner' && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => run(() => revokeRole({ userId, roleId: assignableRoles.find((a) => a.key === r.key)?.id ?? '' }))}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {!locked && available.length > 0 && (
        <div className={styles.addRole}>
          <Select value={selected} onChange={(e) => setSelected(e.target.value)} aria-label="Add role">
            <option value="">Select a role…</option>
            {available.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            disabled={isPending || !selected}
            onClick={() => run(() => assignRole({ userId, roleId: selected }).then((r) => { if (r.ok) setSelected(''); return r }))}
          >
            Add role
          </Button>
        </div>
      )}

      {locked && <p className={styles.note}>The company owner&rsquo;s roles can&rsquo;t be changed here.</p>}
    </Card>
  )
}
