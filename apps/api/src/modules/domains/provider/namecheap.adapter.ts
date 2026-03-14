import { XMLParser } from 'fast-xml-parser'
import type {
  DomainProviderAdapter,
  DomainAvailabilityResult,
  DomainRegistrationResult,
  DomainRenewalResult,
  RegistrantContact,
} from './adapter.interface.js'

const SANDBOX_URL = 'https://api.sandbox.namecheap.com/xml.response'
const PROD_URL = 'https://api.namecheap.com/xml.response'

// Namecheap allows max 50 domains per availability check call
const AVAILABILITY_BATCH_SIZE = 50

export interface NamecheapConfig {
  apiKey: string
  apiUser: string
  clientIp: string
  sandbox: boolean
  /** Default registrant used when none is provided per-order */
  defaultContact: RegistrantContact
}

interface NamecheapErrorInfo {
  Number: string
  Description: string
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
})

export class NamecheapAdapter implements DomainProviderAdapter {
  readonly name = 'namecheap'

  private readonly baseUrl: string
  private readonly cfg: NamecheapConfig

  constructor(cfg: NamecheapConfig) {
    this.cfg = cfg
    this.baseUrl = cfg.sandbox ? SANDBOX_URL : PROD_URL
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private authParams(): URLSearchParams {
    return new URLSearchParams({
      ApiUser: this.cfg.apiUser,
      ApiKey: this.cfg.apiKey,
      UserName: this.cfg.apiUser,
      ClientIp: this.cfg.clientIp,
    })
  }

  private async callApi(
    command: string,
    extra: Record<string, string>,
    method: 'GET' | 'POST' = 'GET',
  ): Promise<any> {
    const params = this.authParams()
    params.set('Command', command)
    for (const [k, v] of Object.entries(extra)) params.set(k, v)

    const url = method === 'GET'
      ? `${this.baseUrl}?${params.toString()}`
      : this.baseUrl

    const res = await fetch(url, {
      method,
      ...(method === 'POST'
        ? { body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        : {}),
    })

    if (!res.ok) {
      throw new Error(`Namecheap HTTP ${res.status}: ${res.statusText}`)
    }

    const text = await res.text()
    const parsed = xmlParser.parse(text)
    const root = parsed?.ApiResponse

    if (!root) throw new Error('Namecheap: unexpected empty response')

    if (root['@_Status'] === 'ERROR') {
      const errors: NamecheapErrorInfo[] = [].concat(root.Errors?.Error ?? [])
      const msg = errors.map((e) => `[${e.Number}] ${e.Description}`).join('; ')
      throw new NamecheapApiError(msg, errors.map((e) => e.Number))
    }

    return root.CommandResponse
  }

  private contactParams(contact: RegistrantContact, prefix: string): Record<string, string> {
    return {
      [`${prefix}FirstName`]: contact.firstName,
      [`${prefix}LastName`]: contact.lastName,
      [`${prefix}Address1`]: contact.address,
      [`${prefix}City`]: contact.city,
      [`${prefix}Country`]: contact.country,
      [`${prefix}PostalCode`]: contact.postalCode,
      [`${prefix}Phone`]: contact.phone,
      [`${prefix}EmailAddress`]: contact.email,
      // StateProvince is optional but required for US
      ...(contact.country === 'US' ? { [`${prefix}StateProvince`]: 'NA' } : {}),
    }
  }

  // ─── DomainProviderAdapter ───────────────────────────────────────────────────

  /**
   * Check availability for up to 500 domains.
   * Automatically batches into groups of 50 (Namecheap limit).
   */
  async checkAvailability(domains: string[]): Promise<DomainAvailabilityResult[]> {
    const results: DomainAvailabilityResult[] = []

    for (let i = 0; i < domains.length; i += AVAILABILITY_BATCH_SIZE) {
      const batch = domains.slice(i, i + AVAILABILITY_BATCH_SIZE)
      const batchResults = await this.checkBatch(batch)
      results.push(...batchResults)
    }

    return results
  }

  private async checkBatch(domains: string[]): Promise<DomainAvailabilityResult[]> {
    let response: any

    try {
      response = await this.callApi('namecheap.domains.check', {
        DomainList: domains.join(','),
      })
    } catch (err) {
      // If the whole batch errors, mark all as 'error'
      return domains.map((d) => ({
        domainName: d,
        availabilityStatus: 'error',
        registrationPrice: 0,
        renewalPrice: 0,
        currency: 'usdt',
        restrictionNote: err instanceof Error ? err.message : 'Provider error',
      }))
    }

    const raw: any[] = [].concat(response?.DomainCheckResult ?? [])

    return raw.map((item) => {
      const available: boolean = item['@_Available'] === true || item['@_Available'] === 'true'
      const isPremium: boolean = item['@_IsPremiumName'] === true || item['@_IsPremiumName'] === 'true'

      // Namecheap returns prices in USD; we label currency as 'usd' here
      // and conversion to USDT can happen at the order layer if needed
      const regPrice = parseFloat(item['@_PremiumRegistrationPrice'] ?? item['@_Price'] ?? '0')
      const renewPrice = parseFloat(item['@_PremiumRenewPrice'] ?? item['@_RenewalPrice'] ?? '0')

      return {
        domainName: item['@_Domain'] as string,
        availabilityStatus: available ? 'available' : 'taken',
        registrationPrice: regPrice,
        renewalPrice: renewPrice,
        currency: 'usd',
        restrictionNote: isPremium ? 'Premium domain — higher price applies' : null,
      } satisfies DomainAvailabilityResult
    })
  }

  /**
   * Register a single domain. Throws on hard failure.
   */
  async registerDomain(params: {
    domainName: string
    years: number
    registrantContact: RegistrantContact
  }): Promise<DomainRegistrationResult> {
    const contact = params.registrantContact ?? this.cfg.defaultContact
    const [sld, ...tldParts] = params.domainName.split('.')
    const tld = tldParts.join('.')

    let response: any
    try {
      response = await this.callApi(
        'namecheap.domains.create',
        {
          DomainName: params.domainName,
          Years: String(params.years),
          // All four contacts share the same info for MVP
          ...this.contactParams(contact, 'Registrant'),
          ...this.contactParams(contact, 'Tech'),
          ...this.contactParams(contact, 'Admin'),
          ...this.contactParams(contact, 'AuxBilling'),
          // Namecheap requires SLD+TLD separately for some commands
          _sld: sld,
          _tld: tld,
        },
        'POST',
      )
    } catch (err) {
      return {
        success: false,
        providerOrderId: null,
        providerDomainId: null,
        registeredAt: null,
        expiresAt: null,
        failureReason: err instanceof Error ? err.message : 'Registration failed',
      }
    }

    const result = response?.DomainCreateResult
    if (!result || result['@_Registered'] !== true) {
      return {
        success: false,
        providerOrderId: null,
        providerDomainId: null,
        registeredAt: null,
        expiresAt: null,
        failureReason: 'Namecheap: domain not registered',
      }
    }

    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setFullYear(expiresAt.getFullYear() + params.years)

    return {
      success: true,
      providerOrderId: String(result['@_OrderID'] ?? ''),
      providerDomainId: String(result['@_DomainID'] ?? params.domainName),
      registeredAt: now,
      expiresAt,
      failureReason: null,
    }
  }

  /**
   * Renew an existing domain.
   */
  async renewDomain(params: {
    domainName: string
    providerDomainId: string
    years: number
  }): Promise<DomainRenewalResult> {
    let response: any
    try {
      response = await this.callApi('namecheap.domains.renew', {
        DomainName: params.domainName,
        Years: String(params.years),
      })
    } catch (err) {
      return {
        success: false,
        providerOrderId: null,
        newExpiresAt: null,
        failureReason: err instanceof Error ? err.message : 'Renewal failed',
      }
    }

    const result = response?.DomainRenewResult
    if (!result || result['@_Renew'] !== true) {
      return {
        success: false,
        providerOrderId: null,
        newExpiresAt: null,
        failureReason: 'Namecheap: renewal not confirmed',
      }
    }

    // Namecheap returns ExpiredDate in "MM/DD/YYYY HH:MM:SS" format
    const rawExpiry: string | undefined = result['@_ExpiredDate']
    let newExpiresAt: Date | null = null
    if (rawExpiry) {
      newExpiresAt = new Date(rawExpiry)
      if (isNaN(newExpiresAt.getTime())) {
        // Fallback: compute from now
        newExpiresAt = new Date()
        newExpiresAt.setFullYear(newExpiresAt.getFullYear() + params.years)
      }
    }

    return {
      success: true,
      providerOrderId: String(result['@_OrderID'] ?? ''),
      newExpiresAt,
      failureReason: null,
    }
  }

  /**
   * Update nameservers for a domain.
   */
  async updateNameservers(params: {
    domainName: string
    providerDomainId: string
    nameservers: string[]
  }): Promise<{ success: boolean; failureReason: string | null }> {
    const [sld, ...tldParts] = params.domainName.split('.')
    const tld = tldParts.join('.')

    try {
      await this.callApi('namecheap.domains.dns.setCustom', {
        SLD: sld,
        TLD: tld,
        Nameservers: params.nameservers.join(','),
      })
      return { success: true, failureReason: null }
    } catch (err) {
      return {
        success: false,
        failureReason: err instanceof Error ? err.message : 'Failed to update nameservers',
      }
    }
  }

  /**
   * Fetch live domain info from Namecheap (expiry, NS, status).
   * Not part of the base interface but useful for syncing portfolio.
   */
  async getDomainInfo(domainName: string): Promise<{
    expiresAt: Date | null
    nameservers: string[]
    isLocked: boolean
  }> {
    const response = await this.callApi('namecheap.domains.getInfo', {
      DomainName: domainName,
    })

    const info = response?.DomainGetInfoResult
    const expiry = info?.DomainDetails?.ExpiredDate
    const nsRaw: string[] = [].concat(info?.DnsDetails?.Nameserver ?? [])

    return {
      expiresAt: expiry ? new Date(expiry) : null,
      nameservers: nsRaw,
      isLocked: info?.['@_IsLocked'] === true,
    }
  }
}

export class NamecheapApiError extends Error {
  constructor(
    message: string,
    public readonly codes: string[],
  ) {
    super(`Namecheap API Error: ${message}`)
    this.name = 'NamecheapApiError'
  }
}
