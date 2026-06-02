'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PERMISSION_MODULES } from '@/validations/team'
import { setRolePermissions } from '../server/team-actions'
import type { RoleWithCount, PermissionRow } from '../server/queries'
import { Icon } from '@/components/ui'
import styles from './team.module.scss'

interface Props {
  role:            RoleWithCount
  allPermissions:  PermissionRow[]
  grantedKeys:     string[]
}

export function RolePermissionMatrix({ role, allPermissions, grantedKeys }: Props) {
  const router     = useRouter()
  const [, startT] = useTransition()
  const [granted, setGranted] = useState<Set<string>>(new Set(grantedKeys))
  const [dirty,   setDirty]   = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState<string | null>(null)

  const isReadOnly = role.isSystem

  // Build a quick lookup: key → description
  const descMap: Record<string, string | null> = {}
  for (const p of allPermissions) descMap[p.key] = p.description

  function toggle(key: string) {
    if (isReadOnly) return
    setGranted(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
    setDirty(true)
    setMsg(null)
  }

  function toggleModule(keys: string[], grant: boolean) {
    if (isReadOnly) return
    setGranted(prev => {
      const next = new Set(prev)
      keys.forEach(k => { if (grant) next.add(k); else next.delete(k) })
      return next
    })
    setDirty(true)
  }

  function handleSave() {
    setSaving(true)
    startT(async () => {
      const res = await setRolePermissions({ roleId: role.id, permKeys: [...granted] })
      setSaving(false)
      if (!res.ok) { setMsg(res.error?.message ?? 'Failed to save.'); return }
      setMsg('Permissions saved.')
      setDirty(false)
      router.refresh()
    })
  }

  // For each module, find permissions that exist in the catalog
  const permKeySet = new Set(allPermissions.map(p => p.key))

  return (
    <div className={styles.matrix}>
      <div className={styles.matrixHeader}>
        <div>
          <div className={styles.matrixRoleName}>{role.name}</div>
          <div className={styles.matrixRoleSub}>
            {isReadOnly
              ? 'System role — permissions are read-only'
              : `${granted.size} permission${granted.size !== 1 ? 's' : ''} granted · ${role.memberCount} member${role.memberCount !== 1 ? 's' : ''}`
            }
          </div>
        </div>
        {!isReadOnly && dirty && (
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving} type="button">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      {msg && (
        <div className={`${styles.flashMsg} ${msg.includes('Failed') ? styles.flashErr : styles.flashOk}`}>
          {msg} <button onClick={() => setMsg(null)}>×</button>
        </div>
      )}

      {dirty && !isReadOnly && (
        <div className={styles.dirtyBanner}>
          <Icon name="alert-circle" size={13} /> Unsaved changes
        </div>
      )}

      <div className={styles.matrixBody}>
        {Object.entries(PERMISSION_MODULES).map(([moduleName, keys]) => {
          const available = keys.filter(k => permKeySet.has(k))
          if (available.length === 0) return null

          const allGranted  = available.every(k => granted.has(k))
          const someGranted = available.some(k => granted.has(k))

          return (
            <div key={moduleName} className={styles.matrixModule}>
              <div className={styles.matrixModuleHeader}>
                <span className={styles.matrixModuleName}>{moduleName}</span>
                {!isReadOnly && (
                  <div className={styles.matrixModuleActions}>
                    <button
                      type="button"
                      className={`${styles.moduleToggleBtn} ${allGranted ? styles.moduleToggleDeny : styles.moduleToggleGrant}`}
                      onClick={() => toggleModule(available, !allGranted)}
                    >
                      {allGranted ? 'Revoke All' : 'Grant All'}
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.matrixPermGrid}>
                {available.map(key => {
                  const isGranted  = granted.has(key)
                  const shortLabel = key.split('.').pop() ?? key

                  return (
                    <label
                      key={key}
                      className={`${styles.permItem} ${isGranted ? styles.permGranted : ''} ${isReadOnly ? styles.permReadOnly : ''}`}
                      title={descMap[key] ?? key}
                    >
                      <div className={`${styles.permToggle} ${isGranted ? styles.permToggleOn : ''}`}
                        onClick={() => toggle(key)}
                      >
                        <div className={styles.permToggleKnob} />
                      </div>
                      <div className={styles.permLabel}>
                        <span className={styles.permShort}>{shortLabel}</span>
                        <span className={styles.permKey}>{key}</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
