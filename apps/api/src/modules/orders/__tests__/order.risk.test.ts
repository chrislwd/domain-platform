/**
 * Order risk evaluation tests.
 * Tests the pure logic that decides whether an order needs manual review.
 * No DB mock needed — we extract and test the logic directly.
 */
import { describe, it, expect } from 'vitest'

// ─── Extract risk logic for isolated testing ──────────────────────────────
// (mirrors evaluateRisk in order.service.ts)

interface RiskConfig {
  itemCountThreshold: number
  amountThreshold: number
}

function evaluateRisk(
  itemCount: number,
  totalAmount: number,
  orgRiskScore: number,
  cfg: RiskConfig,
): { needsReview: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (itemCount > cfg.itemCountThreshold) reasons.push(`item count ${itemCount} exceeds threshold`)
  if (totalAmount > cfg.amountThreshold) reasons.push(`amount ${totalAmount} exceeds threshold`)
  if (orgRiskScore >= 70) reasons.push(`org risk score ${orgRiskScore} is high`)
  return { needsReview: reasons.length > 0, reasons }
}

const cfg: RiskConfig = { itemCountThreshold: 50, amountThreshold: 5000 }

describe('Order risk evaluation', () => {
  describe('item count threshold', () => {
    it('passes when items <= threshold', () => {
      expect(evaluateRisk(50, 100, 0, cfg).needsReview).toBe(false)
    })

    it('flags when items > threshold', () => {
      const result = evaluateRisk(51, 100, 0, cfg)
      expect(result.needsReview).toBe(true)
      expect(result.reasons[0]).toMatch(/item count/)
    })

    it('flags exactly one over threshold', () => {
      expect(evaluateRisk(51, 0, 0, cfg).needsReview).toBe(true)
    })
  })

  describe('amount threshold', () => {
    it('passes when amount <= threshold', () => {
      expect(evaluateRisk(1, 5000, 0, cfg).needsReview).toBe(false)
    })

    it('flags when amount > threshold', () => {
      const result = evaluateRisk(1, 5001, 0, cfg)
      expect(result.needsReview).toBe(true)
      expect(result.reasons[0]).toMatch(/amount/)
    })
  })

  describe('org risk score', () => {
    it('passes when score < 70', () => {
      expect(evaluateRisk(1, 100, 69, cfg).needsReview).toBe(false)
    })

    it('flags when score = 70', () => {
      const result = evaluateRisk(1, 100, 70, cfg)
      expect(result.needsReview).toBe(true)
      expect(result.reasons[0]).toMatch(/risk score/)
    })

    it('flags when score > 70', () => {
      expect(evaluateRisk(1, 100, 100, cfg).needsReview).toBe(true)
    })
  })

  describe('multiple triggers', () => {
    it('reports all reasons when multiple rules fire', () => {
      const result = evaluateRisk(100, 10000, 80, cfg)
      expect(result.needsReview).toBe(true)
      expect(result.reasons).toHaveLength(3)
    })

    it('clean order with high item count but low amount and score passes', () => {
      expect(evaluateRisk(49, 4999, 0, cfg).needsReview).toBe(false)
    })
  })
})
