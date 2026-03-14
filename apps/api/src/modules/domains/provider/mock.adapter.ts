/**
 * Mock provider adapter for local development and testing.
 * Replace with real adapter (e.g., namecheap.adapter.ts) when integrating.
 */
import type {
  DomainProviderAdapter,
  DomainAvailabilityResult,
  DomainRegistrationResult,
  DomainRenewalResult,
} from './adapter.interface.js'

export class MockDomainProvider implements DomainProviderAdapter {
  readonly name = 'mock'

  async checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]> {
    // Simulate: domains ending in .test are always taken
    return domains.map((domain) => ({
      domainName: domain,
      availabilityStatus: domain.endsWith('.test') ? 'taken' : 'available',
      registrationPrice: 12.99,
      renewalPrice: 14.99,
      currency: 'usdt',
      restrictionNote: null,
    }))
  }

  async registerDomain(params: { domainName: string; years: number }): Promise<DomainRegistrationResult> {
    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setFullYear(expiresAt.getFullYear() + params.years)

    return {
      success: true,
      providerOrderId: `mock-order-${Date.now()}`,
      providerDomainId: `mock-domain-${params.domainName}`,
      registeredAt: now,
      expiresAt,
      failureReason: null,
    }
  }

  async renewDomain(params: { domainName: string; providerDomainId: string; years: number }): Promise<DomainRenewalResult> {
    const newExpiresAt = new Date()
    newExpiresAt.setFullYear(newExpiresAt.getFullYear() + params.years)

    return {
      success: true,
      providerOrderId: `mock-renewal-${Date.now()}`,
      newExpiresAt,
      failureReason: null,
    }
  }

  async updateNameservers(): Promise<{ success: boolean; failureReason: null }> {
    return { success: true, failureReason: null }
  }
}
