'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { walletApi } from '@/lib/api'

const STATUS_COLOR: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  confirming: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
}

export default function WalletPage() {
  const { data: wallet, isLoading } = useSWR('/wallet', () => walletApi.getBalance())
  const { data: depositsData } = useSWR('/wallet/deposits', () => walletApi.getDeposits())

  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositChain, setDepositChain] = useState<'TRC20' | 'ERC20' | 'BEP20'>('TRC20')
  const [pendingDeposit, setPendingDeposit] = useState<{
    depositAddress: string
    requestedAmount: string
    paymentUrl?: string
  } | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function handleCreateDeposit() {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return
    setCreating(true)
    setError('')
    try {
      const deposit = await walletApi.createDeposit(depositAmount, depositChain)
      setPendingDeposit(deposit)
      mutate('/wallet/deposits')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function closeModal() {
    setShowDepositModal(false)
    setPendingDeposit(null)
    setDepositAmount('')
    setError('')
  }

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

      {/* Deposit history */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h2 className="font-medium">Deposit History</h2>
          <button
            onClick={() => setShowDepositModal(true)}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
          >
            + Deposit USDT
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-5 py-2">Address</th>
              <th className="text-left px-5 py-2">Amount</th>
              <th className="text-left px-5 py-2">Chain</th>
              <th className="text-left px-5 py-2">Status</th>
              <th className="text-left px-5 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {(depositsData as any)?.deposits?.map((d: any) => (
              <tr key={d.id} className="border-t">
                <td className="px-5 py-2 font-mono text-xs truncate max-w-[160px]">
                  {d.depositAddress || '—'}
                </td>
                <td className="px-5 py-2">
                  {d.amount ?? d.requestedAmount} USDT
                </td>
                <td className="px-5 py-2 text-gray-500">{d.chain}</td>
                <td className="px-5 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLOR[d.status] ?? ''}`}>
                    {d.status}
                  </span>
                </td>
                <td className="px-5 py-2 text-gray-500">
                  {new Date(d.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {!(depositsData as any)?.deposits?.length && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-gray-400">No deposits yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Deposit modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            {!pendingDeposit ? (
              <>
                <h2 className="text-lg font-semibold">Deposit USDT</h2>
                <div>
                  <label className="block text-sm font-medium mb-1">Amount (USDT)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="100.00"
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Network</label>
                  <select
                    value={depositChain}
                    onChange={(e) => setDepositChain(e.target.value as any)}
                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="TRC20">TRON (TRC20) — recommended, lowest fees</option>
                    <option value="ERC20">Ethereum (ERC20)</option>
                    <option value="BEP20">BNB Chain (BEP20)</option>
                  </select>
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <div className="flex gap-3 justify-end">
                  <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateDeposit}
                    disabled={creating || !depositAmount}
                    className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Deposit'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Send USDT to complete deposit</h2>
                <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-3 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Amount to send</p>
                    <p className="font-bold text-lg">{pendingDeposit.requestedAmount} USDT</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Network</p>
                    <p className="font-medium">{depositChain}</p>
                  </div>
                  {pendingDeposit.depositAddress && (
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Deposit address</p>
                      <p className="font-mono text-xs break-all bg-white border rounded px-2 py-1">
                        {pendingDeposit.depositAddress}
                      </p>
                    </div>
                  )}
                  {pendingDeposit.paymentUrl && (
                    <a
                      href={pendingDeposit.paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center bg-blue-600 text-white rounded px-4 py-2 font-medium hover:bg-blue-700"
                    >
                      Open Payment Page
                    </a>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  Your balance will update automatically once the transaction is confirmed on-chain.
                </p>
                <div className="flex justify-end">
                  <button onClick={closeModal} className="px-4 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200">
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
