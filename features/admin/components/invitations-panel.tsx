'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { AllInvitation } from '../server/queries'
import { revokeInvitation } from '../server/actions'
import { resendInvitation } from '../server/team-actions'
import { Icon } from '@/components/ui'
import styles from './team.module.scss'

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })

function isExpired(expiresAt: string) {
  return new Date(expiresAt) < new Date()
}

interface Props { invitations: AllInvitation[]; canManage: boolean }

export function InvitationsPanel({ invitations, canManage }: Props) {
  const router = useRouter()
  const [, startT] = useTransition()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [resendResult, setResendResult] = useState<Record<string, string>>({})

  function handleRevoke(id: string, email: string) {
    if (!confirm(`Revoke invitation for ${email}?`)) return
    startT(async () => {
      await revokeInvitation({ id })
      router.refresh()
    })
  }

  function handleResend(id: string) {
    startT(async () => {
      const res = await resendInvitation(id)
      if (res.ok) {
        setResendResult(prev => ({ ...prev, [id]: res.data.acceptUrl }))
        router.refresh()
      } else {
        alert(res.error?.message ?? 'Failed to resend.')
      }
    })
  }

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const pending  = invitations.filter(i => i.status === 'pending' && !isExpired(i.expiresAt))
  const expired  = invitations.filter(i => i.status === 'pending' &&  isExpired(i.expiresAt))
  const revoked  = invitations.filter(i => i.status === 'revoked')

  if (invitations.length === 0) return null

  return (
    <div className={styles.invPanel}>
      <div className={styles.invPanelHeader}>
        <div className={styles.invPanelTitle}>
          <Icon name="mail" size={15} />
          Invitations
          {pending.length > 0 && <span className={styles.invBadge}>{pending.length}</span>}
        </div>
      </div>

      {pending.length > 0 && (
        <div className={styles.invSection}>
          <div className={styles.invSectionLabel}>Pending</div>
          {pending.map(inv => (
            <div key={inv.id} className={styles.invRow}>
              <div className={styles.invInfo}>
                <span className={styles.invEmail}>{inv.email}</span>
                <span className={styles.invMeta}>
                  {inv.roleName}
                  {inv.invitedByEmail && ` · Invited by ${inv.invitedByEmail}`}
                  {' · Expires '}{fmtDate(inv.expiresAt)}
                </span>
              </div>
              {resendResult[inv.id] && (
                <div className={styles.invLinkRow}>
                  <code className={styles.invLink}>{resendResult[inv.id]}</code>
                  <button className={styles.invCopyBtn} onClick={() => copyLink(resendResult[inv.id]!, inv.id)}>
                    {copiedId === inv.id ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              )}
              {canManage && (
                <div className={styles.invActions}>
                  <button className={styles.invBtn} onClick={() => handleResend(inv.id)}>Resend</button>
                  <button className={`${styles.invBtn} ${styles.invBtnDanger}`} onClick={() => handleRevoke(inv.id, inv.email)}>Revoke</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {expired.length > 0 && (
        <div className={styles.invSection}>
          <div className={styles.invSectionLabel} style={{ color:'var(--c-warning)' }}>Expired</div>
          {expired.map(inv => (
            <div key={inv.id} className={`${styles.invRow} ${styles.invExpired}`}>
              <div className={styles.invInfo}>
                <span className={styles.invEmail}>{inv.email}</span>
                <span className={styles.invMeta}>{inv.roleName} · Expired {fmtDate(inv.expiresAt)}</span>
              </div>
              {canManage && (
                <div className={styles.invActions}>
                  <button className={styles.invBtn} onClick={() => handleResend(inv.id)}>Resend</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
