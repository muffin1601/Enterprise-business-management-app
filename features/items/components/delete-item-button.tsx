'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { deleteItem } from '@/features/items/server/actions'
import { Alert, Button } from '@/components/ui'

export function DeleteItemButton({ id }: { id: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDelete = () => {
    setError(null)
    startTransition(async () => {
      const res = await deleteItem(id)
      if (res.ok) {
        router.push('/items' as Route)
        router.refresh()
      } else setError(res.error.message)
    })
  }

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        Delete
      </Button>
    )
  }
  return (
    <>
      <Button variant="danger" size="sm" loading={isPending} onClick={onDelete}>
        Confirm delete
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
        Cancel
      </Button>
      {error && <Alert tone="danger">{error}</Alert>}
    </>
  )
}
