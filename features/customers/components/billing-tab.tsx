import type {
  BillingKPIs,
  AgingBucket,
  InvoiceRow,
  LedgerEntry,
} from '../server/queries'
import styles from './customers.module.scss'

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtINR = (n: number) => {
  if (n === 0) return '₹0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)}Cr`
  if (abs >= 100_000)    return `${sign}₹${(abs / 100_000).toFixed(2)}L`
  return `${sign}₹${new Intl.NumberFormat('en-IN').format(abs)}`
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

// ── Status badge ──────────────────────────────────────────────────────────────
function InvBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    draft:         { bg: 'var(--c-surface-2)',  color: 'var(--c-secondary)' },
    issued:        { bg: 'var(--c-info-bg)',     color: 'var(--c-info)' },
    paid:          { bg: 'var(--c-success-bg)',  color: 'var(--c-success)' },
    partially_paid:{ bg: 'var(--c-warning-bg)', color: 'var(--c-warning)' },
    overdue:       { bg: 'var(--c-danger-bg)',   color: 'var(--c-danger)' },
    cancelled:     { bg: 'var(--c-surface-3)',   color: 'var(--c-tertiary)' },
  }
  const s = map[status] ?? map.draft!
  return (
    <span style={{
      display: 'inline-block', fontSize: 9, fontWeight: 600,
      letterSpacing: '0.10em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 2,
      background: s.bg, color: s.color,
    }}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ── KPI cards ─────────────────────────────────────────────────────────────────
function KPICard({
  label, value, color, sub,
}: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue} style={{ color: color ?? 'var(--c-ink)', fontSize: 26 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--c-tertiary)', marginTop: 2 }}>
          {sub}
        </span>
      )}
    </div>
  )
}

