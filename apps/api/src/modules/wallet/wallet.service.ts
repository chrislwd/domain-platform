import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { wallets, walletLedger, deposits } from '../../db/schema.js'
import { InsufficientBalanceError, NotFoundError } from '../../shared/errors.js'

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

export async function createDepositRequest(orgId: string) {
  const wallet = await getWallet(orgId)

  // In production: generate a unique USDT deposit address from your payment provider
  const depositAddress = `T_PLACEHOLDER_${orgId.slice(0, 8)}`

  const [deposit] = await db.insert(deposits).values({
    orgId,
    walletId: wallet.id,
    depositAddress,
    network: 'tron',
    requiredConfirmations: 6,
  }).returning()

  return deposit
}
