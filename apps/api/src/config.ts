import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  RISK_ITEM_COUNT_THRESHOLD: z.coerce.number().default(50),
  RISK_AMOUNT_THRESHOLD: z.coerce.number().default(5000),

  DEPOSIT_REQUIRED_CONFIRMATIONS: z.coerce.number().default(6),

  // Hashnut payment gateway
  HASHNUT_MOCK: z.string().transform((v) => v === 'true').default('true'),
  HASHNUT_MCH_NO: z.string().default(''),
  HASHNUT_APP_ID: z.string().default(''),
  HASHNUT_SECRET_KEY: z.string().default(''),
  HASHNUT_BASE_URL: z.string().default('https://api.hashnut.io'),
  HASHNUT_SANDBOX_BASE_URL: z.string().default('https://testnet-api.hashnut.io'),
  HASHNUT_SANDBOX: z.string().transform((v) => v !== 'false').default('true'),
  // The public URL of this API server (used for Hashnut webhook notifyUrl)
  API_PUBLIC_URL: z.string().default('http://localhost:3001'),
  // Default deposit chain
  DEPOSIT_DEFAULT_CHAIN: z.enum(['TRC20', 'ERC20', 'BEP20']).default('TRC20'),

  // Email (Resend)
  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('noreply@yourdomain.com'),
  EMAIL_ENABLED: z.string().transform((v) => v === 'true').default('false'),

  // Provider selection: 'mock' | 'namecheap'
  PROVIDER: z.enum(['mock', 'namecheap']).default('mock'),

  // Namecheap
  PROVIDER_NAMECHEAP_API_KEY: z.string().default(''),
  PROVIDER_NAMECHEAP_API_USER: z.string().default(''),
  PROVIDER_NAMECHEAP_CLIENT_IP: z.string().default(''),
  PROVIDER_NAMECHEAP_SANDBOX: z.string().transform((v) => v !== 'false').default('true'),

  // Default registrant contact (used when org hasn't configured their own)
  REGISTRANT_FIRST_NAME: z.string().default('Domain'),
  REGISTRANT_LAST_NAME: z.string().default('Admin'),
  REGISTRANT_EMAIL: z.string().default('admin@example.com'),
  REGISTRANT_PHONE: z.string().default('+1.5555555555'),
  REGISTRANT_ADDRESS: z.string().default('123 Main St'),
  REGISTRANT_CITY: z.string().default('New York'),
  REGISTRANT_COUNTRY: z.string().default('US'),
  REGISTRANT_POSTAL_CODE: z.string().default('10001'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data
