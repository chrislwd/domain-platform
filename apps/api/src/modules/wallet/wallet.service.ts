import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { wallets, walletLedger, deposits } from '../../db/schema.js'
import { InsufficientBalanceError, NotFoundError, ConflictError } from '../../shared/errors.js'
import { HashnutClient } from './hashnut.client.js'
import { config } from '../../config.js'

function getHashnutClient(): HashnutClient {
  return new HashnutClient({
    mchNo: config.HASHNUT_MCH_NO,
    appId: config.HASHNUT_APP_ID,
    secretKey: config.HASHNUT_SECRET_KEY,
    baseUrl: config.HASHNUT_SANDBOX ? config.HASHNUT_SANDBOX_BASE_URL : config.HASHNUT_BASE_URL,
  })
}

export async function getWallet(orgId: string) {
  const wallet = await db.query.wallets.findFirst({ where: eq(wallets.orgId, orgId) })
  if (!wallet) throw new NotFoundError('Wallet')
  return wallet
}

export async function getLedger(orgId: string, page: number, pageSize: number) {
  const wallet = await getWallet(orgId)
  const offset = (page - 1) * pageSize

  const [entries, countResult] = await Promise.all([
    db.select().from(walletLedger)
      .where(eq(walletLedger.walletId, wallet.id))
      .orderBy(desc(walletLedger.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(walletLedger)
      .where(eq(walletLedger.walletId, wallet.id)),
  ])

  return { entries, total: Number(countResult[0]?.count ?? 0) }
}

/**
 * Freeze funds for a purchase order.
 * Uses SELECT FOR UPDATE to prevent concurrent over-draws.
 */
export async function freezeBalance(
  orgId: string,
  amount: string,
  referenceId: string,
  note?: string,
) {
  return db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.orgId, orgId))
      .for('update')

    if (!wallet) throw new NotFoundError('Wallet')

    const available = parseFloat(wallet.availableBalance)
    const freeze = parseFloat(amount)

    if (available < freeze) throw new InsufficientBalanceError()

    const newAvailable = (available - freeze).toFixed(6)
    const newFrozen = (parseFloat(wallet.frozenBalance) + freeze).toFixed(6)

    await tx.update(wallets)
      .set({ availableBalance: newAvailable, frozenBalance: newFrozen, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id))

    await tx.insert(walletLedger).values({
      walletId: wallet.id,
      orgId,
      entryType: 'freeze',
      amount: `-${amount}`,
      balanceAfter: newAvailable,
      referenceType: 'order',
      referenceId,
      note: note ?? 'Balance frozen for purchase order',
    })
  })
}

/**
 * Capture frozen funds after successful domain registration.
 */
export async function captureBalance(
  orgId: string,
  amount: string,
  referenceId: string,
) {
  return db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.orgId, orgId))
      .for('update')

    if (!wallet) throw new NotFoundError('Wallet')

    const newFrozen = (parseFloat(wallet.frozenBalance) - parseFloat(amount)).toFixed(6)

    await tx.update(wallets)
      .set({ frozenBalance: newFrozen, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id))

    await tx.insert(walletLedger).values({
      walletId: wallet.id,
      orgId,
      entryType: 'capture',
      amount: `-${amount}`,
      balanceAfter: wallet.availableBalance,
      referenceType: 'order',
      referenceId,
      note: 'Funds captured for successful domain registration',
    })
  })
}

/**
 * Release frozen funds back to available on failed item.
 */
export async function releaseBalance(
  orgId: string,
  amount: string,
  referenceId: string,
) {
  return db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.orgId, orgId))
      .for('update')

    if (!wallet) throw new NotFoundError('Wallet')

    const newAvailable = (parseFloat(wallet.availableBalance) + parseFloat(amount)).toFixed(6)
    const newFrozen = (parseFloat(wallet.frozenBalance) - parseFloat(amount)).toFixed(6)

    await tx.update(wallets)
      .set({ availableBalance: newAvailable, frozenBalance: newFrozen, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id))

    await tx.insert(walletLedger).values({
      walletId: wallet.id,
      orgId,
      entryType: 'release',
      amount,
      balanceAfter: newAvailable,
      referenceType: 'order',
      referenceId,
      note: 'Funds released from failed domain registration',
    })
  })
}

