import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users, organizations, orgMemberships, wallets, invitations } from '../../db/schema.js'
import { ConflictError, NotFoundError, UnauthorizedError } from '../../shared/errors.js'
import crypto from 'node:crypto'

// NOTE: use bcrypt or argon2 in production
async function hashPassword(password: string): Promise<string> {
  return crypto.createHash('sha256').update(password).digest('hex')
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return hashPassword(password).then((h) => h === hash)
}

export async function registerUser(email: string, password: string) {
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) throw new ConflictError('Email already registered')

  const [user] = await db.insert(users).values({
    email,
    passwordHash: await hashPassword(password),
  }).returning()

  return user
}

export async function loginUser(email: string, password: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (!user) throw new UnauthorizedError('Invalid credentials')

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw new UnauthorizedError('Invalid credentials')

  return user
}

export async function createOrganization(userId: string, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  const existing = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
  })
  if (existing) throw new ConflictError('Organization slug already taken')

  return db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name, slug }).returning()

    await tx.insert(orgMemberships).values({
      orgId: org.id,
      userId,
      role: 'owner',
    })

    await tx.insert(wallets).values({ orgId: org.id })

    return org
  })
}

export async function getUserOrgs(userId: string) {
  return db.query.orgMemberships.findMany({
    where: eq(orgMemberships.userId, userId),
    with: { org: true },
  })
}

export async function createInvitation(orgId: string, email: string, role: string) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const [invite] = await db.insert(invitations).values({
    orgId,
    email,
    role: role as any,
    token,
    expiresAt,
  }).returning()

  return invite
}

export async function acceptInvitation(token: string, userId: string) {
  const invite = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  })

  if (!invite) throw new NotFoundError('Invitation')
  if (invite.acceptedAt) throw new ConflictError('Invitation already accepted')
  if (invite.expiresAt < new Date()) throw new ConflictError('Invitation expired')

  return db.transaction(async (tx) => {
    await tx.insert(orgMemberships).values({
      orgId: invite.orgId,
      userId,
      role: invite.role,
    })

    await tx.update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invite.id))
  })
}
