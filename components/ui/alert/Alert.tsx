import type { ReactNode } from 'react'
import { cx } from '@/lib/utils/cx'
import styles from './Alert.module.scss'

export type AlertTone = 'success' | 'warning' | 'danger' | 'info'

export interface AlertProps {
  tone?: AlertTone
  title?: string
  children?: ReactNode
  className?: string
}

/** Inline status message using the status -fg/-bg token pairs (DESIGN_TOKENS §1). */
export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  return (
    <div className={cx(styles.alert, className)} data-tone={tone} role="alert">
      {title && <p className={styles.title}>{title}</p>}
      {children && <div className={styles.body}>{children}</div>}
    </div>
  )
}
