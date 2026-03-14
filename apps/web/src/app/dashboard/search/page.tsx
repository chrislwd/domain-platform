'use client'

import { useState } from 'react'
import { searchApi } from '@/lib/api'
import type { SearchResultItem } from '@domain-platform/types'

export default function SearchPage() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  async function handleSearch() {
    const domains = input.split('\n').map((d) => d.trim()).filter(Boolean)
    if (!domains.length) return
    if (domains.length > 500) { setError('Maximum 500 domains'); return }

    setLoading(true)
    setError('')
    setResults([])
    setSelected(new Set())

    try {
      const { sessionId: sid } = await searchApi.submit(domains)
      setSessionId(sid)
      // Poll for results
      await pollSession(sid)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function pollSession(sid: string, attempts = 0) {
    if (attempts > 30) return
    const session = await searchApi.getSession(sid) as any
    setResults(session.results ?? [])
    if (session.status === 'in_progress') {
      await new Promise((r) => setTimeout(r, 1000))
      return pollSession(sid, attempts + 1)
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const available = results.filter((r) => r.availabilityStatus === 'available')

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Bulk Domain Search</h1>

      <div className="bg-white border rounded-lg p-5 space-y-3">
        <label className="block text-sm font-medium">
          Enter domains (one per line, max 500)
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          placeholder={'example.com\nexample.io\nexample.net'}
          className="w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          onClick={handleSearch}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Check Availability'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h2 className="font-medium">
              Results ({results.length}) &mdash; {available.length} available
            </h2>
            {selected.size > 0 && (
              <button className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">
                Add {selected.size} to cart
              </button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="w-8 px-4 py-2"></th>
                <th className="text-left px-4 py-2">Domain</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Reg. Price</th>
                <th className="text-right px-4 py-2">Renewal</th>
                <th className="text-left px-4 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">
                    {r.availabilityStatus === 'available' && (
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                      />
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono">{r.domainName}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      r.availabilityStatus === 'available' ? 'bg-green-100 text-green-700' :
                      r.availabilityStatus === 'taken' ? 'bg-gray-100 text-gray-600' :
                      'bg-red-100 text-red-600'
                    }`}>{r.availabilityStatus}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.registrationPrice ? `$${r.registrationPrice}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.renewalPrice ? `$${r.renewalPrice}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{r.restrictionNote ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
