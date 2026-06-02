'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AssignableRole } from '../server/queries'
import { bulkInvite } from '../server/team-actions'
import { Icon } from '@/components/ui'
import styles from './team.module.scss'

interface Props { roles: AssignableRole[] }

export function BulkInviteForm({ roles }: Props) {
  const router      = useRouter()
  const [, startT]  = useTransition()
  const [open, setOpen]     = useState(false)
  const [emails, setEmails] = useState('')
  const [roleId, setRoleId] = useState(roles[0]?.id ?? '')
  const [result, setResult] = useState<{ invited: number; skipped: number } | null>(null)
  const [error, setError]   = useState<string | null>(null)

  function handleSubmit() {
    const emailList = emails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e.includes('@'))
    if (emailList.length === 0) { setError('Enter at least one valid email address.'); return }
    if (emailList.length > 20)  { setError('Maximum 20 emails at once.'); return }

    setError(null)
    startT(async () => {
      const res = await bulkInvite({ emails: emailList, roleId })
      if (!res.ok) { setError(res.error?.message ?? 'Failed.'); return }
      setResult(res.data)
      setEmails('')
      router.refresh()
    })
  }

  if (!open) {
    return (
      <button className={styles.bulkToggleBtn} onClick={() => setOpen(true)} type="button">
        <Icon name="users-plus" size={14} /> Bulk Invite
      </button>
    )
  }

  return (
    <div className={styles.bulkForm}>
      <div className={styles.bulkHeader}>
        <span className={styles.bulkTitle}>Bulk Invite</span>
        <button className={styles.closeBtn} onClick={() => { setOpen(false); setResult(null); setError(null) }} type="button">×</button>
      </div>

      {result ? (
        <div className={styles.bulkResult}>
          <div className={styles.bulkResultOk}>{result.invited} invitation{result.invited !== 1 ? 's' : ''} sent</div>
          {result.skipped > 0 && <div className={styles.bulkResultSkip}>{result.skipped} skipped (already invited or invalid)</div>}
          <button className={styles.invBtn} onClick={() => setResult(null)} type="button">Invite More</button>
        </div>
      ) : (
        <>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Emails (one per line, or comma-separated)</label>
            <textarea
              className={styles.bulkTextarea}
              rows={5}
              placeholder="alice@company.com&#10;bob@company.com&#10;carol@company.com"
              value={emails}
              onChange={e => setEmails(e.target.value)}
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Assign Role</label>
            <select className={styles.formSelect} value={roleId} onChange={e => setRoleId(e.target.value)}>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {error && <div className={styles.formError}>{error}</div>}
          <div className={styles.formActions}>
            <button className={styles.btnPrimary} onClick={handleSubmit} type="button">Send Invitations</button>
            <button className={styles.btnSecondary} onClick={() => setOpen(false)} type="button">Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}
