import Link from 'next/link'
import type { Route } from 'next'
import { SO_STATUS_LABELS } from '@/validations/sales-order'

interface LinkedSo { id: string; soNo: string; status: string }

interface Props {
  quoteId:  string
  linkedSo: LinkedSo | null
}

export function QuoteAcceptedSoBanner({ quoteId, linkedSo }: Props) {
  if (linkedSo) {
    return (
      <Link
        href={`/orders/${linkedSo.id}` as Route}
        style={{
          display:       'inline-flex',
          alignItems:    'center',
          gap:           6,
          padding:       '4px 12px',
          background:    'var(--c-success-bg, #ecfdf5)',
          color:         'var(--c-success, #065f46)',
          border:        '1px solid var(--c-success, #065f46)',
          borderRadius:  4,
          fontSize:      12,
          fontWeight:    600,
          whiteSpace:    'nowrap',
          textDecoration:'none',
          flexShrink:    0,
        }}
      >
        Sales Order: {linkedSo.soNo}
        <span style={{ opacity: 0.7, fontWeight: 400 }}>({SO_STATUS_LABELS[linkedSo.status] ?? linkedSo.status})</span>
        →
      </Link>
    )
  }

  return (
    <Link
      href={`/orders/new?quoteId=${quoteId}` as Route}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           6,
        padding:       '4px 14px',
        background:    '#1d4ed8',
        color:         '#fff',
        border:        'none',
        borderRadius:  4,
        fontSize:      12,
        fontWeight:    600,
        whiteSpace:    'nowrap',
        flexShrink:    0,
        textDecoration:'none',
      }}
    >
      + Create Sales Order
    </Link>
  )
}
