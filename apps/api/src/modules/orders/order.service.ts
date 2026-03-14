import { eq, inArray, sql, desc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { purchaseOrders, purchaseOrderItems, organizations, domains } from '../../db/schema.js'
import { freezeBalance, captureBalance, releaseBalance } from '../wallet/wallet.service.js'
import { MockDomainProvider } from '../domains/provider/mock.adapter.js'
import { ConflictError, NotFoundError, ForbiddenError } from '../../shared/errors.js'
import { config } from '../../config.js'

const provider = new MockDomainProvider()

export interface CreateOrderItem {
  domainName: string
  years: number
  registrationPrice: string
}

export async function createOrder(
  orgId: string,
  userId: string,
  idempotencyKey: string,
  items: CreateOrderItem[],
) {
  // Fast idempotency check
  const existing = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.idempotencyKey, idempotencyKey),
  })
  if (existing) return existing

  const totalEstimated = items
    .reduce((sum, item) => sum + parseFloat(item.registrationPrice) * item.years, 0)
    .toFixed(2)

  // Evaluate risk rules
  const org = await db.query.organizations.findFirst({ where: eq(organizations.id, orgId) })
  const needsReview = evaluateRisk(items.length, parseFloat(totalEstimated), org?.riskScore ?? 0)

  return db.transaction(async (tx) => {
    const [order] = await tx.insert(purchaseOrders).values({
      orgId,
      createdBy: userId,
      idempotencyKey,
      status: needsReview ? 'awaiting_review' : 'pending',
      totalEstimated,
      riskReviewReason: needsReview ? buildRiskReason(items.length, parseFloat(totalEstimated), org?.riskScore ?? 0) : null,
    }).returning()

    await tx.insert(purchaseOrderItems).values(
      items.map((item) => ({
        orderId: order.id,
        domainName: item.domainName,
        registrationPrice: item.registrationPrice,
        years: item.years,
        providerName: provider.name,
      })),
    )

    return order
  })
  .then(async (order) => {
    if (order.status === 'pending') {
      // Freeze balance and dispatch async
      await freezeBalance(orgId, totalEstimated, order.id)
      processOrder(order.id, orgId).catch(console.error)
    }
    return order
  })
}

function evaluateRisk(itemCount: number, totalAmount: number, orgRiskScore: number): boolean {
  return (
    itemCount > config.RISK_ITEM_COUNT_THRESHOLD ||
    totalAmount > config.RISK_AMOUNT_THRESHOLD ||
    orgRiskScore >= 70
  )
}

function buildRiskReason(itemCount: number, amount: number, riskScore: number): string {
  const reasons: string[] = []
  if (itemCount > config.RISK_ITEM_COUNT_THRESHOLD) reasons.push(`item count ${itemCount} exceeds threshold`)
  if (amount > config.RISK_AMOUNT_THRESHOLD) reasons.push(`amount ${amount} exceeds threshold`)
  if (riskScore >= 70) reasons.push(`org risk score ${riskScore} is high`)
  return reasons.join('; ')
}

export async function processOrder(orderId: string, orgId: string) {
  await db.update(purchaseOrders)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(purchaseOrders.id, orderId))

  const items = await db.query.purchaseOrderItems.findMany({
    where: eq(purchaseOrderItems.orderId, orderId),
  })

  let successCount = 0
  let totalCaptured = 0

  for (const item of items) {
    await db.update(purchaseOrderItems)
      .set({ status: 'processing' })
      .where(eq(purchaseOrderItems.id, item.id))

    const result = await provider.registerDomain({
      domainName: item.domainName,
      years: item.years,
      registrantContact: {
        firstName: 'Domain', lastName: 'Admin', email: 'admin@example.com',
        phone: '+1.5555555555', address: '123 Main St', city: 'City',
        country: 'US', postalCode: '10001',
      },
    })

    if (result.success) {
      await db.update(purchaseOrderItems)
        .set({
          status: 'success',
          providerOrderId: result.providerOrderId,
          processedAt: new Date(),
        })
        .where(eq(purchaseOrderItems.id, item.id))

      // Add to domain portfolio
      await db.insert(domains).values({
        orgId,
        orderItemId: item.id,
        domainName: item.domainName,
        tld: item.domainName.split('.').pop() ?? '',
        providerName: provider.name,
        providerDomainId: result.providerDomainId,
        status: 'active',
        registeredAt: result.registeredAt ?? new Date(),
        expiresAt: result.expiresAt ?? new Date(),
        nameservers: [],
        tags: [],
      }).onConflictDoNothing()

      await captureBalance(orgId, item.registrationPrice, item.id)
      totalCaptured += parseFloat(item.registrationPrice)
      successCount++
    } else {
      await db.update(purchaseOrderItems)
        .set({ status: 'failed', failureReason: result.failureReason, processedAt: new Date() })
        .where(eq(purchaseOrderItems.id, item.id))

      await releaseBalance(orgId, item.registrationPrice, item.id)
    }
  }

  const finalStatus = successCount === 0
    ? 'failed'
    : successCount === items.length
    ? 'completed'
    : 'partial_success'

  await db.update(purchaseOrders)
    .set({ status: finalStatus, totalCaptured: totalCaptured.toFixed(2), updatedAt: new Date() })
    .where(eq(purchaseOrders.id, orderId))
}

export async function approveOrder(orderId: string, reviewerId: string) {
  const order = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, orderId),
  })
  if (!order) throw new NotFoundError('Order')
  if (order.status !== 'awaiting_review') throw new ConflictError('Order is not awaiting review')

  await freezeBalance(order.orgId, order.totalEstimated, orderId)

  await db.update(purchaseOrders)
    .set({ status: 'pending', reviewedBy: reviewerId, reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(purchaseOrders.id, orderId))

  processOrder(orderId, order.orgId).catch(console.error)
}

export async function rejectOrder(orderId: string, reviewerId: string, reason: string) {
  const order = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, orderId),
  })
  if (!order) throw new NotFoundError('Order')
  if (order.status !== 'awaiting_review') throw new ConflictError('Order is not awaiting review')

  await db.update(purchaseOrders)
    .set({
      status: 'cancelled',
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      riskReviewReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(purchaseOrders.id, orderId))
}

export async function getOrder(orderId: string, orgId: string) {
  const order = await db.query.purchaseOrders.findFirst({
    where: eq(purchaseOrders.id, orderId),
    with: { items: true },
  })
  if (!order || order.orgId !== orgId) throw new NotFoundError('Order')
  return order
}

export async function listOrders(orgId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize

  const [rows, countResult] = await Promise.all([
    db.select().from(purchaseOrders)
      .where(eq(purchaseOrders.orgId, orgId))
      .orderBy(desc(purchaseOrders.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.orgId, orgId)),
  ])

  return { orders: rows, total: Number(countResult[0]?.count ?? 0) }
}
