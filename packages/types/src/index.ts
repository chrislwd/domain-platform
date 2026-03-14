// User & Org
export type OrgRole = 'owner' | 'finance' | 'operator' | 'viewer'
export type PlatformRole = 'admin' | 'risk_reviewer' | 'ops'

export interface UserProfile {
  id: string
  email: string
  createdAt: string
}

export interface OrgMember {
  userId: string
  email: string
  role: OrgRole
}

// Wallet
export type DepositStatus = 'pending' | 'confirming' | 'completed' | 'failed'
export type LedgerEntryType = 'deposit' | 'freeze' | 'capture' | 'release' | 'refund' | 'adjustment'

export interface WalletBalance {
  availableBalance: string
  frozenBalance: string
  currency: 'usdt'
}

export interface LedgerEntry {
  id: string
  entryType: LedgerEntryType
  amount: string
  balanceAfter: string
  referenceType: string | null
  referenceId: string | null
  note: string | null
  createdAt: string
}

export interface Deposit {
  id: string
  depositAddress: string
  txHash: string | null
  network: string
  amount: string
  confirmations: number
  requiredConfirmations: number
  status: DepositStatus
  creditedAt: string | null
  createdAt: string
}

// Search
export type AvailabilityStatus = 'available' | 'taken' | 'reserved' | 'error'
export type SearchSessionStatus = 'in_progress' | 'complete' | 'partial_error'

export interface SearchResultItem {
  id: string
  domainName: string
  availabilityStatus: AvailabilityStatus
  registrationPrice: string
  renewalPrice: string
  currency: string
  providerName: string
  restrictionNote: string | null
  checkedAt: string
}

export interface SearchSession {
  id: string
  status: SearchSessionStatus
  totalCount: number
  results: SearchResultItem[]
  createdAt: string
}

// Orders
export type OrderStatus =
  | 'pending'
  | 'awaiting_review'
  | 'processing'
  | 'completed'
  | 'partial_success'
  | 'failed'
  | 'cancelled'

export type OrderItemStatus = 'pending' | 'processing' | 'success' | 'failed'

export interface OrderItem {
  id: string
  domainName: string
  status: OrderItemStatus
  registrationPrice: string
  years: number
  providerName: string | null
  providerOrderId: string | null
  failureReason: string | null
  processedAt: string | null
}

export interface Order {
  id: string
  status: OrderStatus
  totalEstimated: string
  totalCaptured: string
  riskReviewReason: string | null
  items: OrderItem[]
  createdAt: string
  updatedAt: string
}

// Domains
export type DomainStatus = 'active' | 'expired' | 'suspended' | 'transfer_out'

export interface Domain {
  id: string
  domainName: string
  tld: string
  providerName: string
  status: DomainStatus
  registeredAt: string
  expiresAt: string
  autoRenew: boolean
  nameservers: string[]
  tags: string[]
}

// Renewals
export type RenewalStatus = 'pending' | 'processing' | 'success' | 'failed'

export interface DomainRenewal {
  id: string
  domainId: string
  domainName: string
  status: RenewalStatus
  years: number
  price: string
  createdAt: string
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// API Error
export interface ApiError {
  code: string
  message: string
  details?: unknown
}
