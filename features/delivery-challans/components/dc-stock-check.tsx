'use client'

import Link from 'next/link'
import type { Route } from 'next'
import type { StockCheckResult } from '../server/stock-check'
import styles from './delivery-challans.module.scss'
import { Icon } from '@/components/ui'

interface Props {
  result: StockCheckResult
  onProceed:        (partial: boolean) => void  // partial=false → full, partial=true → only in-stock items
  canCreatePo:      boolean
}

export function DcStockCheck({ result, onProceed, canCreatePo }: Props) {
  const { canDispatch, canPartial, allInStock, itemsReady, itemsMissing, totalShortfall, hasExistingPo, items } = result

  const readyItems   = items.filter(i => i.stockStatus === 'sufficient')
  const missingItems = items.filter(i => i.stockStatus !== 'sufficient')

  return (
    <div className={styles.stockCheckWrap}>
      {/* ── Overall status banner ─────────────────────────── */}
      {allInStock ? (
        <div className={`${styles.stockBanner} ${styles.stockBannerOk}`}>
          <Icon name="circle-check" size={20} />
          <div>
            <div className={styles.stockBannerTitle}>All {items.length} items are in stock</div>
            <div className={styles.stockBannerSub}>You can generate the delivery challan immediately.</div>
          </div>
        </div>
      ) : canPartial ? (
        <div className={`${styles.stockBanner} ${styles.stockBannerWarn}`}>
          <Icon name="alert-triangle" size={20} />
          <div>
            <div className={styles.stockBannerTitle}>{itemsMissing} item{itemsMissing !== 1 ? 's' : ''} out of stock</div>
            <div className={styles.stockBannerSub}>{itemsReady} item{itemsReady !== 1 ? 's' : ''} ready · {totalShortfall} units short total</div>
          </div>
        </div>
      ) : (
        <div className={`${styles.stockBanner} ${styles.stockBannerErr}`}>
          <Icon name="circle-x" size={20} />
          <div>
            <div className={styles.stockBannerTitle}>No items available for dispatch</div>
            <div className={styles.stockBannerSub}>All items need to be restocked before generating a challan.</div>
          </div>
        </div>
      )}

      {/* ── Ready items ───────────────────────────────────── */}
      {readyItems.length > 0 && (
        <div className={styles.stockSection}>
          <div className={styles.stockSectionTitle}>
            <span className={`${styles.stockBadge} ${styles.stockOk}`}>✓ Ready to Dispatch</span>
            <span className={styles.stockSectionCount}>{readyItems.length} item{readyItems.length !== 1 ? 's' : ''}</span>
          </div>
          <table className={styles.stockTable}>
            <thead>
              <tr>
                <th>Item</th>
                <th className={styles.numCol}>Invoice Qty</th>
                <th className={styles.numCol}>In Stock</th>
              </tr>
            </thead>
            <tbody>
              {readyItems.map(item => (
                <tr key={item.invoiceItemId}>
                  <td>
                    <div className={styles.itemName}>{item.name}</div>
                    {item.hsnCode && <div className={styles.itemDesc}>HSN: {item.hsnCode}</div>}
                  </td>
                  <td className={styles.numCol}>{item.invoiceQty} {item.unit ?? ''}</td>
                  <td className={styles.numCol} style={{ color:'var(--c-success)', fontWeight:600 }}>
                    {item.currentStock} {item.unit ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Missing items ─────────────────────────────────── */}
      {missingItems.length > 0 && (
        <div className={styles.stockSection}>
          <div className={styles.stockSectionTitle}>
            <span className={`${styles.stockBadge} ${styles.stockOut}`}>✗ Needs Restocking</span>
            <span className={styles.stockSectionCount}>{missingItems.length} item{missingItems.length !== 1 ? 's' : ''}</span>
          </div>
          <table className={styles.stockTable}>
            <thead>
              <tr>
                <th>Item</th>
                <th className={styles.numCol}>Invoice Qty</th>
                <th className={styles.numCol}>In Stock</th>
                <th className={styles.numCol}>Shortfall</th>
                <th>PO Status</th>
              </tr>
            </thead>
            <tbody>
              {missingItems.map(item => (
                <tr key={item.invoiceItemId} className={styles.stockMissingRow}>
                  <td>
                    <div className={styles.itemName}>{item.name}</div>
                    {item.hsnCode && <div className={styles.itemDesc}>HSN: {item.hsnCode}</div>}
                    {item.stockStatus === 'no_inventory' && (
                      <div className={styles.itemDesc} style={{ color:'var(--c-tertiary)' }}>No inventory record</div>
                    )}
                  </td>
                  <td className={styles.numCol}>{item.invoiceQty} {item.unit ?? ''}</td>
                  <td className={styles.numCol} style={{ color: item.currentStock === 0 ? 'var(--c-danger)' : 'var(--c-warning)' }}>
                    {item.itemId ? item.currentStock : '—'}
                  </td>
                  <td className={styles.numCol} style={{ color:'var(--c-danger)', fontWeight:600 }}>
                    {item.shortfall > 0 ? `+${item.shortfall}` : '—'}
                  </td>
                  <td>
                    {item.existingPoId ? (
                      <Link href={`/purchase-orders/${item.existingPoId}` as Route} className={styles.poLink}>
                        {item.existingPoNo} · {item.existingPoStatus}
                      </Link>
                    ) : (
                      <span className={styles.noPo}>No PO raised</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────── */}
      <div className={styles.stockActions}>
        {canDispatch && (
          <button className={styles.btnPrimary} onClick={() => onProceed(false)} type="button">
            <Icon name="file-plus" size={14} /> Create Delivery Challan
          </button>
        )}

        {!canDispatch && canPartial && (
          <button className={styles.btnSecondary} onClick={() => onProceed(true)} type="button">
            <Icon name="file-plus" size={14} /> Partial Challan (In-Stock Items Only)
          </button>
        )}

        {missingItems.length > 0 && canCreatePo && (
          <Link
            href={`/purchase-orders/new?invoiceId=${result.invoiceId}&missingOnly=1` as Route}
            className={styles.btnWarning}
          >
            <Icon name="shopping-cart" size={14} />
            {hasExistingPo ? 'View / Update Purchase Order' : 'Create PO for Missing Items'}
          </Link>
        )}

        {missingItems.some(i => i.existingPoId) && (
          <div className={styles.poHint}>
            <Icon name="info-circle" size={13} />
            A purchase order is in progress for some items. Once all items are received (GRN complete), stock will be updated and you can generate the full challan.
          </div>
        )}
      </div>
    </div>
  )
}
