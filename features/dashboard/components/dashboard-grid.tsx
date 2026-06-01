'use client'

import { useOverview, useActivity, useNotices } from '@/features/dashboard/hooks'
import { SalesTrendChart } from './sales-trend-chart'
import Link from 'next/link'
import type { Route } from 'next'
import { Icon } from '@/components/ui'
import styles from './dashboard.module.scss'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

function fmtCur(n: number) {
  if (n >= 10_000_000) return '₹' + (n / 10_000_000).toFixed(1) + 'Cr'
  if (n >= 100_000)    return '₹' + (n / 100_000).toFixed(1) + 'L'
  return '₹' + fmt(n)
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Business KPI mock (replace with real queries when tables have data) ───────
const BIZ_KPIS = [
  { key: 'revenue',     label: 'Revenue This Month', value: 43_82_000,  fmt: fmtCur, delta: '+12%', dir: 'up',   accent: 'success', sub: 'vs last month' },
  { key: 'outstanding', label: 'Outstanding',         value: 12_45_600,  fmt: fmtCur, delta: '-3%',  dir: 'down', accent: 'danger',  sub: 'from 8 customers' },
  { key: 'quotes',      label: 'Open Quotes',         value: 14,         fmt: fmt,    delta: '+2',   dir: 'up',   accent: '',        sub: '₹62L in pipeline' },
  { key: 'inventory',   label: 'Inventory Value',     value: 1_84_30_000,fmt: fmtCur, delta: '',     dir: 'flat', accent: '',        sub: 'at purchase cost' },
  { key: 'lowstock',    label: 'Low Stock Items',     value: 7,          fmt: fmt,    delta: '',     dir: 'flat', accent: 'warning', sub: 'need reorder' },
  { key: 'customers',   label: 'Active Customers',    value: 0,          fmt: fmt,    delta: '',     dir: 'flat', accent: '',        sub: '' },
]

const INV_OVERVIEW = [
  { family: 'Floor Tiles',     stock: '4,820 SQM', value: '₹48.2L',  level: 'ok' },
  { family: 'Marble & Stone',  stock: '380 SQM',   value: '₹1.2Cr',  level: 'ok' },
  { family: 'Wood Flooring',   stock: '2,140 SQF', value: '₹28.6L',  level: 'ok' },
  { family: 'Pipes & Plumbing',stock: '960 MTR',   value: '₹4.8L',   level: 'low' },
  { family: 'Sanitary Ware',   stock: '84 NOS',    value: '₹18.4L',  level: 'ok' },
  { family: 'Electrical',      stock: '12 NOS',    value: '₹0.9L',   level: 'low' },
]

const QUICK_ACTIONS = [
  { href: '/quotes/new',    label: 'New Quote',    icon: 'file-plus',     desc: 'Draft a quote' },
  { href: '/customers/new', label: 'Add Customer', icon: 'user-plus',     desc: 'CRM record' },
  { href: '/items/new',     label: 'Add Item',     icon: 'package',       desc: 'Catalogue' },
  { href: '/purchase-orders/new', label: 'Purchase Order', icon: 'shopping-cart-plus', desc: 'Raise PO' },
  { href: '/invoices/new',  label: 'New Invoice',  icon: 'file-invoice',  desc: 'Bill a customer' },
  { href: '/reports',       label: 'Reports',      icon: 'chart-bar',     desc: 'Analytics' },
]

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  orgName: string
  userName: string
}

