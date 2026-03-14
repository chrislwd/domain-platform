/**
 * BullMQ workers — process queued jobs.
 * Started once on API boot; runs in-process for MVP.
 * Can be split to a separate process later by importing this file standalone.
 */
import { Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import { config } from '../config.js'
import { db } from '../db/index.js'
import { domains, organizations, users, orgMemberships } from '../db/schema.js'
import * as emailService from '../email/email.service.js'
import type { NotificationJobData, RenewalReminderJob } from './index.js'

const connection = { url: config.REDIS_URL }

// ─── Notification worker ──────────────────────────────────────────────────────

export const notificationWorker = new Worker<NotificationJobData>(
  'notifications',
  async (job) => {
    const data = job.data

    switch (data.type) {
      case 'deposit_confirmed':
        await emailService.sendDepositConfirmed(data)
        break

      case 'order_completed':
        await emailService.sendOrderCompleted(data)
        break

      case 'order_awaiting_review':
        await emailService.sendOrderAwaitingReview(data)
        break

      default:
        job.log(`Unknown notification type: ${(data as any).type}`)
    }
  },
  {
    connection,
    concurrency: 5,
  },
)

// ─── Domain jobs worker ───────────────────────────────────────────────────────

export const domainWorker = new Worker<RenewalReminderJob>(
  'domain-jobs',
  async (job) => {
    if (job.name !== 'renewal_reminder') return

    const { domainId, orgId, daysLeft } = job.data

    // Verify domain still exists and hasn't been renewed past this expiry
    const domain = await db.query.domains.findFirst({
      where: eq(domains.id, domainId),
    })

    if (!domain) {
      job.log('Domain not found — skipping reminder')
      return
    }

    // If domain was renewed, the expiry in DB will be different from job data
    const jobExpiry = new Date(job.data.expiresAt)
    if (domain.expiresAt.getTime() !== jobExpiry.getTime()) {
      job.log('Domain expiry changed (likely renewed) — skipping stale reminder')
      return
    }

    // Get org owner email
    const ownerEmail = await getOrgOwnerEmail(orgId)
    if (!ownerEmail) {
      job.log(`No owner found for org ${orgId}`)
      return
    }

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    })

    await emailService.sendRenewalReminder({
      to: ownerEmail,
      orgName: org?.name ?? 'Your organization',
      domainName: domain.domainName,
      expiresAt: domain.expiresAt,
      daysLeft,
    })

    job.log(`Renewal reminder sent for ${domain.domainName} (${daysLeft}d)`)
  },
  {
    connection,
    concurrency: 10,
  },
)

// ─── Reconciliation job (runs daily via a simple setInterval) ─────────────────
// Catches domains whose BullMQ reminders were lost (e.g. Redis flush).

export function startReconciliation() {
  const INTERVAL_MS = 24 * 60 * 60 * 1000 // 24h

  async function reconcile() {
    const { scheduleRenewalReminders } = await import('./index.js')
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + 90) // next 90 days

    const expiring = await db.query.domains.findMany({
      where: (d, { lte, eq: eqFn, and }) =>
        and(lte(d.expiresAt, cutoff), eqFn(d.status, 'active')),
    })

    for (const domain of expiring) {
      await scheduleRenewalReminders(
        domain.id,
        domain.domainName,
        domain.orgId,
        domain.expiresAt,
      ).catch(console.error)
    }

    console.log(`[reconciliation] Checked ${expiring.length} domains expiring within 90 days`)
  }

  // Run once at startup (after short delay to let DB settle)
  setTimeout(reconcile, 30_000)
  // Then every 24h
  setInterval(reconcile, INTERVAL_MS)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrgOwnerEmail(orgId: string): Promise<string | null> {
  const membership = await db.query.orgMemberships.findFirst({
    where: (m, { eq: eqFn, and }) =>
      and(eqFn(m.orgId, orgId), eqFn(m.role, 'owner')),
    with: { user: true },
  })
  return (membership as any)?.user?.email ?? null
}

// ─── Error handlers ───────────────────────────────────────────────────────────

notificationWorker.on('failed', (job, err) => {
  console.error(`[notification-worker] Job ${job?.id} failed:`, err.message)
})

domainWorker.on('failed', (job, err) => {
  console.error(`[domain-worker] Job ${job?.id} failed:`, err.message)
})
