'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Route } from 'next'
import type { MemberDetailEnriched, ActivityItem, AssignableRole } from '../server/queries'
import { updateMemberProfile } from '../server/team-actions'
import { setUserStatus } from '@/features/admin/server/actions'
import { EffectivePermissionsView }  from './effective-permissions-view'
import { MemberActivityTab }         from './member-activity-tab'
import { Icon } from '@/components/ui'
import styles from './team.module.scss'

// Existing role manager — keep using it
import { RoleManager } from './role-manager'

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })

type Tab = 'profile' | 'access' | 'activity'

interface Props {
  member:          MemberDetailEnriched
  assignableRoles: AssignableRole[]
  activity:        ActivityItem[]
  activeTab:       Tab
  canManage:       boolean
  isSelf:          boolean
}

function getInitials(name: string, email: string) {
  const n = name.trim()
  if (!n) return (email[0] ?? 'U').toUpperCase()
  return n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

export function MemberDetailView({ member, assignableRoles, activity, activeTab, canManage, isSelf }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()
  const [, startT] = useTransition()

  const [editing,    setEditing]    = useState(false)
  const [fullName,   setFullName]   = useState(member.fullName)
  const [jobTitle,   setJobTitle]   = useState(member.jobTitle ?? '')
  const [department, setDepartment] = useState(member.department ?? '')
  const [phone,      setPhone]      = useState(member.phone)
  const [msg,        setMsg]        = useState<string | null>(null)

  function setTab(tab: Tab) {
    const next = new URLSearchParams(sp.toString())
    next.set('tab', tab)
    router.push(`${pathname}?${next.toString()}` as Route)
  }

  function handleSaveProfile() {
    startT(async () => {
      const res = await updateMemberProfile(member.userId, { fullName, jobTitle, department, phone })
      if (!res.ok) { setMsg(res.error?.message ?? 'Failed.'); return }
      setMsg('Profile saved.'); setEditing(false); router.refresh()
    })
  }

  function handleToggleStatus() {
    if (!confirm(`${member.status === 'active' ? 'Deactivate' : 'Activate'} this member?`)) return
    startT(async () => {
      await setUserStatus({ userId: member.userId, active: member.status !== 'active' })
      router.refresh()
    })
  }

  const isOwner = member.roles.some(r => r.key === 'company_owner')

  return (
    <div className={styles.memberDetailWrap}>
      {/* Header */}
      <div className={styles.memberDetailHeader}>
        <div className={styles.memberDetailLeft}>
          <div className={`${styles.memberAvatarLg} ${member.status !== 'active' ? styles.memberAvatarInactive : ''}`}>
            {getInitials(member.fullName, member.email)}
          </div>
          <div>
            <div className={styles.memberDetailName}>
              {member.fullName || <span style={{ color:'var(--c-tertiary)', fontWeight:400 }}>—</span>}
              {isOwner && <span className={styles.ownerBadge}>Owner</span>}
            </div>
            <div className={styles.memberDetailEmail}>{member.email}</div>
            {(member.jobTitle || member.department) && (
              <div className={styles.memberDetailJob}>
                {[member.jobTitle, member.department].filter(Boolean).join(' · ')}
              </div>
            )}
            <div className={styles.memberDetailMeta}>
              Joined {fmtDate(member.joinedAt)}
              {member.roles.length > 0 && (
                <span className={styles.memberDetailRoles}>
                  {member.roles.map(r => (
                    <span key={r.key} className={styles.roleBadge}>{r.name}</span>
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.memberDetailActions}>
          <span className={`${styles.statusDot} ${member.status === 'active' ? styles.dotActive : styles.dotInactive}`} />
          <span className={styles.statusLabel}>{member.status === 'active' ? 'Active' : 'Inactive'}</span>
          {canManage && !isOwner && (
            <button className={styles.btnSecondary} onClick={handleToggleStatus} type="button">
              {member.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {(['profile','access','activity'] as Tab[]).map(t => (
          <button key={t} type="button"
            className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'profile' ? 'Profile' : t === 'access' ? 'Access & Roles' : 'Activity Log'}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {/* Profile tab */}
        {activeTab === 'profile' && (
          <div className={styles.profileTab}>
            {msg && (
              <div className={`${styles.flashMsg} ${msg.includes('Failed') ? styles.flashErr : styles.flashOk}`}>
                {msg} <button onClick={() => setMsg(null)}>×</button>
              </div>
            )}
            {editing ? (
              <div className={styles.profileForm}>
                <div className={styles.formGrid}>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel}>Full Name</label>
                    <input className={styles.formInput} value={fullName} onChange={e => setFullName(e.target.value)} />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel}>Phone</label>
                    <input className={styles.formInput} value={phone} onChange={e => setPhone(e.target.value)} />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel}>Job Title</label>
                    <input className={styles.formInput} value={jobTitle} onChange={e => setJobTitle(e.target.value)} />
                  </div>
                  <div className={styles.formRow}>
                    <label className={styles.formLabel}>Department</label>
                    <input className={styles.formInput} value={department} onChange={e => setDepartment(e.target.value)} />
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button className={styles.btnPrimary} onClick={handleSaveProfile} type="button">Save</button>
                  <button className={styles.btnSecondary} onClick={() => setEditing(false)} type="button">Cancel</button>
                </div>
              </div>
            ) : (
              <div className={styles.profileInfo}>
                <div className={styles.infoGrid}>
                  {[
                    ['Email',      member.email],
                    ['Phone',      member.phone || '—'],
                    ['Job Title',  member.jobTitle || '—'],
                    ['Department', member.department || '—'],
                    ['Status',     member.status],
                    ['Joined',     fmtDate(member.joinedAt)],
                  ].map(([l, v]) => (
                    <div key={l} className={styles.infoItem}>
                      <span className={styles.infoLabel}>{l}</span>
                      <span className={styles.infoValue}>{v}</span>
                    </div>
                  ))}
                </div>
                {(canManage || isSelf) && (
                  <button className={styles.btnSecondary} onClick={() => setEditing(true)} type="button" style={{ marginTop:16 }}>
                    <Icon name="pencil" size={13} /> Edit Profile
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Access & Roles tab */}
        {activeTab === 'access' && (
          <div className={styles.accessTab}>
            {canManage && (
              <div style={{ marginBottom:20 }}>
                <div className={styles.sectionTitle} style={{ marginBottom:10 }}>Assigned Roles</div>
                <RoleManager
                  userId={member.userId}
                  currentRoles={member.roles}
                  assignableRoles={assignableRoles}
                  locked={member.isOwner}
                />
              </div>
            )}
            <div>
              <div className={styles.sectionTitle} style={{ marginBottom:10 }}>Effective Permissions</div>
              <EffectivePermissionsView permissions={member.permissions} roles={member.roles} />
            </div>
          </div>
        )}

        {/* Activity tab */}
        {activeTab === 'activity' && (
          <MemberActivityTab activity={activity} />
        )}
      </div>
    </div>
  )
}
