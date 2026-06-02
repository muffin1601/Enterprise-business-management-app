'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { vendorContactSchema, type VendorContactInput } from '@/validations/vendor'
import { addVendorContact, updateVendorContact, deleteVendorContact } from '../server/actions'
import type { VendorContact } from '../server/queries'
import { Icon } from '@/components/ui'
import styles from './vendors.module.scss'

function ContactModal({ vendorId, contact, onClose }: {
  vendorId: string; contact?: VendorContact; onClose: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const { register, handleSubmit, setError, formState: { errors } } = useForm<VendorContactInput>({
    resolver: zodResolver(vendorContactSchema),
    defaultValues: contact
      ? { name: contact.name, designation: contact.designation ?? '', email: contact.email ?? '',
          phone: contact.phone ?? '', department: contact.department ?? '', isPrimary: contact.isPrimary }
      : { isPrimary: false },
  })

  async function onSubmit(data: VendorContactInput) {
    start(async () => {
      const result = contact
        ? await updateVendorContact(contact.id, vendorId, data)
        : await addVendorContact(vendorId, data)
      if (!result.ok) { setError('root', { message: result.error.message }); return }
      router.refresh(); onClose()
    })
  }

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{contact ? 'Edit Contact' : 'Add Contact'}</span>
          <button className={styles.modalClose} onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className={styles.modalBody}>
          {errors.root && <div className={styles.fieldError} style={{ marginBottom: 12 }}>{errors.root.message}</div>}
          <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className={styles.fieldLabel}>Name <span className={styles.fieldRequired}>*</span></label>
              <input className={styles.fieldInput} placeholder="Contact name" {...register('name')} />
              {errors.name && <div className={styles.fieldError}>{errors.name.message}</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className={styles.fieldLabel}>Designation</label>
                <input className={styles.fieldInput} placeholder="e.g. Sales Manager" {...register('designation')} />
              </div>
              <div>
                <label className={styles.fieldLabel}>Department</label>
                <input className={styles.fieldInput} placeholder="e.g. Sales" {...register('department')} />
              </div>
              <div>
                <label className={styles.fieldLabel}>Email</label>
                <input className={styles.fieldInput} type="email" placeholder="email@vendor.com" {...register('email')} />
                {errors.email && <div className={styles.fieldError}>{errors.email.message}</div>}
              </div>
              <div>
                <label className={styles.fieldLabel}>Phone</label>
                <input className={styles.fieldInput} placeholder="+91 98200 00000" {...register('phone')} />
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13 }}>
              <input type="checkbox" {...register('isPrimary')} /> Mark as primary contact
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 10, borderTop: '1px solid var(--c-border)' }}>
              <button type="button" className={styles.btnOutline} onClick={onClose}>Cancel</button>
              <button type="submit" className={styles.btnPrimary} disabled={pending}>
                {pending ? 'Saving…' : contact ? 'Save Changes' : 'Add Contact'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export function ContactsSection({ vendorId, contacts, canEdit }: {
  vendorId: string; contacts: VendorContact[]; canEdit: boolean
}) {
  const router = useRouter()
  const [modal, setModal] = useState<'new' | VendorContact | null>(null)
  const [, start] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remove contact "${name}"?`)) return
    start(async () => { await deleteVendorContact(id, vendorId); router.refresh() })
  }

  return (
    <div>
      {modal && <ContactModal vendorId={vendorId} contact={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />}

      {contacts.length === 0 ? (
        <div className={styles.empty}>
          <Icon name="users" className={styles.emptyIcon} />
          <div className={styles.emptyTitle}>No contacts yet</div>
          <div className={styles.emptyBody}>Add contacts for this vendor</div>
        </div>
      ) : (
        <div className={styles.contactList}>
          {contacts.map(c => (
            <div key={c.id} className={styles.contactCard}>
              <div className={styles.contactMain}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className={styles.contactName}>{c.name}</span>
                  {c.isPrimary && <span className={styles.primaryBadge}>Primary</span>}
                </div>
                {c.designation && <div className={styles.contactDesig}>{c.designation}{c.department ? ` · ${c.department}` : ''}</div>}
                <div className={styles.contactMeta}>
                  {c.phone && <span className={styles.contactMetaItem}><Icon name="phone" />{c.phone}</span>}
                  {c.email && <span className={styles.contactMetaItem}><Icon name="mail" />{c.email}</span>}
                </div>
              </div>
              {canEdit && (
                <div className={styles.contactActions}>
                  <button className={styles.iconBtn} title="Edit" onClick={() => setModal(c)}><Icon name="pencil" /></button>
                  <button className={styles.iconBtn} title="Remove" onClick={() => handleDelete(c.id, c.name)}><Icon name="trash" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <button className={styles.addRow} style={{ marginTop: 10 }} onClick={() => setModal('new')}>
          <Icon name="user-plus" /> Add Contact
        </button>
      )}
    </div>
  )
}
