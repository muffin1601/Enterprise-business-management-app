import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cx } from '@/lib/utils/cx'
import { Spinner } from '@/components/ui/spinner/Spinner'
import styles from './Button.module.scss'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Renders a spinner and disables the button. */
  loading?: boolean
  /** Stretch to the container width (common for form submits). */
  fullWidth?: boolean
}

/**
 * Base button primitive (FRONTEND_DESIGN_SYSTEM.md §8). Variants/size via
 * data-attributes so the CSS Module owns all styling — no inline styles.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, fullWidth = false, disabled, children, className, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cx(styles.button, className)}
      data-variant={variant}
      data-size={size}
      data-full-width={fullWidth || undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      <span>{children}</span>
    </button>
  )
})
