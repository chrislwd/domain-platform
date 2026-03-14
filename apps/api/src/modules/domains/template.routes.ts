import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as templateService from './template.service.js'

const templateBody = z.object({
  name: z.string().min(1).max(100),
  nameservers: z.array(z.string().min(1)).min(1).max(13),
})

const applyBody = z.object({
  domainIds: z.array(z.string().uuid()).min(1).max(200),
})

export default async function templateRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/', async (request) =>
    templateService.listTemplates(request.user.orgId),
  )

  app.post('/', async (request, reply) => {
    const body = templateBody.parse(request.body)
    const tpl = await templateService.createTemplate(request.user.orgId, body.name, body.nameservers)
    return reply.status(201).send(tpl)
  })

  app.put('/:templateId', async (request) => {
    const { templateId } = request.params as { templateId: string }
    const body = templateBody.parse(request.body)
    return templateService.updateTemplate(request.user.orgId, templateId, body.name, body.nameservers)
  })

  app.delete('/:templateId', async (request, reply) => {
    const { templateId } = request.params as { templateId: string }
    await templateService.deleteTemplate(request.user.orgId, templateId)
    return reply.status(204).send()
  })

  app.post('/:templateId/apply', async (request) => {
    const { templateId } = request.params as { templateId: string }
    const body = applyBody.parse(request.body)
    return templateService.applyTemplate(request.user.orgId, templateId, body.domainIds)
  })
}
