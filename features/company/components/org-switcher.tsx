'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Membership } from '@/lib/auth/session'
import { switchOrganization } from '@/features/company/server/actions'
import { Select } from '@/components/ui'
import styles from './org-switcher.module.scss'

export interface OrgSwitcherProps {
  memberships: Membership[]
  activeOrgId: string | null
}

/** Active-organization selector. Persists via switchOrganization (validated cookie). */
export function OrgSwitcher({ memberships, activeOrgId }: OrgSwitcherProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (memberships.length <= 1) {
    return (
      <span className={styles.single}>{memberships[0]?.orgName ?? 'No organization'}</span>
    )
  }

  const onChange = (orgId: string) => {
    if (orgId === activeOrgId) return
    startTransition(async () => {
      const res = await switchOrganization({ orgId })
      if (res.ok) router.refresh()
    })
  }

  return (
    <label className={styles.wrap}>
      <span className={styles.label}>Organization</span>
      <Select
        value={activeOrgId ?? ''}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value)}
      >
        {memberships.map((m) => (
          <option key={m.orgId} value={m.orgId}>
            {m.orgName}
          </option>
        ))}
      </Select>
    </label>
  )
}
