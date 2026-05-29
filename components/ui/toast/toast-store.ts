'use client'

/**
 * Tiny dependency-free toast store. `toast()` is callable from any client
 * component; a single <Toaster/> (mounted in the root layout) subscribes and
 * renders. Module-level state is fine — it's a client-only module.
 */
export type ToastTone = 'success' | 'danger' | 'warning' | 'info'
export type ToastItem = { id: number; message: string; tone: ToastTone }

let items: ToastItem[] = []
let seq = 0
const listeners = new Set<(items: ToastItem[]) => void>()

function emit() {
  for (const l of listeners) l(items)
}

export function subscribeToasts(cb: (items: ToastItem[]) => void) {
  listeners.add(cb)
  cb(items)
  return () => {
    listeners.delete(cb)
  }
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

export function toast(message: string, tone: ToastTone = 'info', ttlMs = 5000): number {
  const id = (seq += 1)
  items = [...items, { id, message, tone }]
  emit()
  if (ttlMs > 0) setTimeout(() => dismissToast(id), ttlMs)
  return id
}
