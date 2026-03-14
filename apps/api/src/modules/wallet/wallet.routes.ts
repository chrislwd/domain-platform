import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import * as walletService from './wallet.service.js'
import { requireMinRole } from '../../shared/rbac.js'

const pageSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

export default async function walletRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  app.get('/', async (request) => {
    return walletService.getWallet(request.user.orgId)
  })

  app.get('/deposit-address', async (request) => {
    return walletService.createDepositRequest(request.user.orgId)
  })

  app.get('/deposits', async (request) => {
    const query = pageSchema.parse(request.query)
    return walletService.getDeposits(request.user.orgId, query.page, query.pageSize)
  })

  app.get('/ledger', async (request) => {
    requireMinRole(request.user.role as any, 'finance')
    const query = pageSchema.parse(request.query)
    return walletService.getLedger(request.user.orgId, query.page, query.pageSize)
  })
}
