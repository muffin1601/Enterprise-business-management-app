import type { RiDetail } from '../server/queries'
import styles from './running-invoices.module.scss'

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)}`

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n)

export function RiItemsTab({ ri }: { ri: RiDetail }) {
  const totalTaxable  = ri.items.reduce((s, i) => s + i.taxableValue, 0)
  const totalGst      = ri.items.reduce((s, i) => s + i.cgstAmount + i.sgstAmount + i.igstAmount, 0)
  const totalBillable = ri.items.reduce((s, i) => s + i.qtyToBill, 0)

  return (
    <div className={styles.itemsTabWrap}>
      {/* Two-source explanation */}
      <div className={styles.twoSourceNote}>
        <div className={styles.twoSourceItem}>
          <span className={styles.twoSourceIcon}>📦</span>
          <div>
            <div className={styles.twoSourceLabel}>Quantities from</div>
            <div className={styles.twoSourceValue}>Delivery Challans (actual goods delivered)</div>
          </div>
        </div>
        <div className={styles.twoSourceSep}>+</div>
        <div className={styles.twoSourceItem}>
          <span className={styles.twoSourceIcon}>📋</span>
          <div>
            <div className={styles.twoSourceLabel}>Prices from</div>
            <div className={styles.twoSourceValue}>Sales Order (agreed unit prices)</div>
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className={styles.itemsTable} style={{ tableLayout:'fixed', width:'100%' }}>
          <colgroup>
            <col style={{ width:28 }} /><col style={{ width:'22%' }} /><col style={{ width:70 }} /><col style={{ width:50 }} /><col style={{ width:90 }} /><col style={{ width:80 }} /><col style={{ width:80 }} /><col style={{ width:80 }} /><col style={{ width:80 }} /><col style={{ width:55 }} /><col style={{ width:90 }} /><col style={{ width:90 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign:'center' }}>#</th>
              <th style={{ textAlign:'left' }}>Item</th>
              <th style={{ textAlign:'left' }}>HSN</th>
              <th style={{ textAlign:'center' }}>Unit</th>
              <th style={{ textAlign:'left' }}>DC Source</th>
              <th className={styles.numCol}>Delivered</th>
              <th className={styles.numCol}>Prev. Billed</th>
              <th className={styles.numCol} style={{ color:'var(--c-success)' }}>To Bill</th>
              <th className={styles.numCol}>SO Price</th>
              <th className={styles.numCol}>Disc%</th>
              <th className={styles.numCol}>Taxable</th>
              <th className={styles.numCol}>Total</th>
            </tr>
          </thead>
          <tbody>
            {ri.items.map((item, i) => {
              const isZeroBill = item.qtyToBill === 0
              return (
                <tr key={item.id} style={{ opacity: isZeroBill ? 0.45 : 1 }}>
                  <td style={{ textAlign:'center', color:'var(--c-tertiary)', fontSize:11 }}>{i + 1}</td>
                  <td>
                    <div className={styles.itemName}>{item.name}</div>
                    {item.description && <div className={styles.itemDesc}>{item.description}</div>}
                    {item.brand && <div className={styles.itemDesc}>{item.brand}</div>}
                  </td>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--c-secondary)' }}>{item.hsnCode ?? '—'}</td>
                  <td style={{ textAlign:'center', color:'var(--c-secondary)' }}>{item.unit ?? '—'}</td>
                  <td>
                    <span className={styles.dcSourceChip}>{item.dcNo}</span>
                  </td>
                  <td className={styles.numCol}>{fmtNum(item.qtyDelivered)}</td>
                  <td className={styles.numCol} style={{ color: item.qtyAlreadyBilled > 0 ? 'var(--c-warning)' : 'var(--c-tertiary)' }}>
                    {item.qtyAlreadyBilled > 0 ? fmtNum(item.qtyAlreadyBilled) : '—'}
                  </td>
                  <td className={styles.numCol} style={{ color:'var(--c-success)', fontWeight:600 }}>
                    {fmtNum(item.qtyToBill)}
                  </td>
                  <td className={styles.numCol}>{item.unitPrice > 0 ? fmtINR(item.unitPrice) : <span style={{ color:'var(--c-danger)' }}>No price</span>}</td>
                  <td className={styles.numCol}>{item.discountPct > 0 ? `${item.discountPct}%` : '—'}</td>
                  <td className={styles.numCol}>{fmtINR(item.taxableValue)}</td>
                  <td className={styles.numCol} style={{ fontWeight:600 }}>{fmtINR(item.total)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={styles.tfootTotal}>
              <td colSpan={7} style={{ textAlign:'right', fontWeight:600, fontSize:12, paddingRight:10 }}>
                Total billable qty: {fmtNum(totalBillable)}
              </td>
              <td className={styles.numCol} style={{ color:'var(--c-success)', fontWeight:700 }}>{fmtNum(totalBillable)}</td>
              <td colSpan={2} />
              <td className={styles.numCol} style={{ fontWeight:700 }}>{fmtINR(totalTaxable)}</td>
              <td className={styles.numCol} style={{ fontWeight:700 }}>{fmtINR(ri.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* GST summary */}
      <div className={styles.gstSummary}>
        {ri.isIgst ? (
          <div className={styles.gstRow}>
            <span>IGST @ {ri.gstPct}%</span>
            <span>{fmtINR(ri.igstAmount)}</span>
          </div>
        ) : (
          <>
            <div className={styles.gstRow}><span>CGST @ {ri.gstPct / 2}%</span><span>{fmtINR(ri.cgstAmount)}</span></div>
            <div className={styles.gstRow}><span>SGST @ {ri.gstPct / 2}%</span><span>{fmtINR(ri.sgstAmount)}</span></div>
          </>
        )}
        <div className={`${styles.gstRow} ${styles.gstGrandTotal}`}>
          <span>Grand Total</span>
          <span>{fmtINR(ri.grandTotal)}</span>
        </div>
      </div>
    </div>
  )
}
