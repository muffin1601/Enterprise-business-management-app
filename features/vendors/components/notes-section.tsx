'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addVendorNote, deleteVendorNote, toggleVendorNotePin } from '../server/actions'
import type { VendorNote } from '../server/queries'
import { Icon } from '@/components/ui'
import styles from './vendors.module.scss'

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function NotesSection({ vendorId, notes, canEdit }: {
  vendorId: string; notes: VendorNote[]; canEdit: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [pending, start] = useTransition()

  function handleAdd() {
    if (!draft.trim()) return
    start(async () => {
      const result = await addVendorNote(vendorId, { content: draft.trim(), isPinned: false })
      if (result.ok) { setDraft(''); router.refresh() }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this note?')) return
    start(async () => { await deleteVendorNote(id, vendorId); router.refresh() })
  }

  function handleTogglePin(id: string, current: boolean) {
    start(async () => { await toggleVendorNotePin(id, vendorId, !current); router.refresh() })
  }

  const pinned  = notes.filter(n => n.isPinned)
  const regular = notes.filter(n => !n.isPinned)
  const ordered = [...pinned, ...regular]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {canEdit && (
        <div className={styles.noteCompose}>
          <textarea
            className={styles.noteTextarea}
            placeholder="Add a note about this vendor…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd() }}
          />
          <div className={styles.noteActions}>
            <button
              className={styles.btnPrimary}
              onClick={handleAdd}
              disabled={pending || !draft.trim()}
            >
              {pending ? 'Adding…' : 'Add Note'}
            </button>
            <span className={styles.noteHint}>Ctrl+Enter to submit</span>
          </div>
        </div>
      )}

      {ordered.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="notes" className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>No notes yet</div>
          <div className={styles.emptyBody}>Add your first note above</div>
        </div>
      ) : (
        <div className={styles.noteList}>
          {ordered.map(n => (
            <div key={n.id} className={`${styles.noteCard} ${n.isPinned ? styles.pinnedNote : ''}`}>
              <div className={styles.noteHeader}>
                <div className={styles.noteMeta}>
                  {n.creatorName && <span>{n.creatorName} · </span>}
                  <span>{relTime(n.createdAt)}</span>
                  {n.isPinned && <span style={{ marginLeft: 8, color: 'var(--c-warning)' }}><Icon name="pin" size={12} /> Pinned</span>}
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className={styles.iconBtn} title={n.isPinned ? 'Unpin' : 'Pin'} onClick={() => handleTogglePin(n.id, n.isPinned)}>
                      <Icon name="pin" size={14} />
                    </button>
                    <button className={styles.iconBtn} title="Delete" onClick={() => handleDelete(n.id)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className={styles.noteContent}>{n.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
