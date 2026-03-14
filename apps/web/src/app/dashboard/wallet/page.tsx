'use client'

import useSWR from 'swr'
import { walletApi } from '@/lib/api'

export default function WalletPage() {
  const { data: wallet, isLoading } = useSWR('/wallet', () => walletApi.getBalance())
  const { data: deposits } = useSWR('/wallet/deposits', () => walletApi.getDeposits())

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Wallet</h1>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border rounded-lg p-5">
            <p className="text-sm text-gray-500">Available Balance</p>
            <p className="text-2xl font-bold mt-1">{wallet?.availableBalance ?? '—'} USDT</p>
          </div>
          <div className="bg-white border rounded-lg p-5">
            <p className="text-sm text-gray-500">Frozen Balance</p>
            <p className="text-2xl font-bold mt-1">{wallet?.frozenBalance ?? '—'} USDT</p>
          </div>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h2 className="font-medium">Deposit History</h2>
          <button
            onClick={() => walletApi.createDepositRequest().then(console.log)}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
          >
            New Deposit
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-5 py-2">Address</th>
              <th className="text-left px-5 py-2">Amount</th>
              <th className="text-left px-5 py-2">Status</th>
              <th className="text-left px-5 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {(deposits as any)?.deposits?.map((d: any) => (
              <tr key={d.id} className="border-t">
                <td className="px-5 py-2 font-mono text-xs">{d.depositAddress}</td>
                <td className="px-5 py-2">{d.amount ?? '—'} USDT</td>
                <td className="px-5 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    d.status === 'completed' ? 'bg-green-100 text-green-700' :
                    d.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>{d.status}</span>
                </td>
                <td className="px-5 py-2 text-gray-500">
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
