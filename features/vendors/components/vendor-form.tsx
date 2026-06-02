'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import {
  vendorSchema,
  VENDOR_TYPES, VENDOR_TYPE_LABELS,
  VENDOR_STATUSES, VENDOR_STATUS_LABELS,
  PAYMENT_TERMS, PAYMENT_TERMS_LABELS,
  type VendorInput,
} from '@/validations/vendor'
import { createVendor, updateVendor } from '../server/actions'
import styles from './vendors.module.scss'

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
]

const INDUSTRIES = [
  'Building Materials','Paints & Coatings','Hardware & Fittings','Furniture',
  'Wood Products','Electrical & Automation','Plumbing','HVAC','Glass & Glazing',
  'Flooring','Tiles & Ceramics','Steel & Metal','Construction','Real Estate',
  'Interior Design','Logistics','IT / Technology','Other',
]

interface Props {
  mode:         'create' | 'edit'
  vendorId?:    string
  defaultValues?: Partial<VendorInput>
  onSuccess?:   (id: string) => void
}

export function VendorForm({ mode, vendorId, defaultValues, onSuccess }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const {
    register, handleSubmit, setError, watch,
    formState: { errors, isSubmitting },
  } = useForm<VendorInput>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      type:         'supplier',
      status:       'active',
      paymentTerms: 'net_30',
      creditLimit:  0,
      currency:     'INR',
      country:      'India',
      ...defaultValues,
    },
  })

  async function onSubmit(data: VendorInput) {
    startTransition(async () => {
      const result = mode === 'create'
        ? await createVendor(data)
        : await updateVendor(vendorId!, data)

      if (!result.ok) {
        if (result.error.fieldErrors) {
          Object.entries(result.error.fieldErrors).forEach(([field, msgs]) => {
            setError(field as keyof VendorInput, { message: msgs[0] })
          })
        }
        setError('root', { message: result.error.message })
        return
      }

      if (onSuccess) {
        onSuccess(result.data.id)
      } else {
        router.push(`/vendors/${result.data?.id ?? vendorId}`)
        router.refresh()
      }
    })
  }

  const F = ({ name, label, required, type = 'text', placeholder = '' }: {
    name: keyof VendorInput; label: string; required?: boolean; type?: string; placeholder?: string
  }) => (
    <div>
      <label className={styles.fieldLabel}>
        {label}{required && <span className={styles.fieldRequired}>*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        className={`${styles.fieldInput} ${errors[name] ? styles.fieldInputError : ''}`}
        {...register(name)}
      />
      {errors[name] && <p className={styles.fieldError}>{errors[name]?.message as string}</p>}
    </div>
  )

  const isLoading = isSubmitting || pending

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      {errors.root && (
        <div className={styles.formError}>{errors.root.message}</div>
      )}

      {/* ── Section 1: Identity ─────────────────────────────────────────── */}
      <div className={styles.formSection}>
        <div className={styles.formSectionTitle}>Vendor Information</div>
        <div className={styles.formGrid2}>
          <F name="name" label="Vendor / Company Name" required placeholder="e.g. Kajaria Ceramics Ltd" />
          <div>
            <label className={styles.fieldLabel}>Vendor Type<span className={styles.fieldRequired}>*</span></label>
            <select className={styles.fieldSelect} {...register('type')}>
              {VENDOR_TYPES.map(t => (
                <option key={t} value={t}>{VENDOR_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <F name="contactPerson" label="Primary Contact Person" placeholder="e.g. Rajesh Sharma" />
          <F name="phone" label="Phone" placeholder="+91 98765 43210" />
          <F name="email" label="Email" type="email" placeholder="contact@vendor.com" />
          <F name="website" label="Website" placeholder="https://vendor.com" />
        </div>
      </div>

      {/* ── Section 2: Tax & Compliance ─────────────────────────────────── */}
      <div className={styles.formSection}>
        <div className={styles.formSectionTitle}>Tax &amp; Compliance</div>
        <div className={styles.formGrid3}>
          <F name="gstin" label="GSTIN" placeholder="07AAACK4199N1ZW" />
          <F name="pan" label="PAN" placeholder="AAACK4199N" />
          <F name="msmeNo" label="MSME Registration No." placeholder="UDYAM-XX-00-0000000" />
        </div>
      </div>

      {/* ── Section 3: Address ──────────────────────────────────────────── */}
      <div className={styles.formSection}>
        <div className={styles.formSectionTitle}>Address</div>
        <div className={styles.formGrid2}>
          <div className={styles.formFullCol}>
            <F name="billingAddress" label="Billing Address" placeholder="Street, area, landmark" />
          </div>
          <div className={styles.formFullCol}>
            <F name="shippingAddress" label="Shipping / Dispatch Address" placeholder="Leave blank if same as billing" />
          </div>
          <F name="city" label="City" placeholder="New Delhi" />
          <div>
            <label className={styles.fieldLabel}>State</label>
            <select className={styles.fieldSelect} {...register('state')}>
              <option value="">Select state</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <F name="pincode" label="Pincode" placeholder="110001" />
          <F name="country" label="Country" placeholder="India" />
        </div>
      </div>

      {/* ── Section 4: Commercial Terms ─────────────────────────────────── */}
      <div className={styles.formSection}>
        <div className={styles.formSectionTitle}>Commercial Terms</div>
        <div className={styles.formGrid3}>
          <div>
            <label className={styles.fieldLabel}>Payment Terms</label>
            <select className={styles.fieldSelect} {...register('paymentTerms')}>
              {PAYMENT_TERMS.map(t => (
                <option key={t} value={t}>{PAYMENT_TERMS_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <F name="creditLimit" label="Credit Limit (₹)" type="number" placeholder="0" />
          <F name="currency" label="Currency" placeholder="INR" />
        </div>
      </div>

      {/* ── Section 5: Classification ───────────────────────────────────── */}
      <div className={styles.formSection}>
        <div className={styles.formSectionTitle}>Classification &amp; Status</div>
        <div className={styles.formGrid3}>
          <div>
            <label className={styles.fieldLabel}>Industry</label>
            <select className={styles.fieldSelect} {...register('industry')}>
              <option value="">Select industry</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className={styles.fieldLabel}>Status</label>
            <select className={styles.fieldSelect} {...register('status')}>
              {VENDOR_STATUSES.map(s => (
                <option key={s} value={s}>{VENDOR_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Section 6: Notes ────────────────────────────────────────────── */}
      <div className={styles.formSection}>
        <div className={styles.formSectionTitle}>Internal Notes</div>
        <div>
          <textarea
            className={styles.fieldTextarea}
            rows={4}
            placeholder="Internal notes about this vendor — terms, agreements, preferences..."
            {...register('notes')}
          />
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary} disabled={isLoading}>
          {isLoading ? 'Saving…' : mode === 'create' ? 'Create Vendor' : 'Save Changes'}
        </button>
        <button
          type="button"
          className={styles.btnOutline}
          disabled={isLoading}
          onClick={() => router.back()}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
