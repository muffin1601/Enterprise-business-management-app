import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cx } from '@/lib/utils/cx'
import styles from './Input.module.scss'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

/** Native select styled to match Input (consumes `invalid` so it pairs with FormField). */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cx(styles.input, styles.select, className)}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  )
})
