import { forwardRef, type InputHTMLAttributes } from 'react'
import { cx } from '@/lib/utils/cx'
import styles from './Input.module.scss'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

/** Text input primitive. `invalid` wires aria-invalid for the danger ring. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(styles.input, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
})
