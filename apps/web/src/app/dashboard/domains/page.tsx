'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { domainApi, templateApi } from '@/lib/api'
import type { Domain } from '@domain-platform/types'

// ─── Subcomponents ───────────────────────────────────────────────────────────

function RenewModal({
  domain,
  onClose,
}: {
  domain: Domain
  onClose: () => void
}) {
  const [years, setYears] = useState(1)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleRenew() {
    setLoading(true)
    setError('')
    try {
      const key = `renew-${domain.id}-${Date.now()}`
      await domainApi.renew(domain.id, years, key)
      setDone(true)
      mutate('/domains')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
        {done ? (
          <>
            <p className="text-green-700 font-medium">Renewal submitted!</p>
            <p className="text-sm text-gray-500">Your domain will be renewed shortly.</p>
            <button onClick={onClose} className="w-full bg-gray-100 rounded py-2 text-sm hover:bg-gray-200">Close</button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold">Renew {domain.domainName}</h2>
            <p className="text-sm text-gray-500">
              Current expiry: <strong>{new Date(domain.expiresAt).toLocaleDateString()}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Renewal period</label>
              <select
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {[1, 2, 3, 5].map((y) => (
                  <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border rounded py-2 text-sm hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleRenew}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Renew'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function TemplatePanel({
  selectedIds,
  onClose,
}: {
  selectedIds: string[]
  onClose: () => void
}) {
  const { data: templates = [], isLoading } = useSWR('/nameserver-templates', () => templateApi.list())
  const [newName, setNewName] = useState('')
  const [newNs, setNewNs] = useState('ns1.example.com\nns2.example.com')
  const [creating, setCreating] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const ns = newNs.split('\n').map((n) => n.trim()).filter(Boolean)
      await templateApi.create(newName.trim(), ns)
      setNewName('')
      mutate('/nameserver-templates')
    } finally {
      setCreating(false)
    }
  }

  async function handleApply(templateId: string) {
    if (!selectedIds.length) return
    setApplying(templateId)
    setResult(null)
    try {
      const res = await templateApi.apply(templateId, selectedIds)
      setResult(res)
      mutate('/domains')
    } finally {
      setApplying(null)
    }
  }

  async function handleDelete(id: string) {
    await templateApi.delete(id)
    mutate('/nameserver-templates')
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Nameserver Templates</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-5">
          {selectedIds.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
              {selectedIds.length} domain{selectedIds.length > 1 ? 's' : ''} selected — choose a template to apply
            </div>
          )}

          {/* Template list */}
          {isLoading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : (templates as any[]).length === 0 ? (
            <p className="text-sm text-gray-400">No templates yet. Create one below.</p>
          ) : (
            <div className="space-y-2">
              {(templates as any[]).map((tpl) => (
                <div key={tpl.id} className="border rounded-lg px-4 py-3 flex items-start gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{tpl.name}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{tpl.nameservers.join(' · ')}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {selectedIds.length > 0 && (
                      <button
                        onClick={() => handleApply(tpl.id)}
                        disabled={applying === tpl.id}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {applying === tpl.id ? 'Applying...' : 'Apply'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(tpl.id)}
                      className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result && (
            <div className={`rounded-lg px-4 py-3 text-sm ${result.failed === 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
              Applied "{result.templateName}" to {result.success} domain{result.success !== 1 ? 's' : ''}
              {result.failed > 0 && ` · ${result.failed} failed`}
            </div>
          )}

          {/* Create new */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium">New template</p>
            <input
              placeholder="Template name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              rows={3}
              placeholder={'ns1.example.com\nns2.example.com'}
              value={newNs}
              onChange={(e) => setNewNs(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="w-full bg-gray-800 text-white rounded py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000

export default function DomainsPage() {
  const [tab, setTab] = useState<'all' | 'expiring'>('all')
  const { data: allData, isLoading } = useSWR('/domains', () => domainApi.list())
  const { data: expiringData } = useSWR('/domains/expiring', () => domainApi.getExpiring(30))

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [renewTarget, setRenewTarget] = useState<Domain | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)

  const domains: Domain[] =
    tab === 'all' ? (allData as any)?.domains ?? [] : (expiringData as any) ?? []

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === domains.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(domains.map((d) => d.id)))
    }
  }

  function expiryBadge(d: Domain) {
    const days = Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / DAY)
    if (days < 0) return <span className="text-xs text-red-600 font-medium">Expired</span>
    if (days <= 7) return <span className="text-xs text-red-500">{days}d left</span>
    if (days <= 30) return <span className="text-xs text-yellow-600">{days}d left</span>
    return <span className="text-xs text-gray-400">{new Date(d.expiresAt).toLocaleDateString()}</span>
  }

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Domain Portfolio</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button
              onClick={() => setShowTemplates(true)}
              className="text-sm border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50"
            >
              NS Templates ({selected.size})
            </button>
          )}
          <button
            onClick={() => setShowTemplates(true)}
            className="text-sm bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-700"
          >
            Manage Templates
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        {(['all', 'expiring'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'all' ? 'All Domains' : 'Expiring in 30 days'}
            {t === 'expiring' && (expiringData as any)?.length > 0 && (
              <span className="ml-1.5 bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full">
                {(expiringData as any).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          {domains.length > 0 && (
            <div className="px-5 py-2.5 border-b bg-gray-50 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={selected.size === domains.length && domains.length > 0}
                onChange={toggleAll}
                className="accent-blue-600"
              />
              <span className="text-gray-500">
                {selected.size > 0 ? `${selected.size} selected` : `${domains.length} domains`}
              </span>
            </div>
          )}

          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="w-10 px-5 py-2"></th>
                <th className="text-left px-4 py-2">Domain</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Expires</th>
                <th className="text-left px-4 py-2">Nameservers</th>
                <th className="text-left px-4 py-2">Tags</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.id} className={`border-t hover:bg-gray-50 ${selected.has(d.id) ? 'bg-blue-50' : ''}`}>
                  <td className="px-5 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      className="accent-blue-600"
                    />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm font-medium">{d.domainName}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{expiryBadge(d)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 font-mono max-w-[200px] truncate">
                    {d.nameservers.length ? d.nameservers.join(', ') : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {d.tags.map((tag) => (
                        <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setRenewTarget(d)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Renew
                    </button>
                  </td>
                </tr>
              ))}
              {!domains.length && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                    {tab === 'all' ? 'No domains in portfolio yet' : 'No domains expiring in the next 30 days'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {renewTarget && (
        <RenewModal domain={renewTarget} onClose={() => setRenewTarget(null)} />
      )}

      {showTemplates && (
        <TemplatePanel
          selectedIds={Array.from(selected)}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  )
}
