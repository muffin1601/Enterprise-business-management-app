'use client'

import { useState } from 'react'
import styles from './inventory.module.scss'

export type ComboOption = { value: string; label: string }

type CreateResult = { ok: true; id: string } | { ok: false; message: string }

interface Props {
  label:       string
  placeholder?: string
  options:     ComboOption[]
  /** Currently selected lookup id (uuid) or undefined. */
  value:       string | undefined
  /** Called with the resolved lookup id, or undefined when the text matches nothing. */
  onChange:    (id: string | undefined) => void
  /** Persist a brand-new lookup and return its id. */
  onCreate:    (name: string) => Promise<CreateResult>
  error?:      string
}

/**
 * Free-text combo backed by a normalized lookup table. Typing an existing name
 * resolves to its id; typing a new name reveals a "+ Create" affordance that
 * inserts the lookup and selects it. Unmatched text resolves to undefined (no
 * value) rather than being stored raw, so it never trips uuid validation.
 */
export function LookupCombo({ label, placeholder, options: initial, value, onChange, onCreate, error }: Props) {
  const [options, setOptions]   = useState<ComboOption[]>(initial)
  const [text, setText]         = useState(() => initial.find(o => o.value === value)?.label ?? '')
  const [creating, setCreating] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  const trimmed = text.trim()
  const exact   = options.find(o => o.label.toLowerCase() === trimmed.toLowerCase())
  const showCreate = trimmed.length > 0 && !exact && !creating

  const listId = `combo-${label.replace(/\W+/g, '-').toLowerCase()}`

  function handleChange(v: string) {
    setText(v)
    setCreateErr(null)
    const match = options.find(o => o.label.toLowerCase() === v.trim().toLowerCase())
    onChange(match ? match.value : undefined)
  }

  async function handleCreate() {
    if (!trimmed || creating) return
    setCreating(true)
    setCreateErr(null)
    const res = await onCreate(trimmed)
    setCreating(false)
    if (!res.ok) { setCreateErr(res.message); return }
    const opt = { value: res.id, label: trimmed }
    setOptions(prev => [...prev, opt].sort((a, b) => a.label.localeCompare(b.label)))
    setText(trimmed)
    onChange(res.id)
  }

  return (
    <div>
      <label className={styles.fieldLabel}>{label}</label>
      <input
        type="text"
        list={listId}
        className={styles.fieldInput}
        placeholder={placeholder}
        value={text}
        onChange={e => handleChange(e.target.value)}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map(o => <option key={o.value} value={o.label} />)}
      </datalist>
      {showCreate && (
        <button
          type="button"
          onClick={handleCreate}
          style={{
            marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', background: 'transparent', cursor: 'pointer',
            border: '1px solid var(--c-border)', borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-secondary)',
          }}
        >
          + Create &ldquo;{trimmed}&rdquo;
        </button>
      )}
      {creating && (
        <div style={{ marginTop: 6, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--c-tertiary)' }}>
          Creating…
        </div>
      )}
      {createErr && <div className={styles.fieldError}>{createErr}</div>}
      {error && <div className={styles.fieldError}>{error}</div>}
    </div>
  )
}
