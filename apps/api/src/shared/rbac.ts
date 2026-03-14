import type { OrgRole } from '@domain-platform/types'
import { ForbiddenError } from './errors.js'

// Role hierarchy: owner > finance > operator > viewer
const ROLE_RANK: Record<OrgRole, number> = {
  owner: 4,
  finance: 3,
  operator: 2,
  viewer: 1,
}

export function requireMinRole(userRole: OrgRole, minRole: OrgRole): void {
  if (ROLE_RANK[userRole] < ROLE_RANK[minRole]) {
    throw new ForbiddenError(`Requires ${minRole} role or above`)
  }
}

export function canManageMembers(role: OrgRole): boolean {
  return role === 'owner'
}

export function canViewFinancials(role: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK['finance']
}

export function canPlaceOrders(role: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK['operator']
}
