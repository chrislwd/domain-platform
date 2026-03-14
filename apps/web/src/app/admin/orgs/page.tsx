'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'

export default function OrgsPage() {
  const { data, isLoading } = useSWR('/platform/orgs', () => api.get<any>('/platform/orgs'))
  const [editing, setEditing] = useState<string | null>(null)
  const [score, setScore] = useState<Record<string, string>>({})

  async function saveRiskScore(orgId: string) {
    const s = parseInt(score[orgId] ?? '')
    if (isNaN(s) || s < 0 || s > 100) return
    await api.patch(`/platform/orgs/${orgId}/risk-score`, { riskScore: s })
    mutate('/platform/orgs')
    setEditing(null)
  }

  const orgs: any[] = data?.orgs ?? []

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-xl font-semibold">Organizations</h1>

      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-2">Name</th>
              <th className="text-left px-5 py-2">Slug</th>
              <th className="text-left px-5 py-2">Status</th>
              <th className="text-left px-5 py-2">Risk Score</th>
              <th className="text-left px-5 py-2">Created</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id} className="border-t hover:bg-gray-50">
                <td className="px-5 py-2 font-medium">{org.name}</td>
                <td className="px-5 py-2 font-mono text-gray-400">{org.slug}</td>
                <td className="px-5 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    org.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {org.status}
                  </span>
                </td>
                <td className="px-5 py-2">
                  {editing === org.id ? (
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={score[org.id] ?? org.riskScore}
                        onChange={(e) => setScore((p) => ({ ...p, [org.id]: e.target.value }))}
                        className="w-16 border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                        onKeyDown={(e) => e.key === 'Enter' && saveRiskScore(org.id)}
                        autoFocus
                      />
                      <button onClick={() => saveRiskScore(org.id)} className="text-xs text-green-600">✓</button>
                      <button onClick={() => setEditing(null)} className="text-xs text-gray-400">✕</button>
                    </div>
                  ) : (
                    <span
                      onClick={() => { setEditing(org.id); setScore((p) => ({ ...p, [org.id]: String(org.riskScore) })) }}
                      className={`cursor-pointer px-2 py-0.5 rounded text-xs font-medium ${
                        org.riskScore >= 70 ? 'bg-red-100 text-red-700' :
                        org.riskScore >= 40 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}
                      title="Click to edit"
                    >
                      {org.riskScore}
                    </span>
                  )}
                </td>
                <td className="px-5 py-2 text-gray-400">{new Date(org.createdAt).toLocaleDateString()}</td>
                <td className="px-5 py-2"></td>
              </tr>
            ))}
            {!orgs.length && !isLoading && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No organizations</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
