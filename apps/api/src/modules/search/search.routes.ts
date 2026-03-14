import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as searchService from './search.service.js'

const submitSchema = z.object({
  domains: z.array(z.string().min(3)).min(1).max(500),
})

const pageSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export default async function searchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.post('/', async (request, reply) => {
    const body = submitSchema.parse(request.body)
    const result = await searchService.submitSearch(
      request.user.orgId,
      request.user.sub,
      body.domains,
    )
    return reply.status(202).send(result)
  })

  app.get('/', async (request) => {
    const query = pageSchema.parse(request.query)
    return searchService.listSessions(request.user.orgId, query.page, query.pageSize)
  })

  app.get('/:sessionId', async (request) => {
    const { sessionId } = request.params as { sessionId: string }
    return searchService.getSession(sessionId, request.user.orgId)
  })
}