export async function getDeposits(orgId: string, page: number, pageSize: number) {
  const offset = (page - 1) * pageSize

  const [rows, countResult] = await Promise.all([
    db.select().from(deposits)
      .where(eq(deposits.orgId, orgId))
      .orderBy(desc(deposits.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` })
      .from(deposits)
      .where(eq(deposits.orgId, orgId)),
  ])

  return { deposits: rows, total: Number(countResult[0]?.count ?? 0) }
}

/**
 * Create a USDT deposit order via Hashnut.
 * Returns the Hashnut payment URL for the user to complete payment.
 */
export async function createDepositRequest(
  orgId: string,
  amount: string,
  chain: string = config.DEPOSIT_DEFAULT_CHAIN,
) {
  const wallet = await getWallet(orgId)

  // Create a preliminary DB record to get its ID as the merchant order ID
  const [deposit] = await db.insert(deposits).values({
    orgId,
    walletId: wallet.id,
    depositAddress: '',       // filled in after Hashnut responds
    network: chainToNetwork(chain),
    chain,
    requestedAmount: amount,
    status: 'pending',
  }).returning()

  const notifyUrl = `${config.API_PUBLIC_URL}/api/v1/webhooks/hashnut`

  try {
    const hashnut = getHashnutClient()
    const order = await hashnut.createOrder({
      merchantOrderId: deposit.id,
      amount,
      currency: 'USDT',
      chain,
      notifyUrl,
      subject: `USDT top-up for org ${orgId}`,
      expiredTime: 3600,
    })

    const expiresAt = order.expiresAt ? new Date(order.expiresAt) : new Date(Date.now() + 3600_000)

    const [updated] = await db.update(deposits)
      .set({
        hashnutOrderId: order.payOrderId,
        hashnutAccessSign: order.accessSign,
        paymentUrl: order.payUrl ?? null,
        depositAddress: order.payAddress ?? '',
        expiresAt,
      })
      .where(eq(deposits.id, deposit.id))
      .returning()

    return updated
  } catch (err) {
    // Roll back the pending record so the user can retry
    await db.delete(deposits).where(eq(deposits.id, deposit.id))
    throw err
  }
}

/**
 * Credit available balance after a confirmed deposit.
 * Called by the Hashnut webhook handler. Uses SELECT FOR UPDATE to be safe.
 */
export async function creditBalance(
  depositId: string,
  amount: string,
  txHash: string | null,
) {
  // Guard: only credit once
  const deposit = await db.query.deposits.findFirst({
    where: eq(deposits.id, depositId),
  })
  if (!deposit) throw new NotFoundError('Deposit')
  if (deposit.status === 'completed') return deposit // already credited — idempotent

  if (deposit.status !== 'pending' && deposit.status !== 'confirming') {
    throw new ConflictError(`Cannot credit deposit in status: ${deposit.status}`)
  }

  await db.transaction(async (tx) => {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.id, deposit.walletId))
      .for('update')

    const newAvailable = (parseFloat(wallet.availableBalance) + parseFloat(amount)).toFixed(6)

    await tx.update(wallets)
      .set({ availableBalance: newAvailable, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id))

    await tx.insert(walletLedger).values({
      walletId: wallet.id,
      orgId: deposit.orgId,
      entryType: 'deposit',
      amount,
      balanceAfter: newAvailable,
      referenceType: 'deposit',
      referenceId: depositId,
      note: `USDT deposit confirmed${txHash ? ` (tx: ${txHash})` : ''}`,
    })

    await tx.update(deposits)
      .set({
        status: 'completed',
        amount,
        txHash: txHash ?? null,
        creditedAt: new Date(),
      })
      .where(eq(deposits.id, depositId))
  })
}

/**
 * Mark a deposit as confirming (intermediate state while chain confirms).
 */
export async function markDepositConfirming(depositId: string) {
  await db.update(deposits)
    .set({ status: 'confirming' })
    .where(eq(deposits.id, depositId))
}

/**
 * Mark a deposit as failed or expired.
 */
export async function markDepositFailed(
  depositId: string,
  status: 'failed' | 'expired',
) {
  await db.update(deposits)
    .set({ status })
    .where(eq(deposits.id, depositId))
}

function chainToNetwork(chain: string): string {
  const map: Record<string, string> = {
    TRC20: 'tron',
    ERC20: 'ethereum',
    BEP20: 'bsc',
  }
  return map[chain] ?? chain.toLowerCase()
}
