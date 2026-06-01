'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/features/auth/server/actions'
import { PageActionsProvider, PageActionsSlot } from './page-actions'
import { Icon } from '@/components/ui'
import styles from './AppShell.module.scss'

const NAV = [
  {
    group: 'MAIN',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'ti-layout-dashboard' },
    ],
  },
  {
    group: 'SALES',
    items: [
      { href: '/quotes',    label: 'Quotes',       icon: 'ti-file-invoice' },
      { href: '/customers', label: 'Customers',    icon: 'ti-users' },
      // { href: '/orders',    label: 'Sales Orders', icon: 'ti-receipt' },
    ],
  },
  {
    group: 'INVENTORY',
    items: [
      { href: '/inventory/items', label: 'Items', icon: 'ti-box' },
    ],
  },
  {
    group: 'PROCUREMENT',
    items: [
      { href: '/purchase-orders', label: 'Purchase Orders', icon: 'ti-shopping-cart' },
    ],
  },
  {
    group: 'PEOPLE',
    items: [
      { href: '/users', label: 'Team & Users', icon: 'ti-users' },
    ],
  },
  {
    group: 'ADMINISTRATION',
    items: [
      { href: '/settings',         label: 'Settings',     icon: 'ti-settings' },
      { href: '/settings/company', label: 'Organization', icon: 'ti-building' },
      { href: '/account',          label: 'Account',      icon: 'ti-user-circle' },
    ],
  },
]

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':        'Dashboard',
  '/customers':        'Customers',
  '/quotes':           'Quotes',
  '/orders':           'Sales Orders',
  '/invoices':         'Invoices',
  '/inventory/items':       'Inventory',
  '/inventory/movements':   'Stock Movements',
  '/inventory/adjustments': 'Adjustments',
  '/items':            'Inventory',
  '/reports':          'Stock Reports',
  '/purchase-orders':  'Procurement',
  '/hr':               'HR',
  '/users':            'Users',
  '/settings/company': 'Organization',
  '/settings':         'Settings',
  '/account':          'Account',
}

function getTitle(pathname: string) {
  const key = Object.keys(PAGE_TITLES)
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname === k || pathname.startsWith(k + '/'))
  return key ? PAGE_TITLES[key] : 'Watcon'
}

interface Props {
  userName: string
  orgName:  string
  children: React.ReactNode
}

export function AppShell({ userName, orgName, children }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const initials = (userName.split('@')[0] ?? 'W').slice(0, 2).toUpperCase()
  const title    = getTitle(pathname)
  const today    = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  })

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === href
      : pathname === href || pathname.startsWith(href + '/')

  return (
    <PageActionsProvider>
      <div className={styles.shell}>
        {open && <div className={styles.overlay} onClick={() => setOpen(false)} />}

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside className={styles.sidebar} data-open={open ? 'true' : undefined}>
          <div className={styles.brand}>
            <Image
              src="/logo2.png"
              alt="Watcon"
              width={140}
              height={48}
              className={styles.brandLogo}
              priority
            />
          </div>

          <nav className={styles.nav}>
            {NAV.map((group) => (
              <div key={group.group} className={styles.navGroup}>
                <span className={styles.navGroupLabel}>{group.group}</span>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href as never}
                    className={styles.navItem}
                    data-active={isActive(item.href) ? 'true' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon name={item.icon.replace(/^ti-/, '')} className={styles.navIcon} />
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className={styles.sidebarDate}>{today}</div>

          <div className={styles.sidebarFooter}>
            <div className={styles.footerAvatar}>{initials}</div>
            <div className={styles.footerText}>
              <div className={styles.footerName}>{userName}</div>
              <div className={styles.footerOrg}>{orgName}</div>
            </div>
            <form action={signOut} style={{ display: 'contents' }}>
              <button type="submit" className={styles.footerSignOut} title="Sign out">
                <Icon name="logout" />
              </button>
            </form>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────────────────────── */}
        <div className={styles.main}>
          {/* Topbar: title left · page-injected actions centre-right · date right */}
          <header className={styles.topbar}>
            <div className={styles.topbarLeft}>
              <button
                className={styles.hamburger}
                onClick={() => setOpen((v) => !v)}
                aria-label="Open navigation"
              >
                <Icon name="menu-2" />
              </button>
              <span className={styles.topbarTitle}>{title}</span>
            </div>

            <div className={styles.topbarRight}>
              {/* Page-specific actions injected here by child pages */}
              <PageActionsSlot />
            </div>
          </header>

          <div className={styles.content}>{children}</div>
        </div>
      </div>
    </PageActionsProvider>
  )
}
