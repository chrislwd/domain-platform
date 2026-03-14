/**
 * Hashnut payment gateway webhook handler.
 *
 * Hashnut POST to: POST /api/v1/webhooks/hashnut
 *
 * Payload: { payOrderId, merchantOrderId, accessSign, state }
 * State codes: 1=initiated, 3=confirming, 4=success, -1=failed, -2=expired, -3=cancelled
 *
 * Flow:
 *  1. Receive webhook
 *  2. On state 3: mark deposit as confirming
 *  3. On state 4: query Hashnut to get confirmed amount + txHash, then credit wallet
 *  4. On state -1/-2/-3: mark deposit as failed/expired
 *  5. Always return 200 "success" — Hashnut retries 3 times if we don't
 */
import type { FastifyInstance } from 'fastify'
import type { IHashnutClient } from '../wallet/hashnut.client.js'
import { HashnutClient } from '../wallet/hashnut.client.js'
import { MockHashnutClient } from '../wallet/hashnut.mock.js'
import {
  creditBalance,
  markDepositConfirming,
  markDepositFailed,
} from '../wallet/wallet.service.js'
import { config } from '../../config.js'

interface HashnutWebhookPayload {
  payOrderId: string
  merchantOrderId: string   // This is our deposits.id
  accessSign: string
  state: number
}

const HASHNUT_STATE = {
  INITIATED: 1,
  CONFIRMING: 3,
  SUCCESS: 4,
  FAILED: -1,
  EXPIRED: -2,
  CANCELLED: -3,
} as const

export default async function hashnutWebhookRoutes(app: FastifyInstance) {
  app.post('/webhooks/hashnut', async (request, reply) => {
    const body = request.body as HashnutWebhookPayload

    app.log.info({ body }, 'Hashnut webhook received')

    // Validate required fields
    if (!body?.merchantOrderId || body?.state == null) {
      app.log.warn({ body }, 'Hashnut webhook: missing required fields')
      // Still return success to prevent Hashnut from retrying a malformed request
      return reply.send('success')
    }

    const depositId = body.merchantOrderId

    try {
      switch (body.state) {
        case HASHNUT_STATE.CONFIRMING: {
          await markDepositConfirming(depositId)
          app.log.info({ depositId }, 'Deposit: confirming on-chain')
          break
        }

        case HASHNUT_STATE.SUCCESS: {
          const hashnut: IHashnutClient = config.HASHNUT_MOCK
            ? new MockHashnutClient()
            : new HashnutClient({
                mchNo: config.HASHNUT_MCH_NO,
                appId: config.HASHNUT_APP_ID,
                secretKey: config.HASHNUT_SECRET_KEY,
                baseUrl: config.HASHNUT_SANDBOX
                  ? config.HASHNUT_SANDBOX_BASE_URL
                  : config.HASHNUT_BASE_URL,
              })

          const order = await hashnut.queryOrder(body.accessSign)

          // Double-check state from the authoritative query
          if (order.state !== HASHNUT_STATE.SUCCESS) {
            app.log.warn(
              { depositId, orderState: order.state },
              'Hashnut webhook state=4 but query returned different state — skipping credit',
            )
            break
          }

          await creditBalance(
            depositId,
            order.amount,
            order.txHash ?? null,
          )

          app.log.info({ depositId, amount: order.amount, txHash: order.txHash }, 'Deposit credited')
          break
        }

        case HASHNUT_STATE.FAILED: {
          await markDepositFailed(depositId, 'failed')
          app.log.info({ depositId }, 'Deposit: marked failed')
          break
        }

        case HASHNUT_STATE.EXPIRED:
        case HASHNUT_STATE.CANCELLED: {
          await markDepositFailed(depositId, 'expired')
          app.log.info({ depositId, state: body.state }, 'Deposit: marked expired/cancelled')
          break
        }

        default:
          app.log.info({ depositId, state: body.state }, 'Hashnut webhook: unhandled state')
      }
    } catch (err) {
      // Log but don't throw — always return "success" so Hashnut doesn't retry
      // indefinitely. If creditBalance fails, the deposit stays in its current
      // state and can be manually resolved by platform Ops.
      app.log.error({ err, depositId }, 'Hashnut webhook handler error')
    }

    // Hashnut requires exactly this response
    return reply.send('success')
  })
}
