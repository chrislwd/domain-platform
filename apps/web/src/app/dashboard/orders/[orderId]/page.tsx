'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { orderApi } from '@/lib/api'

const ORDER_STATUS_STYLE: Record<string, string> = {
  completed:        'bg-green-100 text-green-700',
  partial_success:  'bg-yellow-100 text-yellow-700',
  pending:          'bg-blue-100 text-blue-700',
  processing:       'bg-blue-100 text-blue-700',
  awaiting_review:  'bg-orange-100 text-orange-700',
  failed:           'bg-red-100 text-red-600',
  cancelled:        'bg-gray-100 text-gray-500',
}

const ITEM_STATUS_STYLE: Record<string, string> = {
  success:    'text-green-600',
  failed:     'text-red-600',
  processing: 'text-blue-600',
  pending:    'text-gray-400',
}

const ITEM_ICON: Record<string, string> = {
  success:    '✓',
  failed:     '✕',
  processing: '⟳',
  pending:    '·',
}

const TERMINAL_STATUSES = new Set(['completed', 'partial_success', 'failed', 'cancelled'])

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const data = await orderApi.get(orderId) as any
        if (!cancelled) setOrder(data)

        // Keep polling until order reaches a terminal state
        if (!TERMINAL_STATUSES.has(data.status) && !cancelled) {
          await new Promise((r) => setTimeout(r, 2000))
          poll()
        }
      } catch {
        // stop polling on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [orderId])

  if (loading) return <div className="text-sm text-gray-400 py-10">Loading order...</div>
  if (!order) return <div className="text-sm text-red-500 py-10">Order not found.</div>

  const items: any[] = order.items ?? []
  const successCount = items.filter((i) => i.status === 'success').length
  const failedCount = items.filter((i) => i.status === 'failed').length
  const isTerminal = TERMINAL_STATUSES.has(order.status)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/orders')} className="text-gray-400 hover:text-gray-600 text-sm">←</button>
        <h1 className="text-xl font-semibold">Order Detail</h1>
      </div>

      {/* Summary card */}
      <div className="bg-white border rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-gray-400 font-mono">{order.id}</p>
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-sm font-medium ${ORDER_STATUS_STYLE[order.status] ?? ''}`}>
              {order.status.replace('_', ' ')}
            </span>
            {order.status === 'awaiting_review' && (
              <p className="text-sm text-orange-600 mt-1">
                This order is under review: <span className="italic">{order.riskReviewReason}</span>
              </p>
            )}
          </div>
          <div className="text-right text-sm space-y-0.5">
            <p className="text-gray-400">Estimated</p>
            <p className="font-bold">${order.totalEstimated} USDT</p>
            {order.totalCaptured !== '0' && (
              <>
                <p className="text-gray-400 mt-1">Charged</p>
                <p className="font-bold text-green-700">${order.totalCaptured} USDT</p>
              </>
            )}
          </div>
        </div>

        {items.length > 0 && (
          <div className="text-sm text-gray-500 flex gap-4">
            <span>{items.length} domains</span>
            {successCount > 0 && <span className="text-green-600">{successCount} registered</span>}
            {failedCount > 0 && <span className="text-red-500">{failedCount} failed</span>}
          </div>
        )}

        {!isTerminal && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <span className="animate-spin inline-block">⟳</span>
            Processing — refreshing automatically...
          </div>
        )}
      </div>

      {/* Items table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b font-medium text-sm">Domains</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left px-5 py-2">Domain</th>
              <th className="text-left px-5 py-2">Status</th>
              <th className="text-right px-5 py-2">Price</th>
              <th className="text-left px-5 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-5 py-2 font-mono">{item.domainName}</td>
                <td className="px-5 py-2">
                  <span className={`font-medium ${ITEM_STATUS_STYLE[item.status] ?? ''}`}>
                    {ITEM_ICON[item.status]} {item.status}
                  </span>
                </td>
                <td className="px-5 py-2 text-right">${item.registrationPrice}</td>
                <td className="px-5 py-2 text-gray-400 text-xs">{item.failureReason ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions after completion */}
      {(order.status === 'completed' || order.status === 'partial_success') && successCount > 0 && (
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/dashboard/domains')}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700"
          >
            View Portfolio →
          </button>
        </div>
      )}
    </div>
  )
}
