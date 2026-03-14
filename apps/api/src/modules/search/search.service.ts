import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { searchSessions, searchResults } from '../../db/schema.js'
import { getProvider } from '../domains/provider/registry.js'
import { ValidationError, NotFoundError } from '../../shared/errors.js'
const MAX_DOMAINS_PER_REQUEST = 500
const CONCURRENCY = 20
const RESULT_TTL_HOURS = 24

export async function submitSearch(orgId: string, userId: string, domains: string[]) {
  if (domains.length > MAX_DOMAINS_PER_REQUEST) {
    throw new ValidationError(`Maximum ${MAX_DOMAINS_PER_REQUEST} domains per request`)
  }

  // Normalize domain names
  const normalized = [...new Set(domains.map((d) => d.toLowerCase().trim()).filter(Boolean))]

  const [session] = await db.insert(searchSessions).values({
    orgId,
    requestedBy: userId,
    totalCount: normalized.length,
    status: 'in_progress',
  }).returning()

  // Fan-out with bounded concurrency
  processSearch(session.id, normalized).catch((err) => {
    console.error(`Search session ${session.id} failed:`, err)
  })

  return { sessionId: session.id, totalCount: normalized.length }
}

async function processSearch(sessionId: string, domains: string[]) {
  const expiresAt = new Date(Date.now() + RESULT_TTL_HOURS * 60 * 60 * 1000)
  let hasError = false

  // Process in chunks to respect concurrency limit
  const provider = getProvider()

  for (let i = 0; i < domains.length; i += CONCURRENCY) {
    const chunk = domains.slice(i, i + CONCURRENCY)

    try {
      const results = await provider.checkAvailability(chunk)

      await db.insert(searchResults).values(
        results.map((r) => ({
          sessionId,
          domainName: r.domainName,
          availabilityStatus: r.availabilityStatus,
          registrationPrice: r.registrationPrice.toFixed(2),
          renewalPrice: r.renewalPrice.toFixed(2),
          currency: r.currency,
          providerName: provider.name as string,
          restrictionNote: r.restrictionNote,
          expiresAt,
        })),
      )
    } catch (err) {
      hasError = true
      // Insert error placeholders so the session reflects partial failure
      await db.insert(searchResults).values(
        chunk.map((domain) => ({
          sessionId,
          domainName: domain,
          availabilityStatus: 'error' as const,
          restrictionNote: 'Provider error',
          expiresAt,
        })),
      )
    }
  }

  await db.update(searchSessions)
    .set({ status: hasError ? 'partial_error' : 'complete' })
    .where(eq(searchSessions.id, sessionId))
}

export async function getSession(sessionId: string, orgId: string) {
  const session = await db.query.searchSessions.findFirst({
    where: eq(searchSessions.id, sessionId),
    with: { results: true },
  })

  if (!session || session.orgId !== orgId) throw new NotFoundError('Search session')
  return session
}

export async function listSessions(orgId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize

  const [rows, countResult] = await Promise.all([
    db.select().from(searchSessions)
      .where(eq(searchSessions.orgId, orgId))
      .orderBy(desc(searchSessions.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(searchSessions)
      .where(eq(searchSessions.orgId, orgId)),
  ])

  return { sessions: rows, total: Number(countResult[0]?.count ?? 0) }
}
