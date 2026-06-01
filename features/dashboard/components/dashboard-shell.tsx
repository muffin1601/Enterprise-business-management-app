'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/features/auth/server/actions'
import { DashboardGrid } from './dashboard-grid'
import { Icon } from '@/components/ui'
import styles from './shell.module.scss'

const NAV = [
  {
    section: 'OVERVIEW',
    items: [
      { href: '/dashboard',       label: 'Dashboard',   icon: 'layout-dashboard' },
    ],
  },
  {
    section: 'BUSINESS',
    items: [
      { href: '/customers',       label: 'Customers',       icon: 'users' },
      { href: '/items',           label: 'Inventory',        icon: 'box' },
      { href: '/quotes',          label: 'Quotes',           icon: 'file-invoice' },
      { href: '/orders',          label: 'Sales Orders',     icon: 'receipt' },
      { href: '/purchase-orders', label: 'Procurement',      icon: 'shopping-cart' },
    ],
  },
  {
    section: 'FINANCE',
    items: [
      { href: '/invoices',        label: 'Invoices',    icon: 'file-dollar' },
      { href: '/reports',         label: 'Reports',     icon: 'chart-bar' },
    ],
  },
  {
    section: 'PEOPLE',
    items: [
      { href: '/hr',              label: 'HR',          icon: 'id' },
      { href: '/settings',        label: 'Settings',    icon: 'settings' },
    ],
  },
]

interface Props {
  userName: string
  orgName:  string
}

export function DashboardShell({ userName, orgName }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const initials = userName
    ? userName.split('@')[0]?.slice(0, 1).toUpperCase() ?? 'W'
    : 'W'

  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  return (
    <div className={styles.shell}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className={styles.sidebar} data-open={mobileOpen ? 'true' : undefined}>
        <div className={styles.brand}>
          <span className={styles.brandName}>WATCON</span>
          <span className={styles.brandSub}>Business Management</span>
        </div>

        <nav className={styles.nav}>
          {NAV.map((group) => (
            <div key={group.section} className={styles.navSection}>
              <span className={styles.navSectionLabel}>{group.section}</span>
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
                return (
                  <Link
                    key={item.href}
                    href={item.href as import('next').Route}
                    className={styles.navItem}
                    data-active={isActive ? 'true' : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon name={item.icon} className={styles.navIcon} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.footerAvatar}>{initials}</div>
          <div className={styles.footerInfo}>
            <div className={styles.footerName}>{userName}</div>
            <div className={styles.footerRole}>{orgName}</div>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <div className={styles.main}>
        {/* Topbar */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.hamburger}
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              <Icon name="menu-2" />
            </button>
            <span className={styles.pageTitle}>Dashboard</span>
            <span className={styles.breadcrumb}>/ {orgName}</span>
          </div>

          <div className={styles.topbarRight}>
            <span className={styles.topbarDate}>{today}</span>
            <Link href="/account" className={styles.iconBtn} aria-label="Account">
              <Icon name="user-circle" />
            </Link>
            <form action={signOut} style={{ display: 'contents' }}>
              <button type="submit" className={styles.iconBtn} aria-label="Sign out">
                <Icon name="logout" />
              </button>
            </form>
          </div>
        </header>

        {/* Content */}
        <div className={styles.content}>
          <DashboardGrid orgName={orgName} userName={userName} />
        </div>
      </div>
    </div>
  )
}
