import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as authService from './auth.service.js'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
})

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['finance', 'operator', 'viewer']),
})

export default async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)
    const user = await authService.registerUser(body.email, body.password)
    const token = app.jwt.sign({ sub: user.id, orgId: '', role: '' })
    return reply.status(201).send({ user: { id: user.id, email: user.email }, token })
  })

  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const user = await authService.loginUser(body.email, body.password)
    const orgs = await authService.getUserOrgs(user.id)
    const defaultOrg = orgs[0]
    const token = app.jwt.sign({
      sub: user.id,
      orgId: defaultOrg?.orgId ?? '',
      role: defaultOrg?.role ?? '',
    })
    return { user: { id: user.id, email: user.email }, token, orgs }
  })

  app.post('/orgs', { preHandler: app.authenticate }, async (request, reply) => {
    const body = createOrgSchema.parse(request.body)
    const org = await authService.createOrganization(request.user.sub, body.name)
    return reply.status(201).send(org)
  })

  app.post('/orgs/:orgId/invitations', { preHandler: app.authenticate }, async (request, reply) => {
    const body = inviteSchema.parse(request.body)
    const { orgId } = request.params as { orgId: string }
    const invite = await authService.createInvitation(orgId, body.email, body.role)
    return reply.status(201).send(invite)
  })

  app.patch('/auth/invitations/:token', { preHandler: app.authenticate }, async (request) => {
    const { token } = request.params as { token: string }
    await authService.acceptInvitation(token, request.user.sub)
    return { success: true }
  })
}