// ── Aging bar ─────────────────────────────────────────────────────────────────
function AgingBar({ buckets }: { buckets: AgingBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.amount, 0)

  return (
    <div className={styles.panel} style={{ marginTop: 0 }}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Aging Analysis</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--c-ink)', fontWeight: 600 }}>
          {fmtINR(total)} total outstanding
        </span>
      </div>

      {/* Bar */}
      {total > 0 && (
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 16, gap: 1 }}>
          {buckets.filter(b => b.amount > 0).map((b, i) => {
            const colors = ['#0E7A3E','#5B8FD4','#B66A1C','#D4843A','#A63D3D']
            return (
              <div
                key={b.label}
                style={{
                  width: `${(b.amount / total) * 100}%`,
                  background: colors[i] ?? '#ccc',
                  transition: 'width 400ms ease',
                }}
              />
            )
          })}
        </div>
      )}

      {/* Bucket rows */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {buckets.map((b, i) => {
          const colors = ['var(--c-success)','#5B8FD4','var(--c-warning)','#D4843A','var(--c-danger)']
          return (
            <div key={b.label} style={{
              background: 'var(--c-bg)', border: '1px solid var(--c-border)',
              borderRadius: 'var(--radius-sm)', padding: '12px 14px',
            }}>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600,
                letterSpacing: '0.10em', textTransform: 'uppercase',
                color: b.amount > 0 ? (colors[i] ?? 'var(--c-secondary)') : 'var(--c-tertiary)',
                marginBottom: 6,
              }}>
                {b.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 700,
                color: b.amount > 0 ? (colors[i] ?? 'var(--c-ink)') : 'var(--c-tertiary)',
                lineHeight: 1,
              }}>
                {b.amount > 0 ? fmtINR(b.amount) : '—'}
              </div>
              {b.count > 0 && (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--c-tertiary)', marginTop: 4 }}>
                  {b.count} invoice{b.count > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Running bill (ledger) ─────────────────────────────────────────────────────
function RunningBill({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Running Bill</span>
        </div>
        <div style={{
          padding: '40px 0', textAlign: 'center',
          fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-tertiary)',
          letterSpacing: '0.04em',
        }}>
          No transactions recorded yet
        </div>
      </div>
    )
  }

  const finalBalance = entries[entries.length - 1]?.balance ?? 0

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>Running Bill</span>
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
          color: finalBalance > 0 ? 'var(--c-danger)' : 'var(--c-success)',
        }}>
          {finalBalance > 0
            ? `Outstanding: ${fmtINR(finalBalance)}`
            : finalBalance < 0
              ? `Advance: ${fmtINR(Math.abs(finalBalance))}`
              : 'Settled ✓'}
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--c-bg)' }}>
              {['Date', 'Particulars', 'Ref No.', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)'].map((h, i) => (
                <th key={h} style={{
                  padding: '10px 12px', textAlign: i >= 3 ? 'right' : 'left',
                  fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600,
                  letterSpacing: '0.10em', textTransform: 'uppercase',
                  color: 'var(--c-tertiary)', borderBottom: '1px solid var(--c-border)',
                  whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr
                key={i}
                style={{
                  background: e.type === 'payment' ? 'rgba(14,122,62,0.03)' : 'transparent',
                  transition: 'background 100ms',
                }}
                onMouseEnter={(ev) => { ev.currentTarget.style.background = 'var(--c-bg)' }}
                onMouseLeave={(ev) => {
                  ev.currentTarget.style.background = e.type === 'payment' ? 'rgba(14,122,62,0.03)' : 'transparent'
                }}
              >
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-border)', color: 'var(--c-tertiary)', whiteSpace: 'nowrap' }}>
                  {fmtDate(e.date)}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-border)', color: 'var(--c-ink)', fontWeight: e.type === 'invoice' ? 500 : 400 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: e.type === 'invoice' ? 'var(--c-info)' : 'var(--c-success)',
                    }} />
                    {e.particular}
                  </div>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-border)', color: 'var(--c-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {e.refNo || '—'}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-border)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: e.debit > 0 ? 'var(--c-ink)' : 'var(--c-tertiary)', fontWeight: e.debit > 0 ? 600 : 400 }}>
                  {e.debit > 0 ? fmtINR(e.debit) : '—'}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-border)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: e.credit > 0 ? 'var(--c-success)' : 'var(--c-tertiary)', fontWeight: e.credit > 0 ? 600 : 400 }}>
                  {e.credit > 0 ? fmtINR(e.credit) : '—'}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--c-border)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: e.balance > 0 ? 'var(--c-danger)' : e.balance < 0 ? 'var(--c-success)' : 'var(--c-tertiary)' }}>
                  {e.balance !== 0 ? fmtINR(e.balance) : '—'}
                </td>
              </tr>
            ))}

            {/* Totals row */}
            {entries.length > 0 && (() => {
              const totalDebit  = entries.reduce((s, e) => s + e.debit,  0)
              const totalCredit = entries.reduce((s, e) => s + e.credit, 0)
              return (
                <tr style={{ background: 'var(--c-bg)' }}>
                  <td colSpan={3} style={{ padding: '12px 12px', borderTop: '2px solid var(--c-border)', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-secondary)' }}>
                    Total
                  </td>
                  <td style={{ padding: '12px 12px', borderTop: '2px solid var(--c-border)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--c-ink)' }}>
                    {fmtINR(totalDebit)}
                  </td>
                  <td style={{ padding: '12px 12px', borderTop: '2px solid var(--c-border)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13, color: 'var(--c-success)' }}>
                    {fmtINR(totalCredit)}
                  </td>
                  <td style={{ padding: '12px 12px', borderTop: '2px solid var(--c-border)', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: finalBalance > 0 ? 'var(--c-danger)' : 'var(--c-success)' }}>
                    {fmtINR(finalBalance)}
                  </td>
                </tr>
              )
            })()}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Invoice table ─────────────────────────────────────────────────────────────
function InvoiceTable({ invoices }: { invoices: InvoiceRow[] }) {
  if (invoices.length === 0) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-tertiary)' }}>
        No invoices yet
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: 12 }}>
        <thead>
          <tr style={{ background: 'var(--c-bg)' }}>
            {['Invoice #', 'Date', 'Due Date', 'Total', 'Paid', 'Balance', 'Status'].map((h, i) => (
              <th key={h} style={{
                padding: '10px 12px', textAlign: i >= 3 && i < 6 ? 'right' : 'left',
                fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600,
                letterSpacing: '0.10em', textTransform: 'uppercase',
                color: 'var(--c-tertiary)', borderBottom: '1px solid var(--c-border)',
                whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-bg)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--c-border)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--c-ink)', fontSize: 11 }}>
                {inv.invoiceNo}
              </td>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--c-border)', color: 'var(--c-secondary)', whiteSpace: 'nowrap' }}>
                {fmtDate(inv.date)}
              </td>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--c-border)', color: inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'paid' ? 'var(--c-danger)' : 'var(--c-secondary)', whiteSpace: 'nowrap' }}>
                {inv.dueDate ? fmtDate(inv.dueDate) : '—'}
              </td>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--c-border)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--c-ink)', fontWeight: 600 }}>
                {fmtINR(inv.total)}
              </td>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--c-border)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--c-success)', fontWeight: inv.amountPaid > 0 ? 600 : 400 }}>
                {inv.amountPaid > 0 ? fmtINR(inv.amountPaid) : '—'}
              </td>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--c-border)', textAlign: 'right', fontFamily: 'var(--font-mono)', color: inv.balance > 0 ? 'var(--c-danger)' : 'var(--c-tertiary)', fontWeight: inv.balance > 0 ? 600 : 400 }}>
                {inv.balance > 0 ? fmtINR(inv.balance) : '—'}
              </td>
              <td style={{ padding: '11px 12px', borderBottom: '1px solid var(--c-border)' }}>
                <InvBadge status={inv.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main BillingTab export ────────────────────────────────────────────────────
interface Props {
  kpis:     BillingKPIs
  aging:    AgingBucket[]
  invoices: InvoiceRow[]
  ledger:   LedgerEntry[]
}

export function BillingTab({ kpis, aging, invoices, ledger }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── 6-card KPI strip ─────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        <KPICard label="Total Billed"     value={fmtINR(kpis.totalBilled)}    />
        <KPICard label="Total Received"   value={fmtINR(kpis.totalReceived)}  color="var(--c-success)" />
        <KPICard label="Outstanding"      value={fmtINR(kpis.outstanding)}    color={kpis.outstanding > 0 ? 'var(--c-danger)' : 'var(--c-success)'}
          sub={kpis.outstanding > 0 ? 'Pending collection' : 'Fully settled'} />
        <KPICard label="Overdue"          value={fmtINR(kpis.overdue)}        color={kpis.overdue > 0 ? 'var(--c-danger)' : 'var(--c-tertiary)'} />
        <KPICard label="Credit Limit"     value={kpis.creditLimit > 0 ? fmtINR(kpis.creditLimit) : '—'} />
        <KPICard label="Available Credit" value={kpis.creditLimit > 0 ? fmtINR(kpis.availableCredit) : '—'}
          color={kpis.availableCredit <= 0 && kpis.creditLimit > 0 ? 'var(--c-danger)' : undefined} />
      </div>

      {/* ── Aging analysis ───────────────────────────────────────── */}
      <AgingBar buckets={aging} />

      {/* ── Running bill ─────────────────────────────────────────── */}
      <RunningBill entries={ledger} />

      {/* ── Invoice list ─────────────────────────────────────────── */}
      {invoices.length > 0 && (
        <div className={styles.panel} style={{ marginTop: 0 }}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Invoices</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--c-tertiary)' }}>
              {invoices.length} invoice{invoices.length > 1 ? 's' : ''}
            </span>
          </div>
          <InvoiceTable invoices={invoices} />
        </div>
      )}
    </div>
  )
}
