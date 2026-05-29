import type { ReactNode } from 'react'
import { cx } from '@/lib/utils/cx'
import styles from './Badge.module.scss'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}

/** Small status pill using the status -fg/-bg token pairs (DESIGN_TOKENS §1). */
export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, className)} data-tone={tone}>
      {children}
    </span>
  )
}
