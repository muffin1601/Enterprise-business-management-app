'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePoStatus, deletePurchaseOrder } from '../server/actions'
import type { PoStatusType } from '@/validations/purchase-order'
import { Icon } from '@/components/ui'
import styles from './purchase-orders.module.scss'

interface TransitionCfg {
  toStatus: PoStatusType
  label:    string
  variant:  'primary' | 'secondary' | 'danger'
  confirm?: string
  needsNote?: boolean
}

const TRANSITIONS: Record<string, TransitionCfg[]> = {
  draft: [
    { toStatus: 'pending_approval', label: 'Submit for Approval', variant: 'secondary' },
    { toStatus: 'approved',         label: 'Approve & Skip',      variant: 'primary' },
    { toStatus: 'cancelled',        label: 'Cancel',              variant: 'danger', needsNote: true, confirm: 'Cancel this PO?' },
  ],
  pending_approval: [
    { toStatus: 'approved',   label: 'Approve PO',    variant: 'primary' },
    { toStatus: 'cancelled',  label: 'Reject',        variant: 'danger', needsNote: true, confirm: 'Reject this PO?' },
  ],
  approved: [
    { toStatus: 'sent',       label: 'Mark as Sent to Vendor', variant: 'primary', confirm: 'Confirm PO has been sent to vendor?' },
    { toStatus: 'cancelled',  label: 'Cancel',                 variant: 'danger', needsNote: true, confirm: 'Cancel this PO?' },
  ],
  sent: [
    { toStatus: 'cancelled',  label: 'Cancel', variant: 'danger', needsNote: true, confirm: 'Cancel this sent PO?' },
  ],
  partially_received: [
    { toStatus: 'received',   label: 'Mark Fully Received', variant: 'primary', confirm: 'Mark all items as received?' },
    { toStatus: 'cancelled',  label: 'Cancel',              variant: 'danger', needsNote: true, confirm: 'Cancel this PO?' },
  ],
  received: [
    { toStatus: 'closed', label: 'Close PO', variant: 'secondary', confirm: 'Close and archive this PO?' },
  ],
}

interface Props {
  poId:       string
  status:     string
  canEdit:    boolean
  canApprove: boolean
  canDelete:  boolean
}

export function PoStatusActions({ poId, status, canEdit, canApprove, canDelete }: Props) {
  const router     = useRouter()
  const [, startT] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<PoStatusType | null>(null)
  const [note, setNote] = useState('')

  const transitions = TRANSITIONS[status] ?? []

  if ((!canEdit && !canApprove) || transitions.length === 0) return null

  function handleTransition(cfg: TransitionCfg) {
    // Approval requires approve permission
    if ((cfg.toStatus === 'approved') && !canApprove && !canEdit) {
      setError('You do not have permission to approve POs.')
      return
    }
    if (cfg.confirm && !confirm(cfg.confirm)) return
    if (cfg.needsNote) { setNoteFor(cfg.toStatus); return }
    execute(cfg.toStatus, undefined)
  }

  function execute(toStatus: PoStatusType, noteText: string | undefined) {
    startT(async () => {
      setError(null)
      const res = await updatePoStatus(poId, { status: toStatus, note: noteText })
      if (!res.ok) setError(res.error?.message ?? 'Status update failed.')
      else { setNoteFor(null); setNote(''); router.refresh() }
    })
  }

  function handleDelete() {
    if (!confirm('Delete this purchase order? This cannot be undone.')) return
    startT(async () => {
      const res = await deletePurchaseOrder(poId)
      if (!res.ok) setError(res.error?.message ?? 'Delete failed.')
      else router.push('/purchase-orders')
    })
  }

  return (
    <div className={styles.statusActions}>
      {error && (
        <div className={`${styles.flashMsg} ${styles.flashErr}`}>
          {error} <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {noteFor ? (
        <div className={styles.noteDialog}>
          <label className={styles.formLabel}>Note (optional)</label>
          <textarea className={styles.formTextarea} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Reason…" />
          <div className={styles.formActions}>
            <button className={styles.btnDanger} onClick={() => execute(noteFor, note || undefined)} type="button">Confirm</button>
            <button className={styles.btnSecondary} onClick={() => setNoteFor(null)} type="button">Back</button>
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
          {canDelete && ['draft','cancelled'].includes(status) && (
            <button className={styles.btnDanger} onClick={handleDelete} type="button">
              <Icon name="trash" size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
