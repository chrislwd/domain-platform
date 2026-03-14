import { Queue } from 'bullmq'
import { config } from '../config.js'

const connection = { url: config.REDIS_URL }

// ─── Queue definitions ────────────────────────────────────────────────────────

/** Transactional notifications: deposit confirmed, order completed, etc. */
export const notificationQueue = new Queue('notifications', { connection })

/**
 * Domain lifecycle jobs: renewal reminders scheduled with a delay.
 * Jobs are created when a domain is registered or renewed.
 */
export const domainQueue = new Queue('domain-jobs', { connection })

// ─── Job types ────────────────────────────────────────────────────────────────

export type NotificationJobName =
  | 'deposit_confirmed'
  | 'order_completed'
  | 'order_awaiting_review'

export interface DepositConfirmedJob {
  type: 'deposit_confirmed'
  to: string
  orgName: string
  amount: string
  chain: string
  txHash: string | null
  newBalance: string
}

export interface OrderCompletedJob {
  type: 'order_completed'
  to: string
  orgName: string
  orderId: string
  totalCharged: string
  successCount: number
  failedCount: number
}

export interface OrderAwaitingReviewJob {
  type: 'order_awaiting_review'
  to: string
  orgName: string
  orderId: string
  totalEstimated: string
  reason: string
}

export type NotificationJobData =
  | DepositConfirmedJob
  | OrderCompletedJob
  | OrderAwaitingReviewJob

export interface RenewalReminderJob {
  domainId: string
  orgId: string
  domainName: string
  expiresAt: string   // ISO string
  daysLeft: number
}

// ─── Scheduling helpers ───────────────────────────────────────────────────────

/**
 * Schedule renewal reminder jobs for a domain at 60d / 30d / 7d before expiry.
 * Replaces any existing reminders for this domain (idempotent).
 */
export async function scheduleRenewalReminders(
  domainId: string,
  domainName: string,
  orgId: string,
  expiresAt: Date,
) {
  const REMINDER_DAYS = [60, 30, 7]

  for (const days of REMINDER_DAYS) {
    const fireAt = new Date(expiresAt.getTime() - days * 24 * 60 * 60 * 1000)
    const delay = fireAt.getTime() - Date.now()

    if (delay <= 0) continue // already past — skip

    const jobId = `renewal-reminder:${domainId}:${days}d`

    // Remove old job if it exists (domain was renewed — reset schedule)
    await domainQueue.remove(jobId).catch(() => {})

    await domainQueue.add(
      'renewal_reminder',
      {
        domainId,
        orgId,
        domainName,
        expiresAt: expiresAt.toISOString(),
        daysLeft: days,
      } satisfies RenewalReminderJob,
      {
        jobId,
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: true,
      },
    )
  }
}

/** Enqueue a transactional notification (fire-and-forget with retries). */
export async function enqueueNotification(data: NotificationJobData) {
  await notificationQueue.add(data.type, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    removeOnComplete: true,
    removeOnFail: 100, // keep last 100 failures for inspection
  })
}
