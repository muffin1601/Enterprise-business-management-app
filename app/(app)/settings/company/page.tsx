import { getActionContext } from '@/lib/auth/action-context'
import {
  getActiveOrganization,
  getActiveOrganizationSettings,
} from '@/features/company/server/queries'
import { OrganizationProfileForm } from '@/features/company/components/organization-profile-form'
import { OrganizationSettingsForm } from '@/features/company/components/organization-settings-form'
import styles from './page.module.scss'

export const metadata = { title: 'Company settings · Watcon' }

export default async function CompanySettingsPage() {
  const [ctx, org, settings] = await Promise.all([
    getActionContext(),
    getActiveOrganization(),
    getActiveOrganizationSettings(),
  ])

  const canEditProfile = ctx.isOwner || ctx.isSuperAdmin
  const canEditSettings = ctx.has('settings.manage')

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>Company Settings</div>
          <div className={styles.subtitle}>Profile, GST, and financial-year configuration.</div>
        </div>
      </header>

      <div className={styles.grid}>
        <OrganizationProfileForm
          canEdit={canEditProfile}
          defaultValues={{
            name: org?.name ?? '',
            legalName: org?.legalName ?? '',
            gstin: org?.gstin ?? '',
            pan: org?.pan ?? '',
            address: org?.address ?? '',
          }}
        />
        <OrganizationSettingsForm
          canEdit={canEditSettings}
          defaultValues={{
            financialYearStart: settings?.financialYearStart ?? 4,
            defaultGstPct: settings?.defaultGstPct ?? 18,
            placeOfSupply: settings?.placeOfSupply ?? '',
          }}
        />
      </div>
    </main>
  )
}
