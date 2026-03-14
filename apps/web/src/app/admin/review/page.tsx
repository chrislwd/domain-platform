'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { api } from '@/lib/api'

export default function ReviewQueuePage() {
  const { data, isLoading } = useSWR('/platform/review-queue', () =>
    api.get<any>('/platform/review-queue'),
  )
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})

  async function approve(orderId: string) {
    setProcessing(orderId)
    try {
      await api.post(`/platform/orders/${orderId}/approve`, {})
      mutate('/platform/review-queue')
    } finally {
      setProcessing(null)
    }
  }

  async function reject(orderId: string) {
    const reason = rejectReason[orderId]?.trim()
    if (!reason) return
    setProcessing(orderId)
    try {
      await api.post(`/platform/orders/${orderId}/reject`, { reason })
      mutate('/platform/review-queue')
    } finally {
      setProcessing(null)
    }
  }

  const orders: any[] = data?.orders ?? []

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Review Queue</h1>
        <span className="text-sm text-gray-500">{orders.length} pending</span>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}

      {!isLoading && !orders.length && (
        <div className="bg-white border rounded-lg py-16 text-center text-gray-400">
          No orders awaiting review
        </div>
      )}

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="bg-white border rounded-lg overflow-hidden">
            <div className="px-5 py-4 flex items-start gap-4">
              <div className="flex-1 space-y-1">
                <p className="font-mono text-xs text-gray-400">{order.id}</p>
                <p className="text-sm">
                  <span className="font-medium">${order.totalEstimated} USDT</span>
                  <span className="text-gray-400 ml-2">·</span>
                  <span className="text-gray-500 ml-2">{new Date(order.createdAt).toLocaleString()}</span>
                </p>
                {order.riskReviewReason && (
                  <p className="text-sm text-orange-600 bg-orange-50 rounded px-2 py-1 inline-block">
                    ⚠ {order.riskReviewReason}
                  </p>
                )}
              </div>

              <div className="flex gap-2 items-start">
                <button
                  onClick={() => approve(order.id)}
                  disabled={processing === order.id}
                  className="bg-green-600 text-white text-sm px-4 py-1.5 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            </div>

            {/* Reject section */}
            <div className="px-5 pb-4 flex gap-2">
              <input
                type="text"
                placeholder="Reject reason..."
                value={rejectReason[order.id] ?? ''}
                onChange={(e) => setRejectReason((p) => ({ ...p, [order.id]: e.target.value }))}
                className="flex-1 border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400"
                onKeyDown={(e) => e.key === 'Enter' && reject(order.id)}
              />
              <button
                onClick={() => reject(order.id)}
                disabled={!rejectReason[order.id]?.trim() || processing === order.id}
                className="border border-red-300 text-red-600 text-sm px-4 py-1.5 rounded hover:bg-red-50 disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
