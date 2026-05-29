import { clsx, type ClassValue } from 'clsx'

/**
 * className combiner for CSS Modules (FRONTEND_DESIGN_SYSTEM.md §13).
 *
 * Replaces the old shadcn `cn()` (clsx + tailwind-merge). With CSS Modules there
 * are no conflicting Tailwind utilities to dedupe, so plain `clsx` is enough:
 *   className={cx(styles.button, isActive && styles.active)}
 */
export function cx(...inputs: ClassValue[]) {
  return clsx(inputs)
}
