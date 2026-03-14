import { Resend } from 'resend'
import { config } from '../config.js'
import * as T from './templates.js'

let _resend: Resend | null = null

function resend(): Resend {
  if (!_resend) _resend = new Resend(config.RESEND_API_KEY)
  return _resend
}

async function send(to: string, subject: string, html: string) {
  if (!config.EMAIL_ENABLED) {
    // Log in dev so devs can see what would have been sent
    console.log(`[email] to=${to} subject="${subject}" (disabled — set EMAIL_ENABLED=true)`)
    return
  }

  await resend().emails.send({
    from: config.EMAIL_FROM,
    to,
    subject,
    html,
  })
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function sendDepositConfirmed(params: {
  to: string
  orgName: string
  amount: string
  chain: string
  txHash: string | null
  newBalance: string
}) {
  const { subject, html } = T.depositConfirmed({ ...params, appUrl: APP_URL })
  await send(params.to, subject, html)
}

export async function sendOrderCompleted(params: {
  to: string
  orgName: string
  orderId: string
  totalCharged: string
  successCount: number
  failedCount: number
}) {
  const { subject, html } = T.orderCompleted({ ...params, appUrl: APP_URL })
  await send(params.to, subject, html)
}

export async function sendOrderAwaitingReview(params: {
  to: string
  orgName: string
  orderId: string
  totalEstimated: string
  reason: string
}) {
  const { subject, html } = T.orderAwaitingReview({ ...params, appUrl: APP_URL })
  await send(params.to, subject, html)
}

export async function sendRenewalReminder(params: {
  to: string
  orgName: string
  domainName: string
  expiresAt: Date
  daysLeft: number
}) {
  const { subject, html } = T.renewalReminder({ ...params, appUrl: APP_URL })
  await send(params.to, subject, html)
}
