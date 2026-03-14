import { eq, and } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { nameserverTemplates, domains } from '../../db/schema.js'
import { NotFoundError, ConflictError } from '../../shared/errors.js'
import { getProvider } from './provider/registry.js'

export async function listTemplates(orgId: string) {
  return db.query.nameserverTemplates.findMany({
    where: eq(nameserverTemplates.orgId, orgId),
    orderBy: nameserverTemplates.name,
  })
}

export async function createTemplate(orgId: string, name: string, nameservers: string[]) {
  const existing = await db.query.nameserverTemplates.findFirst({
    where: and(eq(nameserverTemplates.orgId, orgId), eq(nameserverTemplates.name, name)),
  })
  if (existing) throw new ConflictError(`Template "${name}" already exists`)

  const [template] = await db.insert(nameserverTemplates).values({
    orgId, name, nameservers,
  }).returning()

  return template
}

export async function updateTemplate(orgId: string, templateId: string, name: string, nameservers: string[]) {
  const template = await db.query.nameserverTemplates.findFirst({
    where: eq(nameserverTemplates.id, templateId),
  })
  if (!template || template.orgId !== orgId) throw new NotFoundError('Template')

  const [updated] = await db.update(nameserverTemplates)
    .set({ name, nameservers, updatedAt: new Date() })
    .where(eq(nameserverTemplates.id, templateId))
    .returning()

  return updated
}

export async function deleteTemplate(orgId: string, templateId: string) {
  const template = await db.query.nameserverTemplates.findFirst({
    where: eq(nameserverTemplates.id, templateId),
  })
  if (!template || template.orgId !== orgId) throw new NotFoundError('Template')

  await db.delete(nameserverTemplates).where(eq(nameserverTemplates.id, templateId))
}

export async function applyTemplate(orgId: string, templateId: string, domainIds: string[]) {
  const template = await db.query.nameserverTemplates.findFirst({
    where: eq(nameserverTemplates.id, templateId),
  })
  if (!template || template.orgId !== orgId) throw new NotFoundError('Template')

  const results = await Promise.allSettled(
    domainIds.map(async (domainId) => {
      const domain = await db.query.domains.findFirst({
        where: and(eq(domains.id, domainId), eq(domains.orgId, orgId)),
      })
      if (!domain) throw new NotFoundError(`Domain ${domainId}`)

      const provider = getProvider(domain.tld)
      const result = await provider.updateNameservers({
        domainName: domain.domainName,
        providerDomainId: domain.providerDomainId ?? '',
        nameservers: template.nameservers,
      })

      if (!result.success) throw new Error(result.failureReason ?? 'Provider error')

      await db.update(domains)
        .set({ nameservers: template.nameservers, updatedAt: new Date() })
        .where(eq(domains.id, domainId))

      return domainId
    }),
  )

  return {
    templateName: template.name,
    nameservers: template.nameservers,
    success: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
    errors: results
      .map((r, i) => r.status === 'rejected' ? { domainId: domainIds[i], reason: (r as any).reason?.message } : null)
      .filter(Boolean),
  }
}
