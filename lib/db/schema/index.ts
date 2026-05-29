/**
 * Schema barrel — re-exports every table/enum so `import * as schema` in
 * lib/db/index.ts and drizzle-kit see the full set. Future modules add their
 * own files here (inventory.ts, customers.ts, quotes.ts, …).
 */
export * from './enums'
export * from './identity'
export * from './inventory'
