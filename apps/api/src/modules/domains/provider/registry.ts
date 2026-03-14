import { config } from '../../../config.js'
import type { DomainProviderAdapter } from './adapter.interface.js'
import { NamecheapAdapter } from './namecheap.adapter.js'
import { MockDomainProvider } from './mock.adapter.js'

/**
 * Returns the configured domain provider adapter.
 *
 * For MVP all TLDs use the same provider. When adding a second registrar,
 * extend this function to select by TLD: e.g. getProvider('xyz') → OpenSRS.
 */
export function getProvider(_tld?: string): DomainProviderAdapter {
  if (config.PROVIDER === 'namecheap') {
    return new NamecheapAdapter({
      apiKey: config.PROVIDER_NAMECHEAP_API_KEY,
      apiUser: config.PROVIDER_NAMECHEAP_API_USER,
      clientIp: config.PROVIDER_NAMECHEAP_CLIENT_IP,
      sandbox: config.PROVIDER_NAMECHEAP_SANDBOX,
      defaultContact: {
        firstName: config.REGISTRANT_FIRST_NAME,
        lastName: config.REGISTRANT_LAST_NAME,
        email: config.REGISTRANT_EMAIL,
        phone: config.REGISTRANT_PHONE,
        address: config.REGISTRANT_ADDRESS,
        city: config.REGISTRANT_CITY,
        country: config.REGISTRANT_COUNTRY,
        postalCode: config.REGISTRANT_POSTAL_CODE,
      },
    })
  }

  // Default to mock for local development
  return new MockDomainProvider()
}
