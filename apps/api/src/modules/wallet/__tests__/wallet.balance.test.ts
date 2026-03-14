/**
 * Wallet balance logic tests.
 *
 * We mock the DB layer so these tests run without PostgreSQL.
 * Focus: freeze → capture / release flow, ledger entries, insufficient balance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeWallet } from '../../../test/helpers/db.js'

// ─── Mock the DB module before importing the service ──────────────────────
const mockWalletRow = makeWallet()
const insertedLedgerRows: any[] = []
let walletState = { ...mockWalletRow }

const mockTx = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  for: vi.fn().mockImplementation(() => Promise.resolve([walletState])),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockImplementation((row) => {
    if (row?.entryType) insertedLedgerRows.push(row)
    return Promise.resolve()
  }),
}

// Chain select().from().where().for('update') → returns wallet
mockTx.select.mockReturnValue(mockTx)
mockTx.from.mockReturnValue(mockTx)
mockTx.where.mockReturnValue(mockTx)
mockTx.for.mockImplementation(() => Promise.resolve([walletState]))

// update().set().where() → mutates walletState
mockTx.update.mockReturnValue(mockTx)
mockTx.set.mockImplementation((updates: any) => {
  Object.assign(walletState, updates)
  return { where: vi.fn().mockResolvedValue(undefined) }
})

mockTx.insert.mockReturnValue(mockTx)
mockTx.values.mockImplementation((row: any) => {
  if (row?.entryType) insertedLedgerRows.push(row)
  return Promise.resolve()
})

const mockDb = {
  query: {
    wallets: {
      findFirst: vi.fn().mockImplementation(() => Promise.resolve(walletState)),
    },
    deposits: {
      findFirst: vi.fn(),
    },
  },
  transaction: vi.fn().mockImplementation((fn: any) => fn(mockTx)),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  for: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockResolvedValue([]),
}

vi.mock('../../../db/index.js', () => ({ db: mockDb }))
vi.mock('../../../db/schema.js', () => ({
  wallets: 'wallets',
  walletLedger: 'walletLedger',
  deposits: 'deposits',
}))
vi.mock('../hashnut.client.js', () => ({}))
vi.mock('../hashnut.mock.js', () => ({ MockHashnutClient: class {} }))
vi.mock('../../../config.js', () => ({
  config: {
    HASHNUT_MOCK: true,
    HASHNUT_MCH_NO: '',
    HASHNUT_APP_ID: '',
    HASHNUT_SECRET_KEY: '',
    HASHNUT_BASE_URL: '',
    HASHNUT_SANDBOX_BASE_URL: '',
    HASHNUT_SANDBOX: true,
    DEPOSIT_DEFAULT_CHAIN: 'TRC20',
    API_PUBLIC_URL: 'http://localhost:3001',
  },
}))

// ─── Now import the service ────────────────────────────────────────────────
const { freezeBalance, captureBalance, releaseBalance } = await import('../wallet.service.js')

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Wallet balance operations', () => {
  beforeEach(() => {
    walletState = makeWallet({ availableBalance: '1000.000000', frozenBalance: '0.000000' })
    insertedLedgerRows.length = 0
    vi.clearAllMocks()
    mockTx.select.mockReturnValue(mockTx)
    mockTx.from.mockReturnValue(mockTx)
    mockTx.where.mockReturnValue(mockTx)
    mockTx.for.mockImplementation(() => Promise.resolve([walletState]))
    mockTx.update.mockReturnValue(mockTx)
    mockTx.set.mockImplementation((updates: any) => {
      Object.assign(walletState, updates)
      return { where: vi.fn().mockResolvedValue(undefined) }
    })
    mockTx.insert.mockReturnValue(mockTx)
    mockTx.values.mockImplementation((row: any) => {
      if (row?.entryType) insertedLedgerRows.push(row)
      return Promise.resolve()
    })
    mockDb.transaction.mockImplementation((fn: any) => fn(mockTx))
  })

  // ── freeze ──────────────────────────────────────────────────────────────

  describe('freezeBalance', () => {
    it('moves amount from available to frozen', async () => {
      await freezeBalance('org-1', '100.000000', 'order-1')

      expect(walletState.availableBalance).toBe('900.000000')
      expect(walletState.frozenBalance).toBe('100.000000')
    })

    it('writes a freeze ledger entry', async () => {
      await freezeBalance('org-1', '200.000000', 'order-1')

      expect(insertedLedgerRows).toHaveLength(1)
      expect(insertedLedgerRows[0]).toMatchObject({
        entryType: 'freeze',
        referenceType: 'order',
        referenceId: 'order-1',
      })
    })

    it('records correct balanceAfter in ledger', async () => {
      await freezeBalance('org-1', '300.000000', 'order-1')

      expect(insertedLedgerRows[0].balanceAfter).toBe('700.000000')
    })

    it('throws InsufficientBalanceError when available < amount', async () => {
      walletState.availableBalance = '50.000000'

      await expect(freezeBalance('org-1', '100.000000', 'order-1'))
        .rejects.toThrow('Insufficient wallet balance')
    })

    it('allows freezing the exact available balance', async () => {
      walletState.availableBalance = '100.000000'

      await expect(freezeBalance('org-1', '100.000000', 'order-1')).resolves.not.toThrow()

      expect(walletState.availableBalance).toBe('0.000000')
      expect(walletState.frozenBalance).toBe('100.000000')
    })

    it('handles decimal precision correctly', async () => {
      walletState.availableBalance = '1000.000000'

      await freezeBalance('org-1', '12.990000', 'order-1')

      expect(walletState.availableBalance).toBe('987.010000')
    })
  })

  // ── capture ─────────────────────────────────────────────────────────────

  describe('captureBalance', () => {
    beforeEach(() => {
      walletState.availableBalance = '900.000000'
      walletState.frozenBalance = '100.000000'
    })

    it('reduces frozen balance (funds permanently captured)', async () => {
      await captureBalance('org-1', '100.000000', 'item-1')

      expect(walletState.frozenBalance).toBe('0.000000')
      // available unchanged — funds were already moved to frozen
      expect(walletState.availableBalance).toBe('900.000000')
    })

    it('writes a capture ledger entry', async () => {
      await captureBalance('org-1', '100.000000', 'item-1')

      expect(insertedLedgerRows[0]).toMatchObject({
        entryType: 'capture',
        referenceType: 'order',
        referenceId: 'item-1',
      })
    })

    it('handles partial capture (one item of many)', async () => {
      walletState.frozenBalance = '250.000000'

      await captureBalance('org-1', '12.990000', 'item-1')

      expect(walletState.frozenBalance).toBe('237.010000')
    })
  })

  // ── release ─────────────────────────────────────────────────────────────

  describe('releaseBalance', () => {
    beforeEach(() => {
      walletState.availableBalance = '900.000000'
      walletState.frozenBalance = '100.000000'
    })

    it('moves amount back from frozen to available', async () => {
      await releaseBalance('org-1', '100.000000', 'item-1')

      expect(walletState.availableBalance).toBe('1000.000000')
      expect(walletState.frozenBalance).toBe('0.000000')
    })

    it('writes a release ledger entry', async () => {
      await releaseBalance('org-1', '100.000000', 'item-1')

      expect(insertedLedgerRows[0]).toMatchObject({
        entryType: 'release',
        referenceType: 'order',
        referenceId: 'item-1',
      })
    })

    it('partial release leaves remaining frozen intact', async () => {
      walletState.frozenBalance = '200.000000'

      await releaseBalance('org-1', '50.000000', 'item-2')

      expect(walletState.availableBalance).toBe('950.000000')
      expect(walletState.frozenBalance).toBe('150.000000')
    })
  })

  // ── freeze → capture + release (full order scenario) ────────────────────

  describe('full purchase order scenario', () => {
    it('freeze all → capture some → release rest ends at correct balance', async () => {
      walletState = makeWallet({ availableBalance: '500.000000', frozenBalance: '0.000000' })

      // Freeze $100 for two items
      await freezeBalance('org-1', '60.000000', 'order-1')
      await freezeBalance('org-1', '40.000000', 'order-1')

      expect(walletState.availableBalance).toBe('400.000000')
      expect(walletState.frozenBalance).toBe('100.000000')

      // item-1 succeeds → capture
      await captureBalance('org-1', '60.000000', 'item-1')
      // item-2 fails → release
      await releaseBalance('org-1', '40.000000', 'item-2')

      expect(walletState.availableBalance).toBe('440.000000')  // 400 + 40 released
      expect(walletState.frozenBalance).toBe('0.000000')
    })
  })
})
