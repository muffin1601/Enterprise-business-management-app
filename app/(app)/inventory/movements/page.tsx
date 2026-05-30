import { getActionContext } from '@/lib/auth/action-context'
import { getAllMovements } from '@/features/inventory/server/queries'
import styles from '@/features/inventory/components/inventory.module.scss'

export const metadata = { title: 'Stock Movements · Watcon' }

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })

export default async function MovementsPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp   = await searchParams
  const page = Number(sp.page ?? '1')
  const ctx  = await getActionContext()
  if (!ctx.has('inventory.view') && !ctx.has('items.view')) {
    return <main className={styles.page}><div style={{ color:'var(--c-danger)', fontFamily:'var(--font-body)' }}>Access denied.</div></main>
  }

  const { rows, total } = await getAllMovements(page)
  const typeLabel: Record<string, string> = { receipt:'Receipt', issue:'Issue', transfer:'Transfer', adjustment:'Adjustment', opening:'Opening Stock', return:'Return' }

  return (
    <main className={styles.page}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {['Date','Item','Type','Direction','Qty','Value','Reference','By'].map(h => (
                <th key={h} className={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className={styles.emptyTable}>No movements recorded yet</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className={styles.row}>
                <td className={styles.td}>{fmtDate(r.date)}</td>
                <td className={styles.td}>
                  <div className={styles.itemName}>{r.itemName}</div>
                  {r.itemSku && <div className={styles.itemSku}>{r.itemSku}</div>}
                </td>
                <td className={styles.td}>{typeLabel[r.movementType] ?? r.movementType}</td>
                <td className={styles.td}>
                  <span style={{ fontFamily:'var(--font-body)', fontSize:9, fontWeight:600, letterSpacing:'0.10em', textTransform:'uppercase', padding:'2px 8px', borderRadius:2, background: r.direction==='in' ? 'var(--c-success-bg)' : 'var(--c-danger-bg)', color: r.direction==='in' ? 'var(--c-success)' : 'var(--c-danger)' }}>
                    {r.direction === 'in' ? 'IN' : 'OUT'}
                  </span>
                </td>
                <td className={`${styles.td} ${styles.mono}`} style={{ fontWeight:700, color: r.direction==='in' ? 'var(--c-success)' : 'var(--c-danger)' }}>
                  {r.direction==='in' ? '+' : '−'}{r.qty}
                </td>
                <td className={`${styles.td} ${styles.mono}`}>{r.value > 0 ? `₹${new Intl.NumberFormat('en-IN',{minimumFractionDigits:2}).format(r.value)}` : '—'}</td>
                <td className={`${styles.td}`} style={{ color:'var(--c-tertiary)', fontSize:11 }}>{r.reference ?? '—'}</td>
                <td className={styles.td} style={{ color:'var(--c-tertiary)', fontSize:11 }}>{r.creatorName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontFamily:'var(--font-body)', fontSize:12, color:'var(--c-tertiary)', textAlign:'right' }}>
        {total} total movements
      </div>
    </main>
  )
}
