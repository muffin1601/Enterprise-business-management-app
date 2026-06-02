'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { vendorBankAccountSchema, ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type VendorBankAccountInput } from '@/validations/vendor'
import { addVendorBankAccount, updateVendorBankAccount, deleteVendorBankAccount } from '../server/actions'
import type { VendorBankAccount } from '../server/queries'
import { Icon } from '@/components/ui'
import styles from './vendors.module.scss'

function BankModal({ vendorId, bank, onClose }: {
  vendorId: string; bank?: VendorBankAccount; onClose: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const { register, handleSubmit, setError, formState: { errors } } = useForm<VendorBankAccountInput>({
    resolver: zodResolver(vendorBankAccountSchema),
    defaultValues: bank
      ? { accountName: bank.accountName, accountNo: bank.accountNo, bankName: bank.bankName,
          branch: bank.branch ?? '', ifscCode: bank.ifscCode, accountType: bank.accountType as 'savings' | 'current' | 'cc' | 'od',
          isPrimary: bank.isPrimary }
      : { accountType: 'current', isPrimary: false },
  })

  async function onSubmit(data: VendorBankAccountInput) {
    start(async () => {
      const result = bank
        ? await updateVendorBankAccount(bank.id, vendorId, data)
        : await addVendorBankAccount(vendorId, data)
      if (!result.ok) { setError('root', { message: result.error.message }); return }
      router.refresh(); onClose()
    })
  }

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{bank ? 'Edit Bank Account' : 'Add Bank Account'}</span>
          <button className={styles.modalClose} onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className={styles.modalBody}>
          {errors.root && <div className={styles.fieldError} style={{ marginBottom: 12 }}>{errors.root.message}</div>}
          <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className={styles.fieldLabel}>Account Holder Name <span className={styles.fieldRequired}>*</span></label>
              <input className={styles.fieldInput} placeholder="As per bank records" {...register('accountName')} />
              {errors.accountName && <div className={styles.fieldError}>{errors.accountName.message}</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className={styles.fieldLabel}>Account Number <span className={styles.fieldRequired}>*</span></label>
                <input className={styles.fieldInput} placeholder="000123456789" {...register('accountNo')} />
                {errors.accountNo && <div className={styles.fieldError}>{errors.accountNo.message}</div>}
              </div>
              <div>
                <label className={styles.fieldLabel}>Account Type</label>
                <select className={styles.fieldSelect} {...register('accountType')}>
                  {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className={styles.fieldLabel}>Bank Name <span className={styles.fieldRequired}>*</span></label>
                <input className={styles.fieldInput} placeholder="e.g. HDFC Bank" {...register('bankName')} />
                {errors.bankName && <div className={styles.fieldError}>{errors.bankName.message}</div>}
              </div>
              <div>
                <label className={styles.fieldLabel}>Branch</label>
                <input className={styles.fieldInput} placeholder="e.g. Connaught Place" {...register('branch')} />
              </div>
              <div>
                <label className={styles.fieldLabel}>IFSC Code <span className={styles.fieldRequired}>*</span></label>
                <input className={styles.fieldInput} placeholder="HDFC0001234" {...register('ifscCode')} />
                {errors.ifscCode && <div className={styles.fieldError}>{errors.ifscCode.message}</div>}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13 }}>
              <input type="checkbox" {...register('isPrimary')} /> Set as primary bank account
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--c-border)' }}>
              <button type="button" className={styles.btnOutline} onClick={onClose}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={pending}>
                {pending ? 'Saving…' : bank ? 'Save Changes' : 'Add Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export function BankAccountsSection({ vendorId, bankAccounts, canEdit }: {
  vendorId: string; bankAccounts: VendorBankAccount[]; canEdit: boolean
}) {
  const router = useRouter()
  const [modal, setModal] = useState<'new' | VendorBankAccount | null>(null)
  const [, start] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remove bank account "${name}"?`)) return
    start(async () => { await deleteVendorBankAccount(id, vendorId); router.refresh() })
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => alert(`${label} copied!`))
  }

  return (
    <div>
      {modal && <BankModal vendorId={vendorId} bank={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />}

      {bankAccounts.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="building-bank" className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>No bank accounts yet</div>
          <div className={styles.emptyBody}>Add bank accounts for payment processing</div>
        </div>
      ) : (
        <div className={styles.bankList}>
          {bankAccounts.map(b => (
            <div key={b.id} className={`${styles.bankCard} ${b.isPrimary ? styles.bankCardPrimary : ''}`}>
              <div className={styles.bankHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="building-bank" size={16} />
                  <span className={styles.bankName}>{b.bankName}</span>
                  {b.isPrimary && <span className={styles.primaryBadge}>Primary</span>}
                  <span className={styles.accountTypeBadge}>{ACCOUNT_TYPE_LABELS[b.accountType as keyof typeof ACCOUNT_TYPE_LABELS] ?? b.accountType}</span>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className={styles.iconBtn} title="Edit" onClick={() => setModal(b)}><Icon name="pencil" /></button>
                    <button className={styles.iconBtn} title="Remove" onClick={() => handleDelete(b.id, b.bankName)}><Icon name="trash" /></button>
                  </div>
                )}
              </div>
              <div className={styles.bankDetails}>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Account Name</span>
                  <span className={styles.bankValue}>{b.accountName}</span>
                </div>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Account No.</span>
                  <span className={styles.bankValue} style={{ fontFamily: 'var(--font-mono)' }}>
                    {b.accountNo}
                    <button className={styles.copyBtn} onClick={() => copyToClipboard(b.accountNo, 'Account number')} title="Copy"><Icon name="copy" size={12} /></button>
                  </span>
                </div>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>IFSC Code</span>
                  <span className={styles.bankValue} style={{ fontFamily: 'var(--font-mono)' }}>
                    {b.ifscCode}
                    <button className={styles.copyBtn} onClick={() => copyToClipboard(b.ifscCode, 'IFSC code')} title="Copy"><Icon name="copy" size={12} /></button>
                  </span>
                </div>
                {b.branch && (
                  <div className={styles.bankRow}>
                    <span className={styles.bankLabel}>Branch</span>
                    <span className={styles.bankValue}>{b.branch}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <button className={styles.addRow} style={{ marginTop: 10 }} onClick={() => setModal('new')}>
          <Icon name="circle-plus" /> Add Bank Account
        </button>
      )}
    </div>
  )
}
