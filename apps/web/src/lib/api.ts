const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message ?? 'Request failed')
  }

  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

// Auth
export const authApi = {
  register: (email: string, password: string) =>
    api.post<{ token: string; user: { id: string; email: string } }>('/auth/register', { email, password }),
  login: (email: string, password: string) =>
    api.post<{ token: string; user: { id: string; email: string } }>('/auth/login', { email, password }),
}

// Wallet
export const walletApi = {
  getBalance: () => api.get<{ availableBalance: string; frozenBalance: string }>('/wallet'),
  getDeposits: (page = 1) => api.get(`/wallet/deposits?page=${page}`),
  getLedger: (page = 1) => api.get(`/wallet/ledger?page=${page}`),
  createDeposit: (amount: string, chain: 'TRC20' | 'ERC20' | 'BEP20' = 'TRC20') =>
    api.post<{ id: string; paymentUrl?: string; depositAddress: string; requestedAmount: string }>(
      '/wallet/deposits',
      { amount, chain },
    ),
}

// Search
export const searchApi = {
  submit: (domains: string[]) => api.post<{ sessionId: string; totalCount: number }>('/search', { domains }),
  getSession: (sessionId: string) => api.get(`/search/${sessionId}`),
  listSessions: (page = 1) => api.get(`/search?page=${page}`),
}

// Orders
export const orderApi = {
  create: (data: { idempotencyKey: string; items: unknown[] }) => api.post('/orders', data),
  list: (page = 1) => api.get(`/orders?page=${page}`),
  get: (orderId: string) => api.get(`/orders/${orderId}`),
}

// Nameserver templates
export const templateApi = {
  list: () => api.get<any[]>('/nameserver-templates'),
  create: (name: string, nameservers: string[]) =>
    api.post<any>('/nameserver-templates', { name, nameservers }),
  update: (id: string, name: string, nameservers: string[]) =>
    api.patch<any>(`/nameserver-templates/${id}`, { name, nameservers }),
  delete: (id: string) => api.delete(`/nameserver-templates/${id}`),
  apply: (templateId: string, domainIds: string[]) =>
    api.post<any>(`/nameserver-templates/${templateId}/apply`, { domainIds }),
}

// Domains
export const domainApi = {
  list: (page = 1) => api.get(`/domains?page=${page}`),
  get: (domainId: string) => api.get(`/domains/${domainId}`),
  getExpiring: (days = 30) => api.get(`/domains/expiring?days=${days}`),
  updateNameservers: (domainId: string, nameservers: string[]) =>
    api.patch(`/domains/${domainId}/nameservers`, { nameservers }),
  bulkUpdateNameservers: (domainIds: string[], nameservers: string[]) =>
    api.post('/domains/bulk-update-nameservers', { domainIds, nameservers }),
  renew: (domainId: string, years: number, idempotencyKey: string) =>
    api.post(`/domains/${domainId}/renew`, { years, idempotencyKey }),
}
