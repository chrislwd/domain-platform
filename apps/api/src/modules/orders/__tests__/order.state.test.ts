/**
 * Order state machine + idempotency tests.
 * Mocks the DB and wallet service to test order creation logic in isolation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeOrg } from '../../../test/helpers/db.js'

// ─── Mocks ────────────────────────────────────────────────────────────────

const savedOrders: any[] = []
const savedItems: any[] = []

const mockOrg = makeOrg({ riskScore: 0 })

const mockDb = {
  query: {
    purchaseOrders: {
      findFirst: vi.fn().mockResolvedValue(null), // no duplicate by default
    },
    organizations: {
      findFirst: vi.fn().mockResolvedValue(mockOrg),
    },
    purchaseOrderItems: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
  transaction: vi.fn().mockImplementation(async (fn: any) => {
    const mockTx = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockImplementation((row: any) => {
        if (Array.isArray(row)) savedItems.push(...row)
        else savedOrders.push(row)
        const id = row?.idempotencyKey ? 'order-new' : `item-${Date.now()}`
        return { returning: vi.fn().mockResolvedValue([{ ...row, id }]) }
      }),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }
    return fn(mockTx)
  }),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  for: vi.fn().mockResolvedValue([]),
}

vi.mock('../../../db/index.js', () => ({ db: mockDb }))
vi.mock('../../../db/schema.js', () => ({
  purchaseOrders: 'purchaseOrders',
  purchaseOrderItems: 'purchaseOrderItems',
  organizations: 'organizations',
  domains: 'domains',
}))
vi.mock('../../wallet/wallet.service.js', () => ({
  freezeBalance: vi.fn().mockResolvedValue(undefined),
  captureBalance: vi.fn().mockResolvedValue(undefined),
  releaseBalance: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../domains/provider/registry.js', () => ({
  getProvider: vi.fn().mockReturnValue({
    name: 'mock',
    registerDomain: vi.fn().mockResolvedValue({
      success: true,
      providerOrderId: 'prov-1',
      providerDomainId: 'dom-1',
      registeredAt: new Date(),
      expiresAt: new Date(),
      failureReason: null,
    }),
  }),
}))
vi.mock('../../../config.js', () => ({
  config: {
    RISK_ITEM_COUNT_THRESHOLD: 50,
    RISK_AMOUNT_THRESHOLD: 5000,
    REGISTRANT_FIRST_NAME: 'Test',
    REGISTRANT_LAST_NAME: 'User',
    REGISTRANT_EMAIL: 'test@example.com',
    REGISTRANT_PHONE: '+1.5555555555',
    REGISTRANT_ADDRESS: '123 Main',
    REGISTRANT_CITY: 'NYC',
    REGISTRANT_COUNTRY: 'US',
    REGISTRANT_POSTAL_CODE: '10001',
  },
}))

const { createOrder } = await import('../order.service.js')
const { freezeBalance } = await import('../../wallet/wallet.service.js')

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Order creation', () => {
  beforeEach(() => {
    savedOrders.length = 0
    savedItems.length = 0
    vi.clearAllMocks()

    mockDb.query.purchaseOrders.findFirst.mockResolvedValue(null)
    mockDb.query.organizations.findFirst.mockResolvedValue(mockOrg)
    mockDb.transaction.mockImplementation(async (fn: any) => {
      const fakeOrder = {
        id: 'order-new',
        status: 'pending',
        totalEstimated: '25.98',
        orgId: 'org-1',
        riskReviewReason: null,
      }
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockImplementation((row: any) => ({
          returning: vi.fn().mockResolvedValue([
            Array.isArray(row) ? { ...row[0], id: 'item-1' } : fakeOrder,
          ]),
        })),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      }
      return fn(mockTx)
    })
    vi.mocked(freezeBalance).mockResolvedValue(undefined)
  })

  const twoItems = [
    { domainName: 'example.com', years: 1, registrationPrice: '12.990000' },
    { domainName: 'example.io', years: 1, registrationPrice: '12.990000' },
  ]

  it('creates order with pending status for clean org', async () => {
    const order = await createOrder('org-1', 'user-1', 'idem-key-1', twoItems)
    expect(order.status).toBe('pending')
  })

  it('freezes the total estimated amount', async () => {
    await createOrder('org-1', 'user-1', 'idem-key-2', twoItems)
    expect(freezeBalance).toHaveBeenCalledWith('org-1', '25.98', expect.any(String))
  })

  it('returns existing order on duplicate idempotency key', async () => {
    const existingOrder = { id: 'existing-order', status: 'completed', totalEstimated: '12.99' }
    mockDb.query.purchaseOrders.findFirst.mockResolvedValue(existingOrder)

    const order = await createOrder('org-1', 'user-1', 'idem-key-dup', twoItems)

    expect(order).toBe(existingOrder)
    expect(freezeBalance).not.toHaveBeenCalled()
  })

  it('sets awaiting_review for high-risk org', async () => {
    mockDb.query.organizations.findFirst.mockResolvedValue(
      makeOrg({ riskScore: 80 }),
    )

    const highRiskOrder = { id: 'order-hr', status: 'awaiting_review', orgId: 'org-1', totalEstimated: '25.98', riskReviewReason: 'org risk score 80 is high' }
    mockDb.transaction.mockImplementationOnce(async (fn: any) => {
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockResolvedValue([highRiskOrder]),
        })),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      }
      return fn(mockTx)
    })

    const order = await createOrder('org-1', 'user-1', 'idem-key-hr', twoItems)

    expect(order.status).toBe('awaiting_review')
    expect(order.riskReviewReason).toMatch(/risk score/)
    // High-risk orders must NOT be frozen until approved
    expect(freezeBalance).not.toHaveBeenCalled()
  })

  it('sets awaiting_review when item count exceeds threshold', async () => {
    const manyItems = Array.from({ length: 51 }, (_, i) => ({
      domainName: `test${i}.com`,
      years: 1,
      registrationPrice: '12.990000',
    }))

    const largeOrder = { id: 'order-large', status: 'awaiting_review', orgId: 'org-1', totalEstimated: '663.49', riskReviewReason: 'item count 51 exceeds threshold' }
    mockDb.transaction.mockImplementationOnce(async (fn: any) => {
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockImplementation(() => ({
          returning: vi.fn().mockResolvedValue([largeOrder]),
        })),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      }
      return fn(mockTx)
    })

    const order = await createOrder('org-1', 'user-1', 'idem-key-large', manyItems)

    expect(order.status).toBe('awaiting_review')
    expect(freezeBalance).not.toHaveBeenCalled()
  })

  it('calculates total correctly for multi-year items', async () => {
    const items = [
      { domainName: 'example.com', years: 3, registrationPrice: '12.990000' },
      { domainName: 'example.io', years: 2, registrationPrice: '15.990000' },
    ]
    // 12.99 * 3 + 15.99 * 2 = 38.97 + 31.98 = 70.95
    let capturedTotal = ''
    mockDb.transaction.mockImplementationOnce(async (fn: any) => {
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockImplementation((row: any) => {
          if (row?.totalEstimated) capturedTotal = row.totalEstimated
          return { returning: vi.fn().mockResolvedValue([{ ...row, id: 'order-x', status: 'pending' }]) }
        }),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      }
      return fn(mockTx)
    })

    await createOrder('org-1', 'user-1', 'idem-multi-year', items)
    expect(capturedTotal).toBe('70.95')
  })
})
