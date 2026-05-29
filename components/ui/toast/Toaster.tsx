'use client'

import { useEffect, useState } from 'react'
import { dismissToast, subscribeToasts, type ToastItem } from './toast-store'
import styles from './Toaster.module.scss'

/** Renders active toasts. Mount once near the app root. */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => subscribeToasts(setItems), [])

  if (items.length === 0) return null
  return (
    <div className={styles.region} role="region" aria-live="polite" aria-label="Notifications">
      {items.map((t) => (
        <div key={t.id} className={styles.toast} data-tone={t.tone} role="status">
          <span className={styles.message}>{t.message}</span>
          <button
            type="button"
            className={styles.close}
            aria-label="Dismiss"
            onClick={() => dismissToast(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
