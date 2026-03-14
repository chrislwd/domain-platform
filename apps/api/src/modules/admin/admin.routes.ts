import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { organizations, purchaseOrders } from '../../db/schema.js'
import { approveOrder, rejectOrder } from '../orders/order.service.js'
import { UnauthorizedError } from '../../shared/errors.js'

const rejectSchema = z.object({ reason: z.string().min(1) })
const riskScoreSchema = z.object({ riskScore: z.number().int().min(0).max(100) })

const pageSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

function requirePlatformAdmin(request: any) {
  if (!request.user.platformRole) throw new UnauthorizedError('Platform admin access required')
}

export default async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // Risk review queue
  app.get('/review-queue', async (request) => {
    requirePlatformAdmin(request)
    const query = pageSchema.parse(request.query)
    const offset = (query.page - 1) * query.pageSize

    const [rows, countResult] = await Promise.all([
      db.select().from(purchaseOrders)
        .where(eq(purchaseOrders.status, 'awaiting_review'))
        .orderBy(purchaseOrders.createdAt)
        .limit(query.pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.status, 'awaiting_review')),
    ])

    return { orders: rows, total: Number(countResult[0]?.count ?? 0) }
  })

  app.post('/orders/:orderId/approve', async (request) => {
    requirePlatformAdmin(request)
    const { orderId } = request.params as { orderId: string }
    await approveOrder(orderId, request.user.sub)
    return { success: true }
  })

  app.post('/orders/:orderId/reject', async (request) => {
    requirePlatformAdmin(request)
    const { orderId } = request.params as { orderId: string }
    const body = rejectSchema.parse(request.body)
    await rejectOrder(orderId, request.user.sub, body.reason)
    return { success: true }
  })

  // Org management
  app.get('/orgs', async (request) => {
    requirePlatformAdmin(request)
    const query = pageSchema.parse(request.query)
    const offset = (query.page - 1) * query.pageSize

    const [rows, countResult] = await Promise.all([
      db.select().from(organizations)
        .orderBy(desc(organizations.createdAt))
        .limit(query.pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(organizations),
    ])

    return { orgs: rows, total: Number(countResult[0]?.count ?? 0) }
  })

  app.patch('/orgs/:orgId/risk-score', async (request) => {
    requirePlatformAdmin(request)
    const { orgId } = request.params as { orgId: string }
    const body = riskScoreSchema.parse(request.body)

    const [org] = await db.update(organizations)
      .set({ riskScore: body.riskScore, updatedAt: new Date() })
      .where(eq(organizations.id, orgId))
      .returning()

    return org
  })
}
