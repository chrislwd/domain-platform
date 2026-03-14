import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as domainService from './domain.service.js'

const pageSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

const nameserversSchema = z.object({
  nameservers: z.array(z.string()).min(1).max(13),
})

const bulkNsSchema = z.object({
  domainIds: z.array(z.string().uuid()).min(1).max(100),
  nameservers: z.array(z.string()).min(1).max(13),
})

const renewSchema = z.object({
  years: z.number().int().min(1).max(10).default(1),
  idempotencyKey: z.string().min(1),
})

const expiringSchema = z.object({
  days: z.coerce.number().min(1).max(365).default(30),
})

export default async function domainRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/', async (request) => {
    const query = pageSchema.parse(request.query)
    return domainService.listDomains(request.user.orgId, query.page, query.pageSize)
  })

  app.get('/expiring', async (request) => {
    const query = expiringSchema.parse(request.query)
    return domainService.getExpiringDomains(request.user.orgId, query.days)
  })

  app.get('/:domainId', async (request) => {
    const { domainId } = request.params as { domainId: string }
    return domainService.getDomain(domainId, request.user.orgId)
  })

  app.patch('/:domainId/nameservers', async (request) => {
    const { domainId } = request.params as { domainId: string }
    const body = nameserversSchema.parse(request.body)
    return domainService.updateNameservers(domainId, request.user.orgId, body.nameservers)
  })

  app.post('/bulk-update-nameservers', async (request) => {
    const body = bulkNsSchema.parse(request.body)
    return domainService.bulkUpdateNameservers(request.user.orgId, body.domainIds, body.nameservers)
  })

  app.post('/:domainId/renew', async (request, reply) => {
    const { domainId } = request.params as { domainId: string }
    const body = renewSchema.parse(request.body)
    const renewal = await domainService.renewDomain(
      domainId,
      request.user.orgId,
      body.years,
      body.idempotencyKey,
    )
    return reply.status(201).send(renewal)
  })
}
