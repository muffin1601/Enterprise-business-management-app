'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { issueInvoice, updateInvoiceStatus, deleteInvoice } from '../server/actions'
import { Icon } from '@/components/ui'
import styles from './invoices.module.scss'

interface Props {
  invId:     string
  status:    string
  canEdit:   boolean
  canIssue:  boolean
  canDelete: boolean
}

export function InvoiceStatusActions({ invId, status, canEdit, canIssue, canDelete }: Props) {
  const router     = useRouter()
  const [, startT] = useTransition()
  const [error, setError]       = useState<string | null>(null)
  const [noteFor, setNoteFor]   = useState<string | null>(null)
  const [note, setNote]         = useState('')

  function handleIssue() {
    if (!confirm('Issue this invoice? Once issued, items cannot be edited.')) return
    startT(async () => {
      const res = await issueInvoice(invId)
      if (!res.ok) setError(res.error?.message ?? 'Failed to issue invoice.')
      else router.refresh()
    })
  }

  function handleTransition(toStatus: string) {
    if (['cancelled'].includes(toStatus)) { setNoteFor(toStatus); return }
    startT(async () => {
      const res = await updateInvoiceStatus(invId, { status: toStatus })
      if (!res.ok) setError(res.error?.message ?? 'Failed.')
      else router.refresh()
    })
  }

  function confirmTransition() {
    if (!noteFor) return
    startT(async () => {
      const res = await updateInvoiceStatus(invId, { status: noteFor, note: note || undefined })
      if (!res.ok) setError(res.error?.message ?? 'Failed.')
      else { setNoteFor(null); setNote(''); router.refresh() }
    })
  }

  function handleDelete() {
    if (!confirm('Delete this draft invoice?')) return
    startT(async () => {
      const res = await deleteInvoice(invId)
      if (!res.ok) setError(res.error?.message ?? 'Failed to delete.')
      else router.push('/invoices')
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
          <label className={styles.formLabel}>Reason (optional)</label>
          <textarea className={styles.formTextarea} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for cancellation…" />
          <div className={styles.formActions}>
            <button className={styles.btnDanger} onClick={confirmTransition} type="button">Confirm Cancel</button>
            <button className={styles.btnSecondary} onClick={() => setNoteFor(null)} type="button">Back</button>
          </div>
        </div>
      ) : (
        <div className={styles.actionButtons}>
          {status === 'draft' && canIssue && (
            <button className={styles.btnPrimary} onClick={handleIssue} type="button">
              <Icon name="send" size={14} /> Issue Invoice
            </button>
          )}
          {status === 'draft' && canEdit && (
            <button className={styles.btnSecondary} onClick={() => handleTransition('cancelled')} type="button">
              Cancel
            </button>
          )}
          {['issued','partially_paid'].includes(status) && canEdit && (
            <button className={styles.btnSecondary} onClick={() => handleTransition('cancelled')} type="button">
              Cancel Invoice
            </button>
          )}
          {canDelete && status === 'draft' && (
            <button className={styles.btnDanger} onClick={handleDelete} type="button">
              <Icon name="trash" size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
