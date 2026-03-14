'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { searchApi } from '@/lib/api'
import { useCart } from '@/context/cart'
import type { SearchResultItem } from '@domain-platform/types'

const STATUS_STYLE: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  taken: 'bg-gray-100 text-gray-500',
  reserved: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-600',
}

export default function SearchPage() {
  const router = useRouter()
  const cart = useCart()

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [sessionStatus, setSessionStatus] = useState<string>('')
  const [error, setError] = useState('')

  const available = results.filter((r) => r.availabilityStatus === 'available')
  const inCart = new Set(cart.items.map((i) => i.domainName))

  async function handleSearch() {
    const domains = input.split('\n').map((d) => d.trim()).filter(Boolean)
    if (!domains.length) return
    if (domains.length > 500) { setError('Maximum 500 domains'); return }

    setLoading(true)
    setError('')
    setResults([])
    setSessionStatus('Submitting...')

    try {
      const { sessionId } = await searchApi.submit(domains)
      await pollSession(sessionId)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function pollSession(sid: string, attempt = 0) {
    if (attempt > 60) { setSessionStatus('Timed out'); return }
    const session = await searchApi.getSession(sid) as any
    setResults(session.results ?? [])
    setSessionStatus(session.status)
    if (session.status === 'in_progress') {
      await new Promise((r) => setTimeout(r, 1000))
      return pollSession(sid, attempt + 1)
    }
  }

  function toggleCart(result: SearchResultItem) {
    if (inCart.has(result.domainName)) {
      cart.remove(result.domainName)
    } else {
      cart.add(result)
    }
  }

  function selectAll() {
    available.forEach((r) => { if (!inCart.has(r.domainName)) cart.add(r) })
  }

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-semibold">Bulk Domain Search</h1>

      {/* Search input */}
      <div className="bg-white border rounded-lg p-5 space-y-3">
        <label className="block text-sm font-medium">
          Enter domains (one per line, max 500)
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          placeholder={'example.com\nexample.io\nexample.net'}
          className="w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSearch}
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Check Availability'}
          </button>
          {results.length > 0 && (
            <span className="text-sm text-gray-400">
              {sessionStatus === 'complete' ? `Done — ${results.length} results` : sessionStatus}
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center gap-3">
            <span className="font-medium flex-1">
              {available.length} available / {results.length} total
            </span>
            {available.length > 0 && (
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:underline"
              >
                Select all available
              </button>
            )}
            {cart.items.length > 0 && (
              <button
                onClick={() => router.push('/dashboard/checkout')}
                className="text-sm bg-green-600 text-white px-4 py-1.5 rounded hover:bg-green-700"
              >
                Checkout ({cart.items.length}) — ${cart.total}
              </button>
            )}
          </div>

          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="w-10 px-4 py-2"></th>
                <th className="text-left px-4 py-2">Domain</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Register</th>
                <th className="text-right px-4 py-2">Renew/yr</th>
                <th className="text-left px-4 py-2 text-xs">Note</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const isAvailable = r.availabilityStatus === 'available'
                const selected = inCart.has(r.domainName)
                return (
                  <tr
                    key={r.id}
                    onClick={() => isAvailable && toggleCart(r)}
                    className={`border-t ${isAvailable ? 'cursor-pointer hover:bg-gray-50' : ''} ${selected ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-4 py-2 text-center">
                      {isAvailable && (
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCart(r)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-blue-600"
                        />
                      )}
                    </td>
                    <td className="px-4 py-2 font-mono text-sm">{r.domainName}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.availabilityStatus]}`}>
                        {r.availabilityStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {r.registrationPrice ? `$${r.registrationPrice}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-500">
                      {r.renewalPrice ? `$${r.renewalPrice}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{r.restrictionNote ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating checkout bar */}
      {cart.items.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-xl shadow-xl px-6 py-3 flex items-center gap-6 z-40">
          <span className="text-sm">{cart.items.length} domain{cart.items.length > 1 ? 's' : ''} selected</span>
          <span className="text-sm font-bold">${cart.total} USDT</span>
          <button
            onClick={() => router.push('/dashboard/checkout')}
            className="bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium px-4 py-1.5 rounded-lg"
          >
            Proceed to checkout →
          </button>
        </div>
      )}
    </div>
  )
}
