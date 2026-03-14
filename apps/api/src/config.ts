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
