'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { validateRunningInvoiceAction } from '../server/actions'
import { Icon } from '@/components/ui'
import styles from './running-invoices.module.scss'

interface Props { riId: string; status: string; canEdit: boolean }

export function RiValidationTab({ riId, status, canEdit }: Props) {
  const router    = useRouter()
  const [, startT] = useTransition()
  const [result, setResult] = useState<{ valid: boolean; failures: string[] } | null>(null)
  const [running, setRunning] = useState(false)

  function handleValidate() {
    setRunning(true)
    startT(async () => {
      const res = await validateRunningInvoiceAction(riId)
      setRunning(false)
      if (res.ok) { setResult(res.data); router.refresh() }
      else setResult({ valid: false, failures: [res.error?.message ?? 'Validation failed.'] })
    })
  }

  if (status === 'posted' || status === 'sent') {
    return (
      <div className={styles.validationPassed}>
        <Icon name="circle-check" size={24} />
        <div>
          <div className={styles.validationPassedTitle}>Invoice Posted</div>
          <div className={styles.validationPassedSub}>All validations passed. Invoice is committed to ledger.</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.validationTab}>
      <div className={styles.validationInfo}>
        <div className={styles.validationInfoTitle}>Pre-Posting Checks</div>
        <div className={styles.validationInfoSub}>
          Run validation before posting to catch issues early. Posting is the commit point — it updates inventory and financial records.
        </div>
      </div>

      <div className={styles.validationChecks}>
        <div className={styles.checkItem}>
          <Icon name="check-circle" size={14} style={{ color:'var(--c-success)' }} />
          <span>At least one billable item with qty &gt; 0</span>
        </div>
        <div className={styles.checkItem}>
          <Icon name="check-circle" size={14} style={{ color:'var(--c-success)' }} />
          <span>All billable items have unit prices from Sales Order</span>
        </div>
        <div className={styles.checkItem}>
          <Icon name="check-circle" size={14} style={{ color:'var(--c-success)' }} />
          <span>Grand total is greater than zero</span>
        </div>
        <div className={styles.checkItem}>
          <Icon name="check-circle" size={14} style={{ color:'var(--c-success)' }} />
          <span>At least one delivery challan selected</span>
        </div>
        <div className={styles.checkItem}>
          <Icon name="check-circle" size={14} style={{ color:'var(--c-success)' }} />
          <span>No challan already invoiced in another posting</span>
        </div>
      </div>

      {result && (
        <div className={`${styles.validationResult} ${result.valid ? styles.validationOk : styles.validationFail}`}>
          {result.valid ? (
            <><Icon name="circle-check" size={18} /> All checks passed. Invoice status set to Validated.</>
          ) : (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <Icon name="circle-x" size={18} /> <strong>{result.failures.length} check{result.failures.length !== 1 ? 's' : ''} failed</strong>
              </div>
              <ul style={{ margin:0, paddingLeft:20 }}>
                {result.failures.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {canEdit && ['draft','validated'].includes(status) && (
        <button className={styles.btnPrimary} onClick={handleValidate} disabled={running} type="button">
          {running ? 'Checking…' : status === 'validated' ? 'Re-validate' : 'Run Validation'}
        </button>
      )}
    </div>
  )
}
