/**
 * Lightweight DB mock helpers for unit tests.
 *
 * Instead of hitting a real database, we provide factory functions that build
 * the in-memory objects wallet service / order service expect, so we can test
 * the business logic without a running PostgreSQL instance.
 */

export function makeWallet(overrides: Partial<WalletRow> = {}): WalletRow {
  return {
    id: 'wallet-1',
    orgId: 'org-1',
    currency: 'usdt',
    availableBalance: '1000.000000',
    frozenBalance: '0.000000',
    updatedAt: new Date(),
    ...overrides,
  }
}

export function makeOrg(overrides: Partial<OrgRow> = {}): OrgRow {
  return {
    id: 'org-1',
    name: 'Test Org',
    slug: 'test-org',
    riskScore: 0,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function makeDeposit(overrides: Partial<DepositRow> = {}): DepositRow {
  return {
    id: 'deposit-1',
    orgId: 'org-1',
    walletId: 'wallet-1',
    hashnutOrderId: null,
    hashnutAccessSign: null,
    paymentUrl: null,
    depositAddress: 'TTest123',
    txHash: null,
    network: 'tron',
    chain: 'TRC20',
    requestedAmount: '100.000000',
    amount: null,
    status: 'pending',
    expiresAt: null,
    creditedAt: null,
    createdAt: new Date(),
  }
}

export function makeOrderItem(overrides: Partial<OrderItemRow> = {}): OrderItemRow {
  return {
    id: 'item-1',
    orderId: 'order-1',
    domainName: 'example.com',
    status: 'pending',
    registrationPrice: '12.990000',
    years: 1,
    providerName: 'mock',
    providerOrderId: null,
    failureReason: null,
    processedAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

// ─── Row types (minimal subset used in tests) ─────────────────────────────

export interface WalletRow {
  id: string
  orgId: string
  currency: string
  availableBalance: string
  frozenBalance: string
  updatedAt: Date
}

export interface OrgRow {
  id: string
  name: string
  slug: string
  riskScore: number
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface DepositRow {
  id: string
  orgId: string
  walletId: string
  hashnutOrderId: string | null
  hashnutAccessSign: string | null
  paymentUrl: string | null
  depositAddress: string
  txHash: string | null
  network: string
  chain: string
  requestedAmount: string
  amount: string | null
  status: string
  expiresAt: Date | null
  creditedAt: Date | null
  createdAt: Date
}

export interface OrderItemRow {
  id: string
  orderId: string
  domainName: string
  status: string
  registrationPrice: string
  years: number
  providerName: string | null
  providerOrderId: string | null
  failureReason: string | null
  processedAt: Date | null
  createdAt: Date
}
