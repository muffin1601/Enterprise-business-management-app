'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateSoStatus, deleteSalesOrder } from '../server/actions'
import type { SoStatusType } from '@/validations/sales-order'
import { Icon } from '@/components/ui'
import styles from './sales-orders.module.scss'

interface TransitionConfig {
  toStatus: SoStatusType
  label:    string
  variant:  'primary' | 'secondary' | 'danger'
  confirm?: string
  needsNote?: boolean
}

const CANCEL: TransitionConfig = {
  toStatus: 'cancelled', label: 'Cancel Order', variant: 'danger', needsNote: true,
  confirm: 'Are you sure you want to cancel this order?',
}

const TRANSITIONS: Record<string, TransitionConfig[]> = {
  draft: [
    { toStatus: 'sent',     label: 'Mark Sent',     variant: 'primary' },
    { toStatus: 'accepted', label: 'Mark Accepted', variant: 'secondary' },
    CANCEL,
  ],
  sent: [
    { toStatus: 'accepted', label: 'Mark Accepted', variant: 'primary' },
    { toStatus: 'revised',  label: 'Mark Revised',  variant: 'secondary' },
    CANCEL,
  ],
  accepted: [
    { toStatus: 'revised',  label: 'Mark Revised',  variant: 'secondary' },
    CANCEL,
  ],
  revised: [
    { toStatus: 'sent',     label: 'Mark Sent',     variant: 'primary' },
    { toStatus: 'accepted', label: 'Mark Accepted', variant: 'secondary' },
    CANCEL,
  ],
}

interface Props {
  soId:      string
  status:    string
  canEdit:   boolean
  canDelete: boolean
}

export function SoStatusActions({ soId, status, canEdit, canDelete }: Props) {
  const router         = useRouter()
  const [, startT]     = useTransition()
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<SoStatusType | null>(null)
  const [error, setError] = useState<string | null>(null)

  const transitions = TRANSITIONS[status] ?? []

  if (!canEdit || transitions.length === 0) return null

  function handleTransition(cfg: TransitionConfig) {
    if (cfg.confirm && !confirm(cfg.confirm)) return
    if (cfg.needsNote) {
      setPending(cfg.toStatus)
      return
    }
    execute(cfg.toStatus, undefined)
  }

  function execute(toStatus: SoStatusType, noteText: string | undefined) {
    startT(async () => {
      setError(null)
      const res = await updateSoStatus(soId, { status: toStatus, note: noteText })
      if (!res.ok) {
        setError(res.error?.message ?? 'Status update failed.')
      } else {
        setPending(null)
        setNote('')
        router.refresh()
      }
    })
  }

  function handleDelete() {
    if (!confirm('Delete this sales order? This cannot be undone.')) return
    startT(async () => {
      const res = await deleteSalesOrder(soId)
      if (!res.ok) setError(res.error?.message ?? 'Delete failed.')
      else router.push('/orders')
    })
  }

  return (
    <div className={styles.statusActions}>
      {error && (
        <div className={`${styles.flashMsg} ${styles.flashErr}`}>
          {error} <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {pending ? (
        <div className={styles.noteDialog}>
          <label className={styles.formLabel}>Note (optional)</label>
          <textarea
            className={styles.formTextarea}
            rows={3}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Reason for cancellation…"
          />
          <div className={styles.formActions}>
            <button className={styles.btnDanger} onClick={() => execute(pending, note || undefined)} type="button">
              Confirm
            </button>
            <button className={styles.btnSecondary} onClick={() => setPending(null)} type="button">
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actionButtons}>
          {transitions.map(cfg => (
            <button
              key={cfg.toStatus}
              className={cfg.variant === 'primary' ? styles.btnPrimary : cfg.variant === 'danger' ? styles.btnDanger : styles.btnSecondary}
              onClick={() => handleTransition(cfg)}
              type="button"
            >
              {cfg.label}
            </button>
          ))}
          {canDelete && ['draft', 'accepted', 'cancelled'].includes(status) && (
            <button className={styles.btnDanger} onClick={handleDelete} type="button">
              <Icon name="trash" size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
