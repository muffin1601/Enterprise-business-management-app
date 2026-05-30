import { getActionContext } from '@/lib/auth/action-context'
import { getAdjustments } from '@/features/inventory/server/queries'
import styles from '@/features/inventory/components/inventory.module.scss'

export const metadata = { title: 'Stock Adjustments · Watcon' }

const fmtDateTime = (d: string) => {
  const dt = new Date(d)
  return dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) + ' ' + dt.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })
}

export default async function AdjustmentsPage() {
  const ctx = await getActionContext()
  if (!ctx.has('inventory.view') && !ctx.has('items.view')) {
    return <main className={styles.page}><div style={{ color:'var(--c-danger)', fontFamily:'var(--font-body)' }}>Access denied.</div></main>
  }

  const adjustments = await getAdjustments()

  return (
    <main className={styles.page}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {['Date & Time','Type','Qty','Reason','Ref No.','By'].map(h => (
                <th key={h} className={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {adjustments.length === 0 ? (
              <tr><td colSpan={6} className={styles.emptyTable}>No adjustments recorded</td></tr>
            ) : adjustments.map(a => (
              <tr key={a.id} className={styles.row}>
                <td className={styles.td}>{fmtDateTime(a.at)}</td>
                <td className={styles.td}>
                  <span style={{ fontFamily:'var(--font-body)', fontSize:9, fontWeight:600, letterSpacing:'0.10em', textTransform:'uppercase', padding:'2px 8px', borderRadius:2, background: a.type==='add' ? 'var(--c-success-bg)' : 'var(--c-danger-bg)', color: a.type==='add' ? 'var(--c-success)' : 'var(--c-danger)' }}>
                    {a.type === 'add' ? '+ Add' : '− Reduce'}
                  </span>
                </td>
                <td className={`${styles.td} ${styles.mono}`} style={{ fontWeight:700, fontSize:13, color: a.type==='add' ? 'var(--c-success)' : 'var(--c-danger)' }}>{a.type==='add' ? '+' : '−'}{a.qty}</td>
                <td className={styles.td}>{a.reason}</td>
                <td className={`${styles.td} ${styles.mono}`} style={{ fontSize:11, color:'var(--c-tertiary)' }}>{a.refNo ?? '—'}</td>
                <td className={styles.td} style={{ fontSize:11, color:'var(--c-tertiary)' }}>{a.adjusterName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
