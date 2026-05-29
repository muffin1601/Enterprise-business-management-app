import {
  cloneElement,
  useId,
  type LabelHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react'
import styles from './FormField.module.scss'

export interface FormFieldProps {
  label: string
  /** Error message (e.g. RHF errors.x?.message). Renders the danger state. */
  error?: string
  hint?: string
  required?: boolean
  /** A single form control (Input/Textarea/select). Gets id + aria wired in. */
  children: ReactElement<{
    id?: string
    invalid?: boolean
    'aria-describedby'?: string
  }>
}

/**
 * Label + control + hint/error wrapper (FRONTEND_DESIGN_SYSTEM.md §8). Wires
 * `id`, `aria-invalid`, and `aria-describedby` onto the child control so the
 * field is accessible without callers repeating boilerplate.
 */
export function FormField({ label, error, hint, required, children }: FormFieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const control = cloneElement(children, {
    id,
    invalid: Boolean(error),
    'aria-describedby': describedBy,
  })

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** Standalone label, for cases where FormField is too opinionated. */
export function Label({
  children,
  ...props
}: { children: ReactNode } & LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={styles.label} {...props}>
      {children}
    </label>
  )
}
