'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { postRunningInvoice, cancelRunningInvoice, deleteRunningInvoice } from '../server/actions'
import { Icon } from '@/components/ui'
import styles from './running-invoices.module.scss'

interface Props {
  riId:      string
  status:    string
  canEdit:   boolean
  canPost:   boolean
  canDelete: boolean
}

export function RiStatusActions({ riId, status, canEdit, canPost, canDelete }: Props) {
  const router    = useRouter()
  const [, startT] = useTransition()
  const [error, setError]   = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote]       = useState('')

  function handlePost() {
    if (!confirm('Post this invoice? This commits quantities to the ledger and cannot be easily reversed.')) return
    startT(async () => {
      setError(null)
      const res = await postRunningInvoice(riId)
      if (!res.ok) setError(res.error?.message ?? 'Failed to post.')
      else router.refresh()
    })
  }

  function handleCancel() { setNoteFor('cancel') }

  function confirmCancel() {
    startT(async () => {
      const res = await cancelRunningInvoice(riId, note || undefined)
      if (!res.ok) setError(res.error?.message ?? 'Failed.')
      else { setNoteFor(null); setNote(''); router.refresh() }
    })
  }

  function handleDelete() {
    if (!confirm('Delete this draft invoice?')) return
    startT(async () => {
      const res = await deleteRunningInvoice(riId)
      if (!res.ok) setError(res.error?.message ?? 'Failed.')
      else router.push('/running-invoices')
    })
  }

  return (
    <div className={styles.statusActions}>
      {error && (
        <div className={`${styles.flashMsg} ${styles.flashErr}`}>
          {error} <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {noteFor === 'cancel' ? (
        <div className={styles.noteDialog}>
          <label className={styles.formLabel}>Reason for cancellation (optional)</label>
          <textarea className={styles.formTextarea} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Reason…" />
          <div className={styles.formActions}>
            <button className={styles.btnDanger} onClick={confirmCancel} type="button">Confirm Cancel</button>
            <button className={styles.btnSecondary} onClick={() => setNoteFor(null)} type="button">Back</button>
          </div>
        </div>
      ) : (
        <div className={styles.actionButtons}>
          {status === 'validated' && canPost && (
            <button className={styles.btnPrimary} onClick={handlePost} type="button">
              <Icon name="send" size={14} /> Post Invoice (Commit to Ledger)
            </button>
          )}
          {status === 'posted' && canEdit && (
            <button className={styles.btnSecondary} type="button" disabled title="Invoice posted — mark sent after customer delivery">
              Mark as Sent
            </button>
          )}
          {['draft','validated','posted','sent'].includes(status) && canEdit && (
            <button className={styles.btnSecondary} onClick={handleCancel} type="button">
              Cancel Invoice
            </button>
          )}
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
