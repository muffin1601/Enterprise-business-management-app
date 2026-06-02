import { PERMISSION_MODULES } from '@/validations/team'
import styles from './team.module.scss'

interface Props { permissions: string[]; roles: { key: string; name: string }[] }

export function EffectivePermissionsView({ permissions, roles }: Props) {
  const grantedSet = new Set(permissions)

  return (
    <div className={styles.effectivePerms}>
      <div className={styles.effectivePermsHeader}>
        <div className={styles.effectivePermsRoles}>
          Inherited from:&nbsp;
          {roles.length === 0
            ? <span style={{ color:'var(--c-tertiary)' }}>No roles assigned</span>
            : roles.map(r => (
                <span key={r.key} className={styles.roleBadge}>{r.name}</span>
              ))
          }
        </div>
        <div className={styles.effectiveCount}>{grantedSet.size} permissions</div>
      </div>

      <div className={styles.effectiveModules}>
        {Object.entries(PERMISSION_MODULES).map(([mod, keys]) => {
          const granted = keys.filter(k => grantedSet.has(k))
          if (granted.length === 0) return null
          return (
            <div key={mod} className={styles.effectiveModule}>
              <div className={styles.effectiveModLabel}>{mod}</div>
              <div className={styles.effectivePermList}>
                {keys.map(k => (
                  <span
                    key={k}
                    className={`${styles.permChip} ${grantedSet.has(k) ? styles.permChipGranted : styles.permChipDenied}`}
                    title={k}
                  >
                    {grantedSet.has(k) ? '✓' : '✗'} {k.split('.').pop()}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
