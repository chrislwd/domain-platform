import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import { config } from '../config.js'
import { UnauthorizedError } from '../shared/errors.js'

export interface JwtPayload {
  sub: string        // userId
  orgId: string
  role: string
  platformRole?: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload
  }
}

export default fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: config.JWT_SECRET,
  })

  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify()
    } catch {
      throw new UnauthorizedError()
    }
  })

  app.decorate('requirePlatformRole', (role: string) => async (request: any) => {
    if (request.user.platformRole !== role) {
      throw new UnauthorizedError('Platform role required')
    }
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
    requirePlatformRole: (role: string) => (request: any) => Promise<void>
  }
}
