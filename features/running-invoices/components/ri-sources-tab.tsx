'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Route } from 'next'
import type { RiDetail } from '../server/queries'
import { removeDcFromRi } from '../server/actions'
import { Icon } from '@/components/ui'
import styles from './running-invoices.module.scss'

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

const fmtNum = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(n)

interface Props { ri: RiDetail; canEdit: boolean }

export function RiSourcesTab({ ri, canEdit }: Props) {
  const router    = useRouter()
  const [, startT] = useTransition()
  const isDraft    = ri.status === 'draft'

  function handleRemove(dcId: string, dcNo: string) {
    if (!confirm(`Remove DC ${dcNo} from this invoice? Its lines will be removed.`)) return
    startT(async () => {
      const res = await removeDcFromRi({ riId: ri.id, dcId })
      if (!res.ok) alert(res.error?.message ?? 'Failed.')
      else router.refresh()
    })
  }

  return (
    <div className={styles.sourcesTab}>
      <div className={styles.sourcesHeader}>
        <div className={styles.sourcesTitle}>Source Delivery Challans</div>
        <div className={styles.sourcesSub}>
          This invoice consolidates {ri.challans.length} delivery challan{ri.challans.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className={styles.challanList}>
        {ri.challans.map(c => (
          <div key={c.id} className={styles.challanRow}>
            <div className={styles.challanInfo}>
              <Link href={`/delivery-challans/${c.dcId}` as Route} className={styles.challanNo}>
                {c.dcNo}
              </Link>
              <span className={styles.challanMeta}>
                Dispatched: {fmtDate(c.dispatchDate)} · {c.itemCount} item{c.itemCount !== 1 ? 's' : ''} · Qty: {fmtNum(c.qtyTotal)}
              </span>
              <span className={`${styles.dcStatusBadge} ${styles[`dc_${c.status}` as keyof typeof styles] ?? ''}`}>
                {c.status}
              </span>
            </div>
            {canEdit && isDraft && ri.challans.length > 1 && (
              <button
                className={styles.removeChallanBtn}
                onClick={() => handleRemove(c.dcId, c.dcNo)}
                title="Remove from this invoice"
                type="button"
              >
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {canEdit && isDraft && (
        <Link
          href={`/running-invoices/${ri.id}/add-challan` as Route}
          className={styles.addChallanBtn}
        >
          <Icon name="plus" size={13} /> Add Another Challan
        </Link>
      )}
    </div>
  )
}
