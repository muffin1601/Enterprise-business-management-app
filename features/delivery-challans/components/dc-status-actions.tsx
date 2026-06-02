'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { dispatchChallan, updateDcStatus, deleteDeliveryChallan } from '../server/actions'
import { Icon } from '@/components/ui'
import styles from './delivery-challans.module.scss'

interface Props {
  dcId:       string
  status:     string
  canEdit:    boolean
  canPost:    boolean
  canDelete:  boolean
  stockDeducted: boolean
}

export function DcStatusActions({ dcId, status, canEdit, canPost, canDelete, stockDeducted }: Props) {
  const router     = useRouter()
  const [, startT] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote]       = useState('')

  async function handleDispatch() {
    if (!confirm('Dispatch this delivery challan? Stock will be deducted from inventory immediately.')) return
    startT(async () => {
      setError(null)
      const res = await dispatchChallan(dcId)
      if (!res.ok) setError(res.error?.message ?? 'Dispatch failed.')
      else router.refresh()
    })
  }

  function handleTransition(toStatus: string, needsNote: boolean) {
    if (needsNote) { setNoteFor(toStatus); return }
    if (!confirm(`Mark as ${toStatus}?`)) return
    startT(async () => {
      setError(null)
      const res = await updateDcStatus(dcId, { status: toStatus as 'delivered' | 'cancelled', note: undefined })
      if (!res.ok) setError(res.error?.message ?? 'Failed.')
      else router.refresh()
    })
  }

  function confirmTransition() {
    if (!noteFor) return
    startT(async () => {
      const res = await updateDcStatus(dcId, { status: noteFor as 'cancelled', note: note || undefined })
      if (!res.ok) setError(res.error?.message ?? 'Failed.')
      else { setNoteFor(null); setNote(''); router.refresh() }
    })
  }

  function handleDelete() {
    if (!confirm('Delete this draft challan?')) return
    startT(async () => {
      const res = await deleteDeliveryChallan(dcId)
      if (!res.ok) setError(res.error?.message ?? 'Delete failed.')
      else router.push('/delivery-challans')
    })
  }

  if (noteFor) {
    return (
      <div className={styles.statusActions}>
        <div className={styles.noteDialog}>
          <label className={styles.formLabel}>Reason (optional)</label>
          <textarea className={styles.formTextarea} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for cancellation…" />
          <div className={styles.formActions}>
            <button className={styles.btnDanger} onClick={confirmTransition} type="button">Confirm Cancel</button>
            <button className={styles.btnSecondary} onClick={() => setNoteFor(null)} type="button">Back</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.statusActions}>
      {error && (
        <div className={`${styles.flashMsg} ${styles.flashErr}`}>
          {error} <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      <div className={styles.actionButtons}>
        {status === 'draft' && canPost && (
          <button className={styles.btnPrimary} onClick={handleDispatch} type="button">
            <Icon name="truck" size={14} /> Dispatch (Deduct Stock)
          </button>
        )}
        {status === 'dispatched' && canEdit && (
          <button className={styles.btnPrimary} onClick={() => handleTransition('delivered', false)} type="button">
            <Icon name="circle-check" size={14} /> Confirm Delivered
          </button>
        )}
        {['draft','dispatched'].includes(status) && canEdit && (
          <button className={styles.btnSecondary} onClick={() => handleTransition('cancelled', true)} type="button">
            Cancel
          </button>
        )}
        {canDelete && status === 'draft' && (
          <button className={styles.btnDanger} onClick={handleDelete} type="button">
            <Icon name="trash" size={14} /> Delete
          </button>
        )}
      </div>
    </div>
  )
}
