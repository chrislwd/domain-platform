import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { config } from './config.js'
import { AppError } from './shared/errors.js'

// Route modules
import authRoutes from './modules/auth/auth.routes.js'
import walletRoutes from './modules/wallet/wallet.routes.js'
import searchRoutes from './modules/search/search.routes.js'
import orderRoutes from './modules/orders/order.routes.js'
import domainRoutes from './modules/domains/domain.routes.js'
import adminRoutes from './modules/admin/admin.routes.js'
import hashnutWebhookRoutes from './modules/webhooks/hashnut.routes.js'

// Plugins
import authPlugin from './plugins/auth.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  })

  // Plugins
  await app.register(cors, { origin: config.CORS_ORIGIN })
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  await app.register(authPlugin)

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        details: error.details,
      })
    }

    // Fastify validation errors
    if (error.validation) {
      return reply.status(422).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: error.validation,
      })
    }

    app.log.error(error)
    return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Internal server error' })
  })

  // Routes
  await app.register(authRoutes, { prefix: '/api/v1' })
  await app.register(walletRoutes, { prefix: '/api/v1/wallet' })
  await app.register(searchRoutes, { prefix: '/api/v1/search' })
  await app.register(orderRoutes, { prefix: '/api/v1/orders' })
  await app.register(domainRoutes, { prefix: '/api/v1/domains' })
  await app.register(adminRoutes, { prefix: '/api/v1/platform' })
  // Webhook routes — no auth middleware, Hashnut calls this directly
  await app.register(hashnutWebhookRoutes, { prefix: '/api/v1' })

  // Health check
  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
