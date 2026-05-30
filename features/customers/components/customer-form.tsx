'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import {
  customerSchema,
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  PAYMENT_TERMS,
  PAYMENT_TERMS_LABELS,
  CUSTOMER_STATUSES,
  type CustomerInput,
} from '@/validations/customer'
import { createCustomer, updateCustomer } from '../server/actions'
import styles from './customers.module.scss'

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
]

const INDUSTRIES = [
  'Construction','Real Estate','Interior Design','Architecture','Hospitality',
  'Healthcare','Retail','Manufacturing','Government','IT / Technology','Other',
]

interface Props {
  mode: 'create' | 'edit'
  customerId?: string
  defaultValues?: Partial<CustomerInput>
  onSuccess?: (id: string) => void
}

export function CustomerForm({ mode, customerId, defaultValues, onSuccess }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      type:          'retail',
      status:        'active',
      paymentTerms:  'net_30',
      creditLimit:   0,
      postSaleDiscount: 0,
      sameAsBilling: false,
      ...defaultValues,
    },
  })

  const sameAsBilling = watch('sameAsBilling')

  async function onSubmit(data: CustomerInput) {
    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createCustomer(data)
          : await updateCustomer(customerId!, data)

      if (!result.ok) {
        if (result.error.fieldErrors) {
          Object.entries(result.error.fieldErrors).forEach(([field, msgs]) => {
            setError(field as keyof CustomerInput, { message: msgs[0] })
          })
        }
        setError('root', { message: result.error.message })
        return
      }

      if (onSuccess) {
        onSuccess(result.data.id)
      } else {
        router.push(`/customers/${result.data?.id ?? customerId}`)
        router.refresh()
      }
    })
  }

  const F = ({ name, label, required, type = 'text', placeholder = '' }: {
    name: keyof CustomerInput
    label: string
    required?: boolean
    type?: string
    placeholder?: string
  }) => (
    <div>
      <label className={styles.fieldLabel}>
        {label}
        {required && <span className={styles.fieldRequired}>*</span>}
      </label>
      <input
        type={type}
        className={styles.fieldInput}
        placeholder={placeholder}
        aria-invalid={errors[name] ? 'true' : undefined}
        {...register(name)}
      />
      {errors[name] && (
        <div className={styles.fieldError}>{errors[name]?.message as string}</div>
      )}
    </div>
  )

  const Sel = ({ name, label, options }: {
    name: keyof CustomerInput
    label: string
    options: { value: string; label: string }[]
  }) => (
    <div>
      <label className={styles.fieldLabel}>{label}</label>
      <select className={styles.fieldSelect} {...register(name)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {errors[name] && (
        <div className={styles.fieldError}>{errors[name]?.message as string}</div>
      )}
    </div>
  )

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>

      {errors.root && (
        <div style={{
          background: 'var(--color-danger-bg)', color: 'var(--color-danger-fg)',
          border: '1px solid var(--color-danger-fg)', borderLeft: '3px solid var(--color-danger-fg)',
          padding: '10px 14px', fontFamily: 'var(--font-body)', fontSize: 'var(--fs-300)',
        }}>
          {errors.root.message}
        </div>
      )}

      {/* ── Basic Information ───────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Basic Information</span>
        </div>
        <div className={styles.formSection}>
          <div className={styles.formSpanFull}>
            <label className={styles.fieldLabel}>
              Company Name <span className={styles.fieldRequired}>*</span>
            </label>
            <input
              type="text"
              className={styles.fieldInput}
              placeholder="Enter full company name"
              style={{ fontSize: 'var(--fs-500)' }}
              aria-invalid={errors.name ? 'true' : undefined}
              {...register('name')}
            />
            {errors.name && <div className={styles.fieldError}>{errors.name.message}</div>}
          </div>

          <div className={styles.formGrid2}>
            <F name="contactPerson" label="Contact Person" placeholder="Primary contact name" />
            <F name="phone"         label="Phone"          placeholder="+91 98200 00000" />
            <F name="email"         label="Email"          type="email" placeholder="accounts@company.com" />
            <F name="website"       label="Website"        placeholder="https://company.com" />
          </div>

          <div className={styles.formGrid3}>
            <Sel name="type" label="Customer Type"
              options={CUSTOMER_TYPES.map((t) => ({ value: t, label: CUSTOMER_TYPE_LABELS[t] }))}
            />
            <div>
              <label className={styles.fieldLabel}>Industry</label>
              <select className={styles.fieldSelect} {...register('industry')}>
                <option value="">Select industry</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <Sel name="status" label="Status"
              options={CUSTOMER_STATUSES.map((s) => ({
                value: s,
                label: s.charAt(0).toUpperCase() + s.slice(1),
              }))}
            />
          </div>
        </div>
      </div>

      {/* ── Tax & Compliance ────────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Tax &amp; Compliance</span>
        </div>
        <div className={styles.formGrid2}>
          <F name="gstin" label="GSTIN" placeholder="27AABCW1234A1Z5" />
          <F name="pan"   label="PAN"   placeholder="AABCW1234A" />
        </div>
      </div>

      {/* ── Financial Terms ─────────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Financial Terms</span>
        </div>
        <div className={styles.formGrid3}>
          <Sel name="paymentTerms" label="Payment Terms"
            options={PAYMENT_TERMS.map((t) => ({ value: t, label: PAYMENT_TERMS_LABELS[t] }))}
          />
          <F name="creditLimit"      label="Credit Limit (₹)" type="number" placeholder="0" />
          <F name="postSaleDiscount" label="Post-Sale Discount (₹)" type="number" placeholder="0" />
        </div>
      </div>

      {/* ── Billing Address ──────────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Billing Address</span>
        </div>
        <div className={styles.formSection}>
          <F name="billingName"    label="Billing Name"    placeholder="Legal entity name for billing" />
          <div>
            <label className={styles.fieldLabel}>Billing Address</label>
            <textarea
              className={styles.fieldTextarea}
              placeholder="Full billing address"
              rows={3}
              {...register('billingAddress')}
            />
          </div>
        </div>
      </div>

      {/* ── Delivery Address ─────────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Delivery Address</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" {...register('sameAsBilling')} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-300)', color: 'var(--color-text-muted)' }}>
              Same as billing
            </span>
          </label>
        </div>
        {!sameAsBilling && (
          <div className={styles.formSection}>
            <F name="deliveryName"    label="Delivery Name"    placeholder="Name at delivery site" />
            <div>
              <label className={styles.fieldLabel}>Delivery Address</label>
              <textarea
                className={styles.fieldTextarea}
                placeholder="Full delivery / site address"
                rows={3}
                {...register('deliveryAddress')}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Notes ───────────────────────────────────────────────────── */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>Internal Notes</span>
        </div>
        <div>
          <textarea
            className={styles.fieldTextarea}
            placeholder="Private notes about this customer (not shown on documents)…"
            rows={3}
            {...register('notes')}
          />
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className={styles.formActions}>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          style={{
            background: 'transparent',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border-mid)',
            padding: '8px 18px',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-200)',
            letterSpacing: '0.30em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            border: '1px solid var(--color-primary)',
            padding: '8px 20px',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--fs-200)',
            letterSpacing: '0.40em',
            textTransform: 'uppercase',
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? 'Saving…' : mode === 'create' ? 'Create Customer →' : 'Save Changes →'}
        </button>
      </div>
    </form>
  )
}
