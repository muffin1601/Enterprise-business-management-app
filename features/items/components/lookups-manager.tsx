'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createBrand,
  createFamily,
  createUnit,
  deleteLookup,
} from '@/features/items/server/actions'
import type { Lookup } from '@/features/items/server/queries'
import type { ActionResult } from '@/types/action'
import { Button, Card, Input } from '@/components/ui'
import styles from './items.module.scss'

type Kind = 'family' | 'brand' | 'unit'

export function LookupsManager({
  families,
  brands,
  units,
}: {
  families: Lookup[]
  brands: Lookup[]
  units: Lookup[]
}) {
  return (
    <div className={styles.lookupGrid}>
      <LookupColumn
        title="Categories"
        kind="family"
        items={families}
        onAdd={(name) => createFamily({ name })}
      />
      <LookupColumn title="Brands" kind="brand" items={brands} onAdd={(name) => createBrand({ name })} />
      <LookupColumn
        title="Units"
        kind="unit"
        items={units}
        placeholder="Code (e.g. SQM)"
        onAdd={(code) => createUnit({ code })}
      />
    </div>
  )
}

function LookupColumn({
  title,
  kind,
  items,
  placeholder = 'Name',
  onAdd,
}: {
  title: string
  kind: Kind
  items: Lookup[]
  placeholder?: string
  onAdd: (value: string) => Promise<ActionResult<{ id: string }>>
}) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const add = () => {
    if (!value.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await onAdd(value.trim())
      if (res.ok) {
        setValue('')
        router.refresh()
      } else setError(res.error.message)
    })
  }

  const remove = (id: string) => {
    startTransition(async () => {
      await deleteLookup(kind, id)
      router.refresh()
    })
  }

  return (
    <Card>
      <h2 className={styles.cardTitle}>{title}</h2>
      <div className={styles.lookupAdd}>
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button variant="secondary" onClick={add} loading={isPending}>
          Add
        </Button>
      </div>
      {error && <p style={{ color: 'var(--color-danger-fg)', fontSize: 'var(--fs-200)' }}>{error}</p>}
      <div className={styles.lookupList}>
        {items.length === 0 ? (
          <p className={styles.itemSub}>None yet.</p>
        ) : (
          items.map((it) => (
            <div key={it.id} className={styles.lookupItem}>
              <span>{it.label}</span>
              <Button variant="ghost" size="sm" disabled={isPending} onClick={() => remove(it.id)}>
                Remove
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
