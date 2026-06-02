'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { RoleWithCount, PermissionRow } from '../server/queries'
import { RolePermissionMatrix } from './role-permission-matrix'
import { createCustomRole, deleteCustomRole } from '../server/team-actions'
import { Icon } from '@/components/ui'
import styles from './team.module.scss'

interface Props {
  roles:          RoleWithCount[]
  allPermissions: PermissionRow[]
  grantedByRole:  Record<string, string[]>
  canManage:      boolean
}

export function RolesPageShell({ roles, allPermissions, grantedByRole, canManage }: Props) {
  const router     = useRouter()
  const [, startT] = useTransition()
  const [selectedId, setSelectedId] = useState<string>(roles[0]?.id ?? '')
  const [creating, setCreating]     = useState(false)
  const [newKey,   setNewKey]       = useState('')
  const [newName,  setNewName]      = useState('')
  const [newColor, setNewColor]     = useState('#6b7280')
  const [error,    setError]        = useState<string | null>(null)

  const selected   = roles.find(r => r.id === selectedId)
  const systemRoles = roles.filter(r => r.isSystem)
  const customRoles = roles.filter(r => !r.isSystem)

  function handleCreate() {
    if (!newName.trim() || !newKey.trim()) { setError('Name and key are required.'); return }
    setError(null)
    startT(async () => {
      const res = await createCustomRole({ key: newKey, name: newName, color: newColor })
      if (!res.ok) { setError(res.error?.message ?? 'Failed.'); return }
      setCreating(false); setNewKey(''); setNewName(''); setNewColor('#6b7280')
      router.refresh()
    })
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete role "${name}"? Members will lose this role.`)) return
    startT(async () => {
      const res = await deleteCustomRole(id)
      if (!res.ok) alert(res.error?.message ?? 'Failed.'); else router.refresh()
    })
  }

  return (
    <div className={styles.rolesShell}>
      {/* Left sidebar: role list */}
      <div className={styles.rolesSidebar}>
        <div className={styles.rolesSidebarHeader}>
          <span className={styles.rolesSidebarTitle}>Roles</span>
          {canManage && (
            <button className={styles.addRoleBtn} onClick={() => setCreating(true)} type="button" title="New role">
              <Icon name="plus" size={14} />
            </button>
          )}
        </div>

        {/* System roles */}
        {systemRoles.length > 0 && (
          <div className={styles.roleGroup}>
            <div className={styles.roleGroupLabel}>System Roles</div>
            {systemRoles.map(r => (
              <button
                key={r.id}
                type="button"
                className={`${styles.roleItem} ${selectedId === r.id ? styles.roleItemActive : ''}`}
                onClick={() => setSelectedId(r.id)}
              >
                <span className={styles.roleColorDot} style={{ background: r.color ?? '#6b7280' }} />
                <span className={styles.roleItemName}>{r.name}</span>
                <span className={styles.roleItemCount}>{r.memberCount}</span>
              </button>
            ))}
          </div>
        )}

        {/* Custom roles */}
        {(customRoles.length > 0 || creating) && (
          <div className={styles.roleGroup}>
            <div className={styles.roleGroupLabel}>Custom Roles</div>
            {customRoles.map(r => (
              <div key={r.id} className={`${styles.roleItem} ${selectedId === r.id ? styles.roleItemActive : ''}`}>
                <button
                  type="button"
                  className={styles.roleItemBtn}
                  onClick={() => setSelectedId(r.id)}
                >
                  <span className={styles.roleColorDot} style={{ background: r.color ?? '#6b7280' }} />
                  <span className={styles.roleItemName}>{r.name}</span>
                  <span className={styles.roleItemCount}>{r.memberCount}</span>
                </button>
                {canManage && (
                  <button
                    type="button"
                    className={styles.roleDeleteBtn}
                    onClick={() => handleDelete(r.id, r.name)}
                    title="Delete"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                )}
              </div>
            ))}

            {creating && (
              <div className={styles.createRoleForm}>
                <input className={styles.inlineInput} placeholder="Name" value={newName}
                  onChange={e => setNewName(e.target.value)} autoFocus />
                <input className={styles.inlineInput} placeholder="key_slug" value={newKey}
                  onChange={e => setNewKey(e.target.value.toLowerCase().replace(/[^a-z_]/g, '_'))} />
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <input type="color" className={styles.colorPicker} value={newColor}
                    onChange={e => setNewColor(e.target.value)} />
                  <button className={styles.btnPrimarySmall} onClick={handleCreate} type="button">Create</button>
                  <button className={styles.btnSecondarySmall} onClick={() => { setCreating(false); setError(null) }} type="button">Cancel</button>
                </div>
                {error && <div className={styles.inlineError}>{error}</div>}
              </div>
            )}
          </div>
        )}

        {customRoles.length === 0 && !creating && canManage && (
          <button className={styles.createFirstRole} onClick={() => setCreating(true)} type="button">
            <Icon name="plus" size={12} /> Create custom role
          </button>
        )}
      </div>

      {/* Right: permission matrix */}
      <div className={styles.rolesMain}>
        {selected ? (
          <RolePermissionMatrix
            key={selected.id}
            role={selected}
            allPermissions={allPermissions}
            grantedKeys={grantedByRole[selected.id] ?? []}
          />
        ) : (
          <div className={styles.emptyState}>
            <Icon name="shield" size={32} />
            <div className={styles.emptyTitle}>Select a role</div>
            <div className={styles.emptySub}>Choose a role from the left to view and edit its permissions</div>
          </div>
        )}
      </div>
    </div>
  )
}
