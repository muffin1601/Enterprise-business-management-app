import type { ReactNode } from 'react'
import styles from './auth-card.module.scss'

export interface AuthCardProps {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  /** Secondary links/actions rendered under the card (e.g. "Back to sign in"). */
  footer?: ReactNode
}

/** Centered card shell shared by every auth screen (login/register/reset). */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.brand}>Watcon</div>
      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {children}
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  )
}
