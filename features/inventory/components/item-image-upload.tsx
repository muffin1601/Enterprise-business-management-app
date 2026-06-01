'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { updateItemImage } from '../server/actions'
import { Icon } from '@/components/ui'
import styles from './inventory.module.scss'

interface Props {
  itemId: string
  imageUrl: string | null
  orgId: string
  canEdit: boolean
}

export function ItemImageUpload({ itemId, imageUrl, orgId, canEdit }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(imageUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, start] = useTransition()

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB.'); return }

    setError(null)
    setUploading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${orgId}/${itemId}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('item-images')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (upErr) { setError(upErr.message); setUploading(false); return }

      const { data: { publicUrl } } = supabase.storage.from('item-images').getPublicUrl(path)

      setPreview(publicUrl)
      start(async () => {
        await updateItemImage(itemId, publicUrl)
        router.refresh()
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    if (!confirm('Remove item image?')) return
    setPreview(null)
    start(async () => {
      await updateItemImage(itemId, null)
      router.refresh()
    })
  }

  return (
    <div className={styles.imgUploadWrap}>
      <div
        className={styles.imgUploadBox}
        onClick={() => canEdit && !uploading && inputRef.current?.click()}
        style={{ cursor: canEdit ? 'pointer' : 'default' }}
      >
        {preview ? (
          <>
            <img src={preview} alt="Item" className={styles.imgUploadImg} />
            {canEdit && (
              <div className={styles.imgUploadOverlay}>
                <button
                  className={styles.imgUploadBtn}
                  onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
                  title="Change image"
                >
                  <Icon name="camera" />
                </button>
                <button
                  className={styles.imgUploadBtn}
                  onClick={(e) => { e.stopPropagation(); handleRemove() }}
                  title="Remove image"
                  style={{ background: 'rgba(166,61,61,0.85)' }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className={styles.imgUploadPlaceholder}>
            {uploading ? (
              <>
                <Icon name="loader-2" size={28} style={{ color: 'var(--c-tertiary)', animation: 'spin 1s linear infinite' }} />
                <span>Uploading…</span>
              </>
            ) : (
              <>
                <Icon name="photo" size={28} style={{ color: 'var(--c-border-2)' }} />
                {canEdit && <span>Click to upload image</span>}
                {!canEdit && <span>No image</span>}
              </>
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
      )}

      {error && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--c-danger)', marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  )
}
