import { z } from "zod";

// ─── Constants ───────────────────────────────────────────────────────────────

export const PAGE_SIZE = 20;

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  revised: "Revised",
  cancelled: "Cancelled",
};

export const GST_MODE_LABELS: Record<string, string> = {
  add: "Add GST",
  inclusive: "GST Inclusive",
  none: "No GST",
};

// ─── Enums ───────────────────────────────────────────────────────────────────

export const QuoteStatus = z.enum([
  "draft",
  "sent",
  "accepted",
  "revised",
  "cancelled",
]);

export const GstMode = z.enum(["add", "inclusive", "none"]);

export const TermCategory = z.enum([
  "delivery",
  "gst",
  "payment",
  "warranty",
  "installation",
  "exclusion",
  "other",
]);

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

export const termSchema = z.object({
  category: TermCategory,
  text: z.string().min(1),
});

export const quoteItemSchema = z.object({
  itemId: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  brand: z.string().optional(),
  unit: z.string().optional(),
  rate: z.number().min(0),
  qty: z.number().min(0).default(1),
  discountPct: z.number().min(0).max(100).default(0),
});

export const quoteLocationSchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().default(0),
  isIncluded: z.boolean().default(true),
  installationCharge: z.number().default(0),
  // When set, installation_charge is derived as this % of the location's
  // material subtotal. null/undefined → flat amount entered directly.
  installationPct: z.number().min(0).max(100).nullable().optional(),
  installationNote: z.string().optional(),
});

// ─── Main Quote Schema ────────────────────────────────────────────────────────

export const quoteSchema = z.object({
  customerId: z
    .union([z.string().uuid(), z.literal("")])
    .optional(),
  subject: z.string().optional(),
  date: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
  status: QuoteStatus,
  gstMode: GstMode,
  gstPct: z.number().min(0).max(100).default(18),
  transport: z.number().default(0),
  transportNote: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")).transform((v) => v === "" ? undefined : v),
  includeBoqSummary: z.boolean().default(true),
  notes: z.string().optional(),
  terms: z.array(termSchema),
});

// ─── Quote Filter Schema ──────────────────────────────────────────────────────

export const quoteFilterSchema = z.object({
  q: z.string().optional(),
  status: z
    .enum(["all", "draft", "sent", "accepted", "revised", "cancelled"])
    .default("all"),
  customerId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(["date", "grand_total", "quote_no"]).default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// ─── Exported Types ───────────────────────────────────────────────────────────

export type QuoteInput = z.infer<typeof quoteSchema>;
export type QuoteFilter = z.infer<typeof quoteFilterSchema>;
export type QuoteItemInput = z.infer<typeof quoteItemSchema>;
export type QuoteLocationInput = z.infer<typeof quoteLocationSchema>;
export type TermInput = z.infer<typeof termSchema>;
