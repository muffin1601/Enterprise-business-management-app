import { z } from 'zod'

// ─── Custom role ──────────────────────────────────────────────────────────────

export const customRoleSchema = z.object({
  key:         z.string().min(2).max(50).regex(/^[a-z_]+$/, 'Only lowercase letters and underscores'),
  name:        z.string().min(1).max(60),
  description: z.string().max(200).optional(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex colour').optional(),
})

export const updateCustomRoleSchema = z.object({
  name:        z.string().min(1).max(60).optional(),
  description: z.string().max(200).optional(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

// ─── Role permissions ─────────────────────────────────────────────────────────

export const setRolePermissionsSchema = z.object({
  roleId:      z.string().uuid(),
  permKeys:    z.array(z.string()).max(200),
})

// ─── Member profile ───────────────────────────────────────────────────────────

export const updateMemberProfileSchema = z.object({
  fullName:   z.string().min(1).max(100).optional(),
  jobTitle:   z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  phone:      z.string().max(20).optional(),
})

// ─── Bulk invite ──────────────────────────────────────────────────────────────

export const bulkInviteSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(20, 'Max 20 emails at once'),
  roleId: z.string().uuid(),
})

// ─── Resend invite ────────────────────────────────────────────────────────────

export const resendInviteSchema = z.object({ id: z.string().uuid() })

// ─── Permission module groupings (display only) ───────────────────────────────

export const PERMISSION_MODULES: Record<string, string[]> = {
  Sales: [
    'quotes.view','quotes.create','quotes.edit','quotes.revise','quotes.delete','quotes.export',
    'customers.view','customers.create','customers.edit','customers.delete',
    'sales_orders.view','sales_orders.create','sales_orders.edit','sales_orders.delete',
    'invoices.view','invoices.create','invoices.edit','invoices.issue','invoices.delete',
  ],
  Procurement: [
    'purchase_orders.view','purchase_orders.create','purchase_orders.edit',
    'purchase_orders.approve','purchase_orders.delete','purchase_orders.receive',
    'vendors.view','vendors.create','vendors.edit','vendors.delete',
  ],
  Logistics: [
    'challans.view','challans.create','challans.edit','challans.post','challans.delete',
  ],
  Inventory: [
    'items.view','items.create','items.edit','items.delete',
    'stock.adjust','pricing.override',
    'stock_report.view','stock_report.export',
  ],
  Finance: [
    'payments.view','payments.record','payments.delete',
    'discount.post_sale','discount.approve',
    'finance.view','finance.manage',
    'expenses.create','expenses.approve',
    'payroll.view','payroll.manage',
  ],
  Reports: [
    'reports.sales.view','reports.inventory.view','reports.financial.view',
    'reports.hr.view','reports.export',
    'running_bill.view',
  ],
  HR: ['hr.view','hr.manage','leave.approve'],
  Administration: [
    'admin.users','admin.roles','admin.audit','settings.manage',
    'org.manage','system.config',
    'dashboard.view',
  ],
}

export type CustomRoleInput         = z.infer<typeof customRoleSchema>
export type UpdateCustomRoleInput   = z.infer<typeof updateCustomRoleSchema>
export type SetRolePermissionsInput = z.infer<typeof setRolePermissionsSchema>
export type UpdateMemberProfileInput= z.infer<typeof updateMemberProfileSchema>
export type BulkInviteInput         = z.infer<typeof bulkInviteSchema>
