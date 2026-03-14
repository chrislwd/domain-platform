import { eq, lte, and, desc, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { domains, domainRenewals } from '../../db/schema.js'
import { freezeBalance, captureBalance, releaseBalance } from '../wallet/wallet.service.js'
import { getProvider } from './provider/registry.js'
import { NotFoundError } from '../../shared/errors.js'
import { scheduleRenewalReminders } from '../../queues/index.js'

export async function listDomains(
  orgId: string,
  page: number,
  pageSize: number,
  filters?: { status?: string; tag?: string },
) {
  const offset = (page - 1) * pageSize

  const where = eq(domains.orgId, orgId)

  const [rows, countResult] = await Promise.all([
    db.select().from(domains)
      .where(where)
      .orderBy(desc(domains.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(domains).where(where),
  ])

  return { domains: rows, total: Number(countResult[0]?.count ?? 0) }
}

export async function getDomain(domainId: string, orgId: string) {
  const domain = await db.query.domains.findFirst({
    where: eq(domains.id, domainId),
  })
  if (!domain || domain.orgId !== orgId) throw new NotFoundError('Domain')
  return domain
}

export async function updateNameservers(domainId: string, orgId: string, nameservers: string[]) {
  const domain = await getDomain(domainId, orgId)

  const provider = getProvider(domain.tld)
  const result = await provider.updateNameservers({
    domainName: domain.domainName,
    providerDomainId: domain.providerDomainId ?? '',
    nameservers,
  })

  if (!result.success) {
    throw new Error(result.failureReason ?? 'Failed to update nameservers')
  }

  const [updated] = await db.update(domains)
    .set({ nameservers, updatedAt: new Date() })
    .where(eq(domains.id, domainId))
    .returning()

  return updated
}

export async function bulkUpdateNameservers(orgId: string, domainIds: string[], nameservers: string[]) {
  const results = await Promise.allSettled(
    domainIds.map((id) => updateNameservers(id, orgId, nameservers)),
  )

  return {
    success: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  }
}

export async function getExpiringDomains(orgId: string, withinDays: number = 30) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + withinDays)

  return db.select().from(domains).where(
    and(eq(domains.orgId, orgId), lte(domains.expiresAt, cutoff)),
  ).orderBy(domains.expiresAt)
}

export async function renewDomain(
  domainId: string,
  orgId: string,
  years: number,
  idempotencyKey: string,
) {
  const domain = await getDomain(domainId, orgId)

  // Idempotency check
  const existing = await db.query.domainRenewals.findFirst({
    where: eq(domainRenewals.idempotencyKey, idempotencyKey),
  })
  if (existing) return existing

  // Estimate price (in production: fetch from provider)
  const price = (14.99 * years).toFixed(2)

  const [renewal] = await db.insert(domainRenewals).values({
    domainId,
    orgId,
    idempotencyKey,
    status: 'pending',
    years,
    price,
  }).returning()

  // Freeze balance
  await freezeBalance(orgId, price, renewal.id, `Renewal for ${domain.domainName}`)

  // Process async
  processRenewal(renewal.id, domain, orgId, price).catch(console.error)

  return renewal
}

async function processRenewal(
  renewalId: string,
  domain: typeof domains.$inferSelect,
  orgId: string,
  price: string,
) {
  await db.update(domainRenewals)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(domainRenewals.id, renewalId))

  const renewal = await db.query.domainRenewals.findFirst({
    where: eq(domainRenewals.id, renewalId),
  })
  if (!renewal) return

  const provider = getProvider(domain.tld)
  const result = await provider.renewDomain({
    domainName: domain.domainName,
    providerDomainId: domain.providerDomainId ?? '',
    years: renewal.years,
  })

  if (result.success && result.newExpiresAt) {
    await db.update(domains)
      .set({ expiresAt: result.newExpiresAt, updatedAt: new Date() })
      .where(eq(domains.id, domain.id))

    await db.update(domainRenewals)
      .set({ status: 'success', updatedAt: new Date() })
      .where(eq(domainRenewals.id, renewalId))

    await captureBalance(orgId, price, renewalId)

    // Reschedule renewal reminders for the new expiry date
    scheduleRenewalReminders(domain.id, domain.domainName, orgId, result.newExpiresAt).catch(console.error)
  } else {
    await db.update(domainRenewals)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(domainRenewals.id, renewalId))

    await releaseBalance(orgId, price, renewalId)
  }
}
