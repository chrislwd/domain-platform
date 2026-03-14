/**
 * Mock Hashnut client for local development.
 *
 * createOrder → returns fake credentials immediately, stores order in memory
 * queryOrder  → returns stored order data (defaults to state=4 SUCCESS)
 *
 * To simulate a confirmed deposit without real Hashnut:
 *   POST /dev/deposits/:depositId/confirm   (dev-only endpoint)
 */
import crypto from 'node:crypto'
import type {
  IHashnutClient,
  CreateOrderParams,
  CreateOrderResponse,
  QueryOrderResponse,
} from './hashnut.client.js'

interface MockOrder {
  payOrderId: string
  merchantOrderId: string
  amount: string
  currency: string
  chain: string
  state: number
  txHash: string
  payAddress: string
  accessSign: string
}

// In-process store: depositId → order (fine for single-process dev server)
const orderStore = new Map<string, MockOrder>()

export class MockHashnutClient implements IHashnutClient {
  async createOrder(params: CreateOrderParams): Promise<CreateOrderResponse> {
    const payOrderId = `mock_pay_${Date.now()}`
    const accessSign = crypto.randomBytes(16).toString('hex')
    const payAddress = `TFakeMockAddress${params.merchantOrderId.slice(0, 8).toUpperCase()}`

    const order: MockOrder = {
      payOrderId,
      merchantOrderId: params.merchantOrderId,
      amount: params.amount,
      currency: params.currency,
      chain: params.chain,
      state: 1, // initiated
      txHash: `0xmocktx${crypto.randomBytes(16).toString('hex')}`,
      payAddress,
      accessSign,
    }

    orderStore.set(accessSign, order)
    orderStore.set(params.merchantOrderId, order)  // also index by depositId

    return {
      payOrderId,
      accessSign,
      payUrl: `http://localhost:3001/dev/mock-payment?orderId=${params.merchantOrderId}&amount=${params.amount}&chain=${params.chain}`,
      payAddress,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }
  }

  async queryOrder(accessSign: string): Promise<QueryOrderResponse> {
    const order = orderStore.get(accessSign)
    if (!order) {
      // Unknown accessSign — return success with a placeholder so webhook handler can proceed
      return {
        payOrderId: `mock_unknown_${Date.now()}`,
        merchantOrderId: accessSign,
        state: 4,
        amount: '0',
        currency: 'USDT',
        chain: 'TRC20',
        txHash: `0xmocktx${crypto.randomBytes(8).toString('hex')}`,
      }
    }
    return {
      payOrderId: order.payOrderId,
      merchantOrderId: order.merchantOrderId,
      state: order.state,
      amount: order.amount,
      currency: order.currency,
      chain: order.chain,
      txHash: order.txHash,
      payAddress: order.payAddress,
    }
  }

  /** Used by the dev endpoint to advance an order to state=4 */
  static confirmOrder(depositId: string): MockOrder | null {
    const order = orderStore.get(depositId)
    if (!order) return null
    order.state = 4
    return order
  }
}
