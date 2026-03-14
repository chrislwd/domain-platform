// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <tr><td style="background:#1d4ed8;padding:24px 32px">
          <span style="color:#fff;font-size:18px;font-weight:700">DomainPlatform</span>
        </td></tr>
        <tr><td style="padding:32px">
          ${body}
          <p style="margin:32px 0 0;padding-top:24px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px">
            You're receiving this because you have an account on DomainPlatform.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function btn(url: string, text: string) {
  return `<p style="margin:24px 0 0"><a href="${url}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">${text}</a></p>`
}

function h1(text: string) {
  return `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827">${text}</h1>`
}

function p(text: string) {
  return `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6">${text}</p>`
}

function mono(text: string) {
  return `<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:14px">${text}</code>`
}

function highlight(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 16px;color:#6b7280;font-size:14px;width:140px">${label}</td>
    <td style="padding:10px 16px;color:#111827;font-size:14px;font-weight:600">${value}</td>
  </tr>`
}

function table(...rows: string[]) {
  return `<table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;margin:16px 0">
    ${rows.join('')}
  </table>`
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function depositConfirmed(params: {
  orgName: string
  amount: string
  chain: string
  txHash: string | null
  newBalance: string
  appUrl: string
}): { subject: string; html: string } {
  return {
    subject: `Deposit confirmed — ${params.amount} USDT received`,
    html: layout('Deposit Confirmed', `
      ${h1('Deposit confirmed')}
      ${p(`Your USDT deposit has been confirmed and credited to your wallet.`)}
      ${table(
        highlight('Amount', `${params.amount} USDT`),
        highlight('Network', params.chain),
        highlight('New balance', `${params.newBalance} USDT`),
        params.txHash ? highlight('Tx hash', mono(params.txHash.slice(0, 20) + '…')) : '',
      )}
      ${btn(`${params.appUrl}/dashboard/wallet`, 'View Wallet')}
    `),
  }
}

export function orderCompleted(params: {
  orgName: string
  orderId: string
  totalCharged: string
  successCount: number
  failedCount: number
  appUrl: string
}): { subject: string; html: string } {
  const subject = params.failedCount === 0
    ? `Order complete — ${params.successCount} domain${params.successCount > 1 ? 's' : ''} registered`
    : `Order partially completed — ${params.successCount} registered, ${params.failedCount} failed`

  return {
    subject,
    html: layout('Order Completed', `
      ${h1(params.failedCount === 0 ? 'Order complete ✓' : 'Order partially completed')}
      ${p(params.failedCount === 0
        ? `All ${params.successCount} domain${params.successCount > 1 ? 's have' : ' has'} been successfully registered.`
        : `${params.successCount} domain${params.successCount > 1 ? 's were' : ' was'} registered. ${params.failedCount} failed and the funds have been refunded to your wallet.`
      )}
      ${table(
        highlight('Registered', `${params.successCount} domains`),
        params.failedCount > 0 ? highlight('Failed', `${params.failedCount} domains (refunded)`) : '',
        highlight('Charged', `${params.totalCharged} USDT`),
      )}
      ${btn(`${params.appUrl}/dashboard/orders/${params.orderId}`, 'View Order')}
    `),
  }
}

export function orderAwaitingReview(params: {
  orgName: string
  orderId: string
  totalEstimated: string
  reason: string
  appUrl: string
}): { subject: string; html: string } {
  return {
    subject: `Order under review — action required`,
    html: layout('Order Under Review', `
      ${h1('Your order is under review')}
      ${p('Your order has been flagged for manual review before processing. Our team will review it shortly.')}
      ${table(
        highlight('Order ID', mono(params.orderId.slice(0, 8) + '…')),
        highlight('Estimated total', `${params.totalEstimated} USDT`),
        highlight('Reason', params.reason),
      )}
      ${p('You will be notified once the review is complete. No funds have been charged yet.')}
      ${btn(`${params.appUrl}/dashboard/orders/${params.orderId}`, 'View Order')}
    `),
  }
}

export function renewalReminder(params: {
  orgName: string
  domainName: string
  expiresAt: Date
  daysLeft: number
  appUrl: string
}): { subject: string; html: string } {
  const urgency = params.daysLeft <= 7 ? '⚠️ Urgent: ' : ''
  return {
    subject: `${urgency}${params.domainName} expires in ${params.daysLeft} days`,
    html: layout('Renewal Reminder', `
      ${h1(`${params.domainName} expires in ${params.daysLeft} day${params.daysLeft > 1 ? 's' : ''}`)}
      ${p(`Your domain ${mono(params.domainName)} is set to expire on <strong>${params.expiresAt.toLocaleDateString('en-US', { dateStyle: 'long' })}</strong>.`)}
      ${params.daysLeft <= 7
        ? p('<strong style="color:#dc2626">This domain will expire very soon. Renew immediately to avoid losing it.</strong>')
        : p('Renew now to ensure uninterrupted service.')
      }
      ${btn(`${params.appUrl}/dashboard/domains`, 'Renew Now')}
    `),
  }
}
