'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { domainApi } from '@/lib/api'
import type { Domain } from '@domain-platform/types'

export default function DomainsPage() {
  const [tab, setTab] = useState<'all' | 'expiring'>('all')
  const { data: allData, isLoading } = useSWR('/domains', () => domainApi.list())
  const { data: expiringData } = useSWR('/domains/expiring', () => domainApi.getExpiring(30))

  const domains: Domain[] = tab === 'all'
    ? (allData as any)?.domains ?? []
    : (expiringData as any) ?? []

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Domain Portfolio</h1>
      </div>

      <div className="flex gap-2 border-b">
        {(['all', 'expiring'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            {t === 'all' ? 'All Domains' : 'Expiring Soon'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-5 py-2">Domain</th>
                <th className="text-left px-5 py-2">Status</th>
                <th className="text-left px-5 py-2">Provider</th>
                <th className="text-left px-5 py-2">Expires</th>
                <th className="text-left px-5 py-2">Nameservers</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.id} className="border-t hover:bg-gray-50">
                  <td className="px-5 py-2 font-mono">{d.domainName}</td>
                  <td className="px-5 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>{d.status}</span>
                  </td>
                  <td className="px-5 py-2 text-gray-500">{d.providerName}</td>
                  <td className="px-5 py-2 text-gray-500">
                    {new Date(d.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-2 text-xs text-gray-500">
                    {d.nameservers.length ? d.nameservers.join(', ') : '—'}
                  </td>
                  <td className="px-5 py-2">
                    <button
                      onClick={() => {
                        const idempotencyKey = `renew-${d.id}-${Date.now()}`
                        domainApi.renew(d.id, 1, idempotencyKey)
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Renew
                    </button>
                  </td>
                </tr>
              ))}
              {!domains.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    No domains in portfolio
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
