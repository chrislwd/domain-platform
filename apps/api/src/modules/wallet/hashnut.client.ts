/**
 * Hashnut payment gateway client.
 *
 * Docs: https://docs.hashnut.io/docs/api-reference/
 *
 * NOTE: Some field names are inferred from the public webhook docs +
 * common crypto-gateway conventions. Verify against your Hashnut dashboard
 * if any request fails, and adjust the field names accordingly.
 */
import crypto from 'node:crypto'

export interface HashnutConfig {
  mchNo: string       // Merchant number / API Key
  appId: string       // App ID (from Hashnut dashboard)
  secretKey: string   // HMAC signing secret
  baseUrl: string     // e.g. https://api.hashnut.io  (or testnet URL)
}

// ─── Request / Response types ──────────────────────────────────────────────

export interface CreateOrderParams {
  merchantOrderId: string   // Your internal deposit ID (idempotency key)
  amount: string            // USDT amount, e.g. "100.00"
  currency: string          // "USDT"
  chain: string             // "TRC20" | "ERC20" | "BEP20"
  notifyUrl: string         // Your webhook URL
  subject: string           // Human-readable description
  expiredTime?: number      // Seconds until order expires (default: 3600)
}

export interface CreateOrderResponse {
  payOrderId: string        // Hashnut order ID
  accessSign: string        // Used to query order details later
  payUrl?: string           // Checkout page URL (show to user)
  payAddress?: string       // Direct USDT address to pay to
  expiresAt?: string        // ISO timestamp
}

export interface QueryOrderResponse {
  payOrderId: string
  merchantOrderId: string
  state: number             // 1=initiated 3=confirming 4=success -1=failed -2=expired -3=cancelled
  amount: string
  currency: string
  chain: string
  txHash?: string
  payAddress?: string
  paidAt?: string
}

// ─── Shared interface ─────────────────────────────────────────────────────

export interface IHashnutClient {
  createOrder(params: CreateOrderParams): Promise<CreateOrderResponse>
  queryOrder(accessSign: string): Promise<QueryOrderResponse>
}

// ─── HMAC signature ────────────────────────────────────────────────────────

/**
 * Builds the HMAC-SHA256 signature for a Hashnut API request.
 *
 * Signing string: alphabetically sorted query params joined as
 * "key1=value1&key2=value2", then HMAC-SHA256 with secretKey.
 *
 * NOTE: Verify this against the actual Hashnut signing docs —
 * some gateways use JSON body, others use form-encoded sorted params.
 */
function buildSignature(params: Record<string, string>, secretKey: string): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== '' && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')

  return crypto.createHmac('sha256', secretKey).update(sorted).digest('hex').toUpperCase()
}

// ─── Client ────────────────────────────────────────────────────────────────

export class HashnutClient implements IHashnutClient {
  constructor(private readonly cfg: HashnutConfig) {}

  private sign(params: Record<string, string>): string {
    return buildSignature(params, this.cfg.secretKey)
  }

  private baseParams(): Record<string, string> {
    return {
      mchNo: this.cfg.mchNo,
      appId: this.cfg.appId,
      reqTime: String(Date.now()),
      version: '1.0',
    }
  }

  private async post<T>(path: string, body: Record<string, string>): Promise<T> {
    const params = { ...this.baseParams(), ...body }
    params.sign = this.sign(params)

    const res = await fetch(`${this.cfg.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (!res.ok) {
      throw new HashnutError(`HTTP ${res.status}`, res.status)
    }

    const json: any = await res.json()

    // Hashnut wraps responses: { code: 0, msg: "success", data: {...} }
    if (json.code !== 0 && json.code !== '0') {
      throw new HashnutError(json.msg ?? `Hashnut error code ${json.code}`, json.code)
    }

    return json.data as T
  }

  private async get<T>(path: string, query: Record<string, string>): Promise<T> {
    const params = { ...this.baseParams(), ...query }
    params.sign = this.sign(params)

    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`${this.cfg.baseUrl}${path}?${qs}`)

    if (!res.ok) {
      throw new HashnutError(`HTTP ${res.status}`, res.status)
    }

    const json: any = await res.json()
    if (json.code !== 0 && json.code !== '0') {
      throw new HashnutError(json.msg ?? `Hashnut error code ${json.code}`, json.code)
    }

    return json.data as T
  }

  /**
   * Create a new payment order.
   * Returns a payment URL and/or direct USDT address for the user to pay.
   */
  async createOrder(params: CreateOrderParams): Promise<CreateOrderResponse> {
    return this.post<CreateOrderResponse>('/api/pay/unifiedOrder', {
      mchOrderNo: params.merchantOrderId,
      amount: params.amount,
      currency: params.currency,
      chain: params.chain,
      notifyUrl: params.notifyUrl,
      subject: params.subject,
      expiredTime: String(params.expiredTime ?? 3600),
    })
  }

  /**
   * Query an existing order by accessSign.
   * Use this inside the webhook handler to verify the deposit before crediting.
   */
  async queryOrder(accessSign: string): Promise<QueryOrderResponse> {
    return this.get<QueryOrderResponse>('/api/pay/queryOrder', { accessSign })
  }
}

export class HashnutError extends Error {
  constructor(
    message: string,
    public readonly code: number | string,
  ) {
    super(`Hashnut: ${message}`)
    this.name = 'HashnutError'
  }
}
