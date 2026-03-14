/**
 * RBAC permission tests.
 * Pure logic — no mocks needed.
 */
import { describe, it, expect } from 'vitest'
import { requireMinRole, canManageMembers, canViewFinancials, canPlaceOrders } from '../../auth/../../shared/rbac.js'

describe('RBAC role checks', () => {
  describe('requireMinRole', () => {
    it('allows owner to do everything', () => {
      expect(() => requireMinRole('owner', 'owner')).not.toThrow()
      expect(() => requireMinRole('owner', 'finance')).not.toThrow()
      expect(() => requireMinRole('owner', 'operator')).not.toThrow()
      expect(() => requireMinRole('owner', 'viewer')).not.toThrow()
    })

    it('blocks viewer from operator-level actions', () => {
      expect(() => requireMinRole('viewer', 'operator')).toThrow('Requires operator role or above')
    })

    it('blocks viewer from finance-level actions', () => {
      expect(() => requireMinRole('viewer', 'finance')).toThrow()
    })

    it('allows operator to perform operator actions', () => {
      expect(() => requireMinRole('operator', 'operator')).not.toThrow()
    })

    it('blocks operator from finance-level actions', () => {
      expect(() => requireMinRole('operator', 'finance')).toThrow()
    })

    it('allows finance to perform operator actions', () => {
      expect(() => requireMinRole('finance', 'operator')).not.toThrow()
    })
  })

  describe('canManageMembers', () => {
    it('only owner can manage members', () => {
      expect(canManageMembers('owner')).toBe(true)
      expect(canManageMembers('finance')).toBe(false)
      expect(canManageMembers('operator')).toBe(false)
      expect(canManageMembers('viewer')).toBe(false)
    })
  })

  describe('canViewFinancials', () => {
    it('owner and finance can view financials', () => {
      expect(canViewFinancials('owner')).toBe(true)
      expect(canViewFinancials('finance')).toBe(true)
    })

    it('operator and viewer cannot', () => {
      expect(canViewFinancials('operator')).toBe(false)
      expect(canViewFinancials('viewer')).toBe(false)
    })
  })

  describe('canPlaceOrders', () => {
    it('owner, finance, operator can place orders', () => {
      expect(canPlaceOrders('owner')).toBe(true)
      expect(canPlaceOrders('finance')).toBe(true)
      expect(canPlaceOrders('operator')).toBe(true)
    })

    it('viewer cannot place orders', () => {
      expect(canPlaceOrders('viewer')).toBe(false)
    })
  })
})
