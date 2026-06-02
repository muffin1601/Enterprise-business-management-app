import { Icon } from '@/components/ui'
import styles from './vendors.module.scss'

// Placeholder for future Purchase Orders module integration
export function PurchaseOrdersTab({ vendorId }: { vendorId: string }) {
  return (
    <div className={styles.empty}>
      <Icon name="shopping-cart" className={styles.emptyIcon} />
      <div className={styles.emptyTitle}>Purchase Orders</div>
      <div className={styles.emptyBody}>
        Purchase orders for this vendor will appear here once the Procurement module is active.
      </div>
    </div>
  )
}
