import Link from 'next/link'
import { Button } from '@/components/ui'
import styles from './page.module.scss'

/**
 * Root index route. The authenticated redirect to /dashboard (or /login) is
 * owned by middleware.ts; this renders for the brief unauthenticated case.
 */
export default function HomePage() {
  return (
    <main className={styles.main}>
      <div className={styles.brand}>Watcon</div>
      <h1 className={styles.title}>Business Management System</h1>
      <p className={styles.subtitle}>
        Inventory, sales, finance, and people — one workspace for your business.
      </p>
      <div className={styles.actions}>
        <Link href="/login">
          <Button variant="primary">Sign in</Button>
        </Link>
        <Link href="/register">
          <Button variant="secondary">Create account</Button>
        </Link>
      </div>
    </main>
  )
}
