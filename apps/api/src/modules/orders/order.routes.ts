import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as orderService from './order.service.js'
import { requireMinRole } from '../../shared/rbac.js'

const createOrderSchema = z.object({
  idempotencyKey: z.string().min(1).max(255),
  items: z.array(z.object({
    domainName: z.string().min(3),
    years: z.number().int().min(1).max(10).default(1),
    registrationPrice: z.string(),
  })).min(1).max(500),
})

const pageSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export default async function orderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.post('/', async (request, reply) => {
    requireMinRole(request.user.role as any, 'operator')
    const body = createOrderSchema.parse(request.body)
    const order = await orderService.createOrder(
      request.user.orgId,
      request.user.sub,
      body.idempotencyKey,
      body.items,
    )
    return reply.status(201).send(order)
  })

  app.get('/', async (request) => {
    const query = pageSchema.parse(request.query)
    return orderService.listOrders(request.user.orgId, query.page, query.pageSize)
  })

  app.get('/:orderId', async (request) => {
    const { orderId } = request.params as { orderId: string }
    return orderService.getOrder(orderId, request.user.orgId)
  })
}
