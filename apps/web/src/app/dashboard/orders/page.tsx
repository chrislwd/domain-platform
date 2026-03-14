'use client'

import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { orderApi } from '@/lib/api'

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  partial_success: 'bg-yellow-100 text-yellow-700',
  pending: 'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  awaiting_review: 'bg-orange-100 text-orange-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
}

export default function OrdersPage() {
  const router = useRouter()
  const { data, isLoading } = useSWR('/orders', () => orderApi.list())

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold">Orders</h1>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-5 py-2">Order ID</th>
                <th className="text-left px-5 py-2">Status</th>
                <th className="text-right px-5 py-2">Estimated</th>
                <th className="text-right px-5 py-2">Captured</th>
                <th className="text-left px-5 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {(data as any)?.orders?.map((o: any) => (
                <tr key={o.id} onClick={() => router.push(`/dashboard/orders/${o.id}`)} className="border-t hover:bg-gray-50 cursor-pointer">
                  <td className="px-5 py-2 font-mono text-xs">{o.id.slice(0, 8)}...</td>
                  <td className="px-5 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[o.status] ?? ''}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-5 py-2 text-right">${o.totalEstimated}</td>
                  <td className="px-5 py-2 text-right">${o.totalCaptured}</td>
                  <td className="px-5 py-2 text-gray-500">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {!(data as any)?.orders?.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400">No orders yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
