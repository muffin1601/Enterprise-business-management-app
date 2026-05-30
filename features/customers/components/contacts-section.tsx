'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { contactSchema, type ContactInput } from '@/validations/customer'
import { addContact, updateContact, deleteContact } from '../server/actions'
import type { CustomerContact } from '../server/queries'
import styles from './customers.module.scss'

interface Props {
  customerId: string
  contacts: CustomerContact[]
  canEdit: boolean
}

function ContactModal({
  customerId,
  contact,
  onClose,
}: {
  customerId: string
  contact?: CustomerContact
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const { register, handleSubmit, setError, formState: { errors } } =
    useForm<ContactInput>({
      resolver: zodResolver(contactSchema),
      defaultValues: contact
        ? {
            name:        contact.name,
            designation: contact.designation ?? '',
            email:       contact.email ?? '',
            phone:       contact.phone ?? '',
            isPrimary:   contact.isPrimary,
          }
        : { isPrimary: false },
    })

  async function onSubmit(data: ContactInput) {
    start(async () => {
      const result = contact
        ? await updateContact(contact.id, customerId, data)
        : await addContact(customerId, data)

      if (!result.ok) {
        setError('root', { message: result.error.message })
        return
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            {contact ? 'Edit Contact' : 'Add Contact'}
          </span>
          <button className={styles.modalClose} onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div className={styles.modalBody}>
          {errors.root && (
            <div style={{ color: 'var(--color-danger-fg)', fontSize: 'var(--fs-300)', marginBottom: 12 }}>
              {errors.root.message}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className={styles.fieldLabel}>Name <span className={styles.fieldRequired}>*</span></label>
                <input className={styles.fieldInput} placeholder="Contact name" {...register('name')} />
                {errors.name && <div className={styles.fieldError}>{errors.name.message}</div>}
              </div>

              <div>
                <label className={styles.fieldLabel}>Designation</label>
                <input className={styles.fieldInput} placeholder="e.g. Purchase Manager" {...register('designation')} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label className={styles.fieldLabel}>Email</label>
                  <input className={styles.fieldInput} type="email" placeholder="email@co.in" {...register('email')} />
                  {errors.email && <div className={styles.fieldError}>{errors.email.message}</div>}
                </div>
                <div>
                  <label className={styles.fieldLabel}>Phone</label>
                  <input className={styles.fieldInput} placeholder="+91 98200 00000" {...register('phone')} />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" {...register('isPrimary')} />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-300)', color: 'var(--color-text-muted)' }}>
                  Mark as primary contact
                </span>
              </label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 10, borderTop: 'var(--border-panel)' }}>
                <button type="button" onClick={onClose} style={ghostBtnStyle}>Cancel</button>
                <button type="submit" disabled={pending} style={primaryBtnStyle(pending)}>
                  {pending ? 'Saving…' : contact ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export function ContactsSection({ customerId, contacts, canEdit }: Props) {
  const router = useRouter()
  const [modal, setModal] = useState<'new' | CustomerContact | null>(null)
  const [pending, start] = useTransition()

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remove contact "${name}"?`)) return
    start(async () => {
      await deleteContact(id, customerId)
      router.refresh()
    })
  }

  return (
    <div>
      {modal && (
        <ContactModal
          customerId={customerId}
          contact={modal === 'new' ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}

      {contacts.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><i className="ti ti-users" /></div>
          <div className={styles.emptyTitle}>No contacts yet</div>
          <div className={styles.emptyBody}>Add contacts for this customer</div>
        </div>
      ) : (
        <div className={styles.contactList}>
          {contacts.map((c) => (
            <div key={c.id} className={styles.contactCard}>
              <div className={styles.contactMain}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className={styles.contactName}>{c.name}</span>
                  {c.isPrimary && (
                    <span className={styles.primaryBadge}>Primary</span>
                  )}
                </div>
                {c.designation && (
                  <div className={styles.contactDesig}>{c.designation}</div>
                )}
                <div className={styles.contactMeta}>
                  {c.phone && (
                    <span className={styles.contactMetaItem}>
                      <i className="ti ti-phone" />{c.phone}
                    </span>
                  )}
                  {c.email && (
                    <span className={styles.contactMetaItem}>
                      <i className="ti ti-mail" />{c.email}
                    </span>
                  )}
                </div>
              </div>

              {canEdit && (
                <div className={styles.contactActions}>
                  <IconBtn title="Edit" onClick={() => setModal(c)}>
                    <i className="ti ti-pencil" />
                  </IconBtn>
                  <IconBtn title="Remove" onClick={() => handleDelete(c.id, c.name)}>
                    <i className="ti ti-trash" />
                  </IconBtn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <button className={styles.addRow} style={{ marginTop: 10 }} onClick={() => setModal('new')}>
          <i className="ti ti-user-plus" /> Add Contact
        </button>
      )}
    </div>
  )
}

// ── Shared button styles ───────────────────────────────────────────────────────
function IconBtn({ children, title, onClick }: { children: React.ReactNode; title?: string; onClick?: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--color-text-faint)', fontSize: 15, padding: '3px 5px',
        display: 'flex', alignItems: 'center',
      }}
      onMouseEnter={(e) => { (e.currentTarget.style.color = 'var(--color-text)') }}
      onMouseLeave={(e) => { (e.currentTarget.style.color = 'var(--color-text-faint)') }}
    >
      {children}
    </button>
  )
}

const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent', color: 'var(--color-text-muted)',
  border: '1px solid var(--color-border-mid)', padding: '7px 14px',
  fontFamily: 'var(--font-body)', fontSize: 'var(--fs-200)',
  letterSpacing: '0.28em', textTransform: 'uppercase', cursor: 'pointer',
}

const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  background: 'var(--color-primary)', color: 'var(--color-on-primary)',
  border: '1px solid var(--color-primary)', padding: '8px 18px',
  fontFamily: 'var(--font-body)', fontSize: 'var(--fs-200)',
  letterSpacing: '0.38em', textTransform: 'uppercase',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
})
