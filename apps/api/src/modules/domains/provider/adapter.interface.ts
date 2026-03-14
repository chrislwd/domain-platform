export interface DomainAvailabilityResult {
  domainName: string
  availabilityStatus: 'available' | 'taken' | 'reserved' | 'error'
  registrationPrice: number
  renewalPrice: number
  currency: string
  restrictionNote: string | null
}

export interface DomainRegistrationResult {
  success: boolean
  providerOrderId: string | null
  providerDomainId: string | null
  registeredAt: Date | null
  expiresAt: Date | null
  failureReason: string | null
}

export interface DomainRenewalResult {
  success: boolean
  providerOrderId: string | null
  newExpiresAt: Date | null
  failureReason: string | null
}

/**
 * Interface that all domain registrar adapters must implement.
 * Business logic depends only on this interface, never on concrete providers.
 */
export interface DomainProviderAdapter {
  readonly name: string

  checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]>

  registerDomain(params: {
    domainName: string
    years: number
    registrantContact: RegistrantContact
  }): Promise<DomainRegistrationResult>

  renewDomain(params: {
    domainName: string
    providerDomainId: string
    years: number
  }): Promise<DomainRenewalResult>

  updateNameservers(params: {
    domainName: string
    providerDomainId: string
    nameservers: string[]
  }): Promise<{ success: boolean; failureReason: string | null }>
}

export interface RegistrantContact {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  city: string
  country: string
  postalCode: string
}
