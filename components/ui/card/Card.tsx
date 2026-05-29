import type { HTMLAttributes } from 'react'
import { cx } from '@/lib/utils/cx'
import styles from './Card.module.scss'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Drop the hairline border (e.g. when nested). */
  borderless?: boolean
}

/** Surface container with a hairline border (minimal; elevation is rare). */
export function Card({ borderless, className, children, ...props }: CardProps) {
  return (
    <div
      className={cx(styles.card, className)}
      data-borderless={borderless || undefined}
      {...props}
    >
      {children}
    </div>
  )
}
