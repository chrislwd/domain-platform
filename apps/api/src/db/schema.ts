import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  pgEnum,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const orgRoleEnum = pgEnum('org_role', ['owner', 'finance', 'operator', 'viewer'])
export const platformRoleEnum = pgEnum('platform_role', ['admin', 'risk_reviewer', 'ops'])
export const depositStatusEnum = pgEnum('deposit_status', ['pending', 'confirming', 'completed', 'failed'])
export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'deposit', 'freeze', 'capture', 'release', 'refund', 'adjustment',
])
export const availabilityStatusEnum = pgEnum('availability_status', [
  'available', 'taken', 'reserved', 'error',
])
export const searchSessionStatusEnum = pgEnum('search_session_status', [
  'in_progress', 'complete', 'partial_error',
])
export const orderStatusEnum = pgEnum('order_status', [
  'pending', 'awaiting_review', 'processing', 'completed', 'partial_success', 'failed', 'cancelled',
])
export const orderItemStatusEnum = pgEnum('order_item_status', [
  'pending', 'processing', 'success', 'failed',
])
export const domainStatusEnum = pgEnum('domain_status', [
  'active', 'expired', 'suspended', 'transfer_out',
])
export const renewalStatusEnum = pgEnum('renewal_status', [
  'pending', 'processing', 'success', 'failed',
])

// ─── Organizations & Users ────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  riskScore: integer('risk_score').notNull().default(0),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const orgMemberships = pgTable(
  'org_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    role: orgRoleEnum('role').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('uq_org_user').on(t.orgId, t.userId)],
)

export const platformRoles = pgTable('platform_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id).unique(),
  role: platformRoleEnum('role').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: orgRoleEnum('role').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Wallet ───────────────────────────────────────────────────────────────────

export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id).unique(),
  currency: varchar('currency', { length: 10 }).notNull().default('usdt'),
  availableBalance: numeric('available_balance', { precision: 18, scale: 6 }).notNull().default('0'),
  frozenBalance: numeric('frozen_balance', { precision: 18, scale: 6 }).notNull().default('0'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  check('chk_available_balance_non_negative', sql`${t.availableBalance} >= 0`),
  check('chk_frozen_balance_non_negative', sql`${t.frozenBalance} >= 0`),
])

export const walletLedger = pgTable(
  'wallet_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    walletId: uuid('wallet_id').notNull().references(() => wallets.id),
    orgId: uuid('org_id').notNull().references(() => organizations.id),
    entryType: ledgerEntryTypeEnum('entry_type').notNull(),
    amount: numeric('amount', { precision: 18, scale: 6 }).notNull(),
    balanceAfter: numeric('balance_after', { precision: 18, scale: 6 }).notNull(),
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: uuid('reference_id'),
    note: text('note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('idx_ledger_wallet').on(t.walletId)],
)

export const deposits = pgTable('deposits', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  walletId: uuid('wallet_id').notNull().references(() => wallets.id),
  // Hashnut fields
  hashnutOrderId: varchar('hashnut_order_id', { length: 255 }),     // Hashnut's payOrderId
  hashnutAccessSign: varchar('hashnut_access_sign', { length: 512 }), // for querying order
  paymentUrl: text('payment_url'),                                   // checkout URL shown to user
  // On-chain details (populated after Hashnut confirms)
  depositAddress: varchar('deposit_address', { length: 255 }),
  txHash: varchar('tx_hash', { length: 255 }),
  network: varchar('network', { length: 50 }).notNull().default('tron'),
  chain: varchar('chain', { length: 50 }).notNull().default('TRC20'),
  requestedAmount: numeric('requested_amount', { precision: 18, scale: 6 }).notNull(),
  amount: numeric('amount', { precision: 18, scale: 6 }),            // actual received amount
  status: depositStatusEnum('status').notNull().default('pending'),
  expiresAt: timestamp('expires_at'),
  creditedAt: timestamp('credited_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ─── Search ───────────────────────────────────────────────────────────────────

export const searchSessions = pgTable(
  'search_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id),
    requestedBy: uuid('requested_by').notNull().references(() => users.id),
    totalCount: integer('total_count').notNull(),
    status: searchSessionStatusEnum('status').notNull().default('in_progress'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('idx_search_sessions_org').on(t.orgId)],
)

export const searchResults = pgTable(
  'search_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id').notNull().references(() => searchSessions.id),
    domainName: varchar('domain_name', { length: 255 }).notNull(),
    availabilityStatus: availabilityStatusEnum('availability_status').notNull(),
    registrationPrice: numeric('registration_price', { precision: 10, scale: 2 }),
    renewalPrice: numeric('renewal_price', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 10 }).notNull().default('usdt'),
    providerName: varchar('provider_name', { length: 100 }),
    restrictionNote: text('restriction_note'),
    checkedAt: timestamp('checked_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
  },
  (t) => [index('idx_search_results_session').on(t.sessionId)],
)

// ─── Orders ───────────────────────────────────────────────────────────────────

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull().unique(),
    status: orderStatusEnum('status').notNull().default('pending'),
    totalEstimated: numeric('total_estimated', { precision: 10, scale: 2 }).notNull(),
    totalCaptured: numeric('total_captured', { precision: 10, scale: 2 }).notNull().default('0'),
    riskReviewReason: text('risk_review_reason'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('idx_orders_org').on(t.orgId)],
)

export const purchaseOrderItems = pgTable(
  'purchase_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull().references(() => purchaseOrders.id),
    domainName: varchar('domain_name', { length: 255 }).notNull(),
    status: orderItemStatusEnum('status').notNull().default('pending'),
    registrationPrice: numeric('registration_price', { precision: 10, scale: 2 }).notNull(),
    years: integer('years').notNull().default(1),
    providerName: varchar('provider_name', { length: 100 }),
    providerOrderId: varchar('provider_order_id', { length: 255 }),
    failureReason: text('failure_reason'),
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('idx_order_items_order').on(t.orderId)],
)

// ─── Domains (Portfolio) ──────────────────────────────────────────────────────

export const domains = pgTable(
  'domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id),
    orderItemId: uuid('order_item_id').references(() => purchaseOrderItems.id),
    domainName: varchar('domain_name', { length: 255 }).notNull(),
    tld: varchar('tld', { length: 50 }).notNull(),
    providerName: varchar('provider_name', { length: 100 }).notNull(),
    providerDomainId: varchar('provider_domain_id', { length: 255 }),
    status: domainStatusEnum('status').notNull().default('active'),
    registeredAt: timestamp('registered_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    autoRenew: boolean('auto_renew').notNull().default(false),
    nameservers: text('nameservers').array().notNull().default(sql`'{}'::text[]`),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_domain_org').on(t.domainName, t.orgId),
    index('idx_domains_expiry').on(t.expiresAt),
    index('idx_domains_org').on(t.orgId),
  ],
)

export const nameserverTemplates = pgTable(
  'nameserver_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id),
    name: varchar('name', { length: 100 }).notNull(),
    nameservers: text('nameservers').array().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_ns_template_org_name').on(t.orgId, t.name),
    index('idx_ns_templates_org').on(t.orgId),
  ],
)

export const domainRenewals = pgTable('domain_renewals', {
  id: uuid('id').primaryKey().defaultRandom(),
  domainId: uuid('domain_id').notNull().references(() => domains.id),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull().unique(),
  status: renewalStatusEnum('status').notNull().default('pending'),
  years: integer('years').notNull().default(1),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
