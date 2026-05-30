'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addNote, deleteNote } from '../server/actions'
import type { CustomerNote } from '../server/queries'
import styles from './customers.module.scss'

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

interface Props {
  customerId: string
  notes: CustomerNote[]
  canEdit: boolean
}

export function NotesSection({ customerId, notes, canEdit }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [pending, start] = useTransition()

  function handleAdd() {
    if (!draft.trim()) return
    start(async () => {
      const result = await addNote(customerId, { content: draft.trim(), isPinned: false })
      if (result.ok) {
        setDraft('')
        router.refresh()
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this note?')) return
    start(async () => {
      await deleteNote(id, customerId)
      router.refresh()
    })
  }

  const pinned  = notes.filter((n) => n.isPinned)
  const regular = notes.filter((n) => !n.isPinned)
  const ordered = [...pinned, ...regular]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Compose */}
      {canEdit && (
        <div className={styles.noteCompose}>
          <textarea
            className={styles.noteTextarea}
            placeholder="Add a note about this customer…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd()
            }}
          />
          <div className={styles.noteActions}>
            <button
              onClick={handleAdd}
              disabled={pending || !draft.trim()}
              style={{
                background: 'var(--color-primary)', color: 'var(--color-on-primary)',
                border: 'none', padding: '7px 16px',
                fontFamily: 'var(--font-body)', fontSize: 'var(--fs-200)',
                letterSpacing: '0.35em', textTransform: 'uppercase',
                cursor: (pending || !draft.trim()) ? 'not-allowed' : 'pointer',
                opacity: (pending || !draft.trim()) ? 0.5 : 1,
              }}
            >
              {pending ? 'Adding…' : 'Add Note'}
            </button>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-200)', color: 'var(--color-text-faint)', paddingTop: 8 }}>
              Ctrl+Enter to submit
            </span>
          </div>
        </div>
      )}

      {/* List */}
      {ordered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><i className="ti ti-notes" /></div>
          <div className={styles.emptyTitle}>No notes yet</div>
          <div className={styles.emptyBody}>Add your first note above</div>
        </div>
      ) : (
        <div className={styles.noteList}>
          {ordered.map((n) => (
            <div
              key={n.id}
              className={`${styles.noteCard} ${n.isPinned ? styles.pinnedNote : ''}`}
            >
              <div className={styles.noteHeader}>
                <div className={styles.noteMeta}>
                  {n.creatorName && <span>{n.creatorName} · </span>}
                  <span>{relTime(n.createdAt)}</span>
                  {n.isPinned && (
                    <span style={{ marginLeft: 8, color: 'var(--color-warning-fg)' }}>
                      <i className="ti ti-pin" style={{ fontSize: 12 }} /> Pinned
                    </span>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => handleDelete(n.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-text-faint)', fontSize: 14, padding: 2,
                    }}
                    title="Delete note"
                  >
                    <i className="ti ti-trash" />
                  </button>
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
