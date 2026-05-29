import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cx } from '@/lib/utils/cx'
import styles from './Input.module.scss'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

/** Multiline input — shares the Input styling (FRONTEND_DESIGN_SYSTEM.md §8). */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(styles.input, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
})
