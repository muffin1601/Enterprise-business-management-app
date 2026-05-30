import Image from 'next/image'
import type { ReactNode } from 'react'
import styles from './auth-card.module.scss'

export interface AuthCardProps {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className={styles.wrap}>
      {/* Company logo */}
      <div className={styles.brand}>
        <Image
          src="/logo1.png"
          alt="Watcon"
          width={160}
          height={60}
          className={styles.logo}
          priority
        />
      </div>

      <div className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        {children}
      </div>

      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  )
}