// ── Dashboard Grid ─────────────────────────────────────────────────────────────
export function DashboardGrid({ orgName, userName }: Props) {
  const { data: overview, isLoading: ovLoading } = useOverview()
  const { data: activity, isLoading: actLoading } = useActivity()
  const { data: notices } = useNotices()

  // Merge real member count into KPIs
  const kpis = BIZ_KPIS.map((k) =>
    k.key === 'customers'
      ? { ...k, value: overview?.kpis.activeMembers ?? 0 }
      : k
  )

  // Greeting
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const displayName = userName.split('@')[0]

  return (
    <div className={styles.page}>

      {/* Greeting */}
      <div className={styles.greeting}>
        <div className={styles.greetingText}>{greeting}, {displayName}.</div>
        <div className={styles.greetingSub}>Here is what is happening at {orgName} today.</div>
      </div>

      {/* ── Section 1: KPI Strip ─────────────────────────────────────── */}
      <div className={styles.kpiStrip}>
        {kpis.map((k) => (
          <div key={k.key} className={styles.kpiCard} data-accent={k.accent || undefined}>
            <span className={styles.kpiLabel}>{k.label}</span>
            {ovLoading && k.key === 'customers' ? (
              <>
                <div className={`${styles.skeleton} ${styles.skeletonVal}`} />
                <div className={`${styles.skeleton} ${styles.skeletonLbl}`} />
              </>
            ) : (
              <>
                <span className={styles.kpiValue}>{k.fmt(k.value)}</span>
                {k.sub && <span className={styles.kpiSub}>{k.sub}</span>}
                {k.delta && (
                  <span className={styles.kpiDelta} data-dir={k.dir}>
                    {k.dir === 'up' && <Icon name="trending-up" />}
                    {k.dir === 'down' && <Icon name="trending-down" />}
                    {k.delta}
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Section 2: Chart + Inventory Overview ────────────────────── */}
      <div className={styles.midRow}>
        {/* Sales Trend */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Sales Trend — Last 14 Days</span>
            <Link href={'/reports' as Route} className={styles.panelLink}>View all →</Link>
          </div>
          <SalesTrendChart series={activity?.series ?? []} isLoading={actLoading} />
        </div>

        {/* Inventory Overview */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Inventory Overview</span>
            <Link href={'/items' as Route} className={styles.panelLink}>Catalogue →</Link>
          </div>
          <table className={styles.invTable}>
            <thead>
              <tr>
                <th className={styles.invTh}>Category</th>
                <th className={`${styles.invTh} ${styles.right}`}>Stock</th>
                <th className={`${styles.invTh} ${styles.right}`}>Value</th>
                <th className={styles.invTh}></th>
              </tr>
            </thead>
            <tbody>
              {INV_OVERVIEW.map((row) => (
                <tr key={row.family} className={styles.invRow}>
                  <td className={styles.invTd}>{row.family}</td>
                  <td className={`${styles.invTd} ${styles.right}`}>{row.stock}</td>
                  <td className={`${styles.invTd} ${styles.right}`}>{row.value}</td>
                  <td className={styles.invTd}>
                    <span className={styles.stockBadge} data-level={row.level}>
                      {row.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 3: Recent Activity + Notifications ────────────────── */}
      <div className={styles.bottomRow}>
        {/* Recent Activity */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Recent Activity</span>
          </div>
          {actLoading ? (
            <div className={styles.actList}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ padding: '9px 0', borderBottom: '1px solid var(--color-border-panel)' }}>
                  <div className={`${styles.skeleton} ${styles.skeletonRow}`} style={{ height: 11 }} />
                  <div className={`${styles.skeleton} ${styles.skeletonLbl}`} style={{ marginTop: 6 }} />
                </div>
              ))}
            </div>
          ) : !activity?.canView ? (
            <div className={styles.notifEmpty}>
              Activity log requires admin access.
            </div>
          ) : activity.recent.length === 0 ? (
            <div className={styles.empty}>No recent activity</div>
          ) : (
            <div className={styles.actList}>
              {activity.recent.map((item) => (
                <div key={item.id} className={styles.actItem}>
                  <div className={styles.actDot} data-type={item.action} />
                  <div className={styles.actMain}>
                    <span className={styles.actLabel}>{item.label}</span>
                    {item.actorName && (
                      <span className={styles.actMeta}>by {item.actorName}</span>
                    )}
                  </div>
                  <span className={styles.actTime}>{relTime(item.at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notifications / Pending Invitations */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Notifications</span>
            {(notices?.invitations.length ?? 0) > 0 && (
              <Link href={'/settings/team' as Route} className={styles.panelLink}>Manage →</Link>
            )}
          </div>

          {/* Pending members invite notices */}
          {(notices?.invitations.length ?? 0) > 0 ? (
            <div className={styles.notifList}>
              {notices!.invitations.map((inv) => (
                <div key={inv.id} className={styles.notifItem}>
                  <Icon name="mail" className={styles.notifIcon} data-tone="info" />
                  <div className={styles.notifBody}>
                    <div className={styles.notifTitle}>Pending invitation</div>
                    <div className={styles.notifSub}>{inv.email} · {inv.roleName}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Static business notifications as placeholder */}
              <div className={styles.notifList}>
                {[
                  { tone: 'warn',    icon: 'alert-triangle', title: '7 items below reorder level', sub: 'Pipes & Electrical — review stock' },
                  { tone: 'info',    icon: 'file-invoice',   title: '3 invoices due this week',    sub: '₹8.4L total outstanding' },
                  { tone: 'success', icon: 'circle-check',   title: 'Quote QT-2026-0028 accepted', sub: 'Elite Residences — ₹14.2L' },
                  { tone: 'info',    icon: 'package',        title: 'GRN-2026-0019 received',      sub: 'Kajaria ceramics — 1,200 SQM' },
                ].map((n, i) => (
                  <div key={i} className={styles.notifItem}>
                    <Icon name={n.icon} className={styles.notifIcon} data-tone={n.tone} />
                    <div className={styles.notifBody}>
                      <div className={styles.notifTitle}>{n.title}</div>
                      <div className={styles.notifSub}>{n.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Section 4: Quick Actions ──────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Quick Actions</span>
        </div>
        <div className={styles.qaRow}>
          {QUICK_ACTIONS.map((qa) => (
            <Link key={qa.href} href={qa.href as Route} className={styles.qaBtn}>
              <Icon name={qa.icon} className={styles.qaIcon} />
              <span className={styles.qaLabel}>{qa.label}</span>
              <span className={styles.qaDesc}>{qa.desc}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
