'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteVendorDocument } from '../server/actions'
import type { VendorDocument } from '../server/queries'
import { VENDOR_DOC_CATEGORIES } from '@/validations/vendor'
import { Icon } from '@/components/ui'
import styles from './vendors.module.scss'

function fmtSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function getCategoryLabel(value: string) {
  return VENDOR_DOC_CATEGORIES.find(c => c.value === value)?.label ?? value
}

export function DocumentsSection({ vendorId, documents, canEdit }: {
  vendorId: string; documents: VendorDocument[]; canEdit: boolean
}) {
  const router = useRouter()
  const [, start] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remove document "${name}"?`)) return
    start(async () => { await deleteVendorDocument(id, vendorId); router.refresh() })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className={styles.docUploadNote}>
        <Icon name="info-circle" size={14} />
        Upload files via Supabase Storage and use <code>saveVendorDocument()</code> to attach them here.
      </div>

      {documents.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="files" className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>No documents yet</div>
          <div className={styles.emptyBody}>GST certificates, PAN, contracts, NDAs</div>
        </div>
      ) : (
        <div className={styles.docList}>
          {documents.map(d => (
            <div key={d.id} className={styles.docCard}>
              <div className={styles.docIcon}>
                <Icon name={d.mimeType?.includes('pdf') ? 'file-type-pdf' : 'file'} size={20} />
              </div>
              <div className={styles.docInfo}>
                <div className={styles.docName}>{d.name}</div>
                <div className={styles.docMeta}>
                  <span className={styles.docCategoryBadge}>{getCategoryLabel(d.category)}</span>
                  {d.fileSize && <span>{fmtSize(d.fileSize)}</span>}
                  {d.creatorName && <span>by {d.creatorName}</span>}
                  <span>{new Date(d.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.iconBtn}
                  title="Download"
                >
                  <Icon name="download" size={15} />
                </a>
                {canEdit && (
                  <button className={styles.iconBtn} title="Remove" onClick={() => handleDelete(d.id, d.name)}>
                    <Icon name="trash" size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
