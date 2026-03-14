/**
 * Dev-only endpoints for simulating payment events locally.
 * NEVER registered in production (guarded by NODE_ENV check in app.ts).
 */
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { deposits } from '../../db/schema.js'
import { MockHashnutClient } from '../wallet/hashnut.mock.js'
import { creditBalance, markDepositConfirming } from '../wallet/wallet.service.js'

export default async function devRoutes(app: FastifyInstance) {
  /**
   * Simulate Hashnut confirming a deposit (state=4 success).
   *
   * Usage:
   *   POST /dev/deposits/:depositId/confirm
   *   POST /dev/deposits/:depositId/confirm  { "state": 3 }  ← just confirming
   */
  app.post<{ Params: { depositId: string }; Body: { state?: number } }>(
    '/dev/deposits/:depositId/confirm',
    async (request, reply) => {
      const { depositId } = request.params
      const state = request.body?.state ?? 4

      const deposit = await db.query.deposits.findFirst({
        where: eq(deposits.id, depositId),
      })

      if (!deposit) {
        return reply.status(404).send({ error: 'Deposit not found' })
      }

      if (state === 3) {
        await markDepositConfirming(depositId)
        return { depositId, simulated: 'confirming' }
      }

      if (state === 4) {
        // Advance mock order to success state
        MockHashnutClient.confirmOrder(depositId)

        await creditBalance(
          depositId,
          deposit.requestedAmount,
          `0xmock_dev_${depositId.slice(0, 8)}`,
        )

        const updated = await db.query.deposits.findFirst({
          where: eq(deposits.id, depositId),
        })

        return {
          depositId,
          simulated: 'success',
          creditedAmount: deposit.requestedAmount,
          deposit: updated,
        }
      }

      return reply.status(400).send({ error: `Unsupported state: ${state}` })
    },
  )

  /**
   * Simple mock payment page — shown when user clicks "Open Payment Page"
   * in the deposit modal during local dev.
   */
  app.get('/dev/mock-payment', async (request, reply) => {
    const { orderId, amount, chain } = request.query as Record<string, string>

    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
        <head><title>Mock Payment</title></head>
        <body style="font-family:sans-serif;max-width:480px;margin:60px auto;padding:20px">
          <h2>Mock USDT Payment</h2>
          <p>Order: <code>${orderId}</code></p>
          <p>Amount: <strong>${amount} USDT</strong></p>
          <p>Network: <strong>${chain}</strong></p>
          <hr/>
          <p>Click below to simulate a successful payment:</p>
          <button
            onclick="fetch('/api/v1/dev/deposits/${orderId}/confirm',{method:'POST'})
              .then(r=>r.json()).then(d=>{
                document.getElementById('result').textContent = JSON.stringify(d, null, 2)
              })"
            style="background:#2563eb;color:white;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:15px"
          >
            ✓ Simulate Payment Success
          </button>
          <pre id="result" style="margin-top:20px;background:#f3f4f6;padding:12px;border-radius:6px"></pre>
        </body>
      </html>
    `)
  })
}
