import styles from './auth-layout.module.scss'

/**
 * Auth route-group layout — a centered shell for login / register / forgot /
 * reset. Styled with CSS Modules + design tokens (no inline styles).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className={styles.main}>{children}</main>
}
