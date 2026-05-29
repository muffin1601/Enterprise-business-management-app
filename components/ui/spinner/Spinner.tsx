import { cx } from '@/lib/utils/cx'
import styles from './Spinner.module.scss'

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

/** Indeterminate loading spinner (respects prefers-reduced-motion via tokens). */
export function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      className={cx(styles.spinner, className)}
      data-size={size}
      role="status"
      aria-label={label}
    />
  )
}
