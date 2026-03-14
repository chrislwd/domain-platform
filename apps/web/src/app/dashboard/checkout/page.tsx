'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useCart } from '@/context/cart'
import { walletApi, orderApi } from '@/lib/api'
import crypto from 'crypto'

export default function CheckoutPage() {
  const router = useRouter()
  const cart = useCart()
  const { data: wallet } = useSWR('/wallet', () => walletApi.getBalance())

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const balance = parseFloat((wallet as any)?.availableBalance ?? '0')
  const total = parseFloat(cart.total)
  const hasEnough = balance >= total

  async function handleSubmit() {
    if (!cart.items.length) return
    setSubmitting(true)
    setError('')

    const idempotencyKey = `order-${Date.now()}-${Math.random().toString(36).slice(2)}`

    try {
      const order = await orderApi.create({
        idempotencyKey,
        items: cart.items.map((i) => ({
          domainName: i.domainName,
          years: i.years,
          registrationPrice: i.registrationPrice,
        })),
      }) as any

      cart.clear()
      router.push(`/dashboard/orders/${order.id}`)
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (!cart.items.length) {
    return (
      <div className="max-w-xl text-center py-20 space-y-3">
        <p className="text-gray-400">Your cart is empty.</p>
        <button onClick={() => router.push('/dashboard/search')} className="text-blue-600 hover:underline text-sm">
          ← Back to search
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 text-sm">←</button>
        <h1 className="text-2xl font-semibold">Checkout</h1>
      </div>

      {/* Order items */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b font-medium text-sm">
          {cart.items.length} domain{cart.items.length > 1 ? 's' : ''}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-5 py-2">Domain</th>
              <th className="text-center px-3 py-2">Years</th>
              <th className="text-right px-5 py-2">Price</th>
              <th className="w-8 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {cart.items.map((item) => (
              <tr key={item.domainName} className="border-t">
                <td className="px-5 py-2 font-mono">{item.domainName}</td>
                <td className="px-3 py-2 text-center">
                  <select
                    value={item.years}
                    onChange={(e) => {
                      // update years in cart — would need setItems exposed
                    }}
                    className="border rounded px-1 py-0.5 text-xs"
                  >
                    {[1, 2, 3, 5].map((y) => (
                      <option key={y} value={y}>{y}yr</option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-2 text-right font-medium">
                  ${(parseFloat(item.registrationPrice) * item.years).toFixed(2)}
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => cart.remove(item.domainName)}
                    className="text-gray-300 hover:text-red-500 text-lg leading-none"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-gray-50">
              <td colSpan={2} className="px-5 py-3 font-medium">Total</td>
              <td className="px-5 py-3 text-right font-bold text-lg">${cart.total} USDT</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Balance summary */}
      <div className={`rounded-lg border p-4 text-sm ${hasEnough ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex justify-between">
          <span className="text-gray-600">Available balance</span>
          <span className="font-medium">${balance.toFixed(2)} USDT</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-gray-600">Order total</span>
          <span className="font-medium">−${cart.total} USDT</span>
        </div>
        <div className="flex justify-between mt-2 pt-2 border-t border-current border-opacity-20">
          <span className="font-medium">After purchase</span>
          <span className={`font-bold ${hasEnough ? 'text-green-700' : 'text-red-600'}`}>
            ${(balance - total).toFixed(2)} USDT
          </span>
        </div>
        {!hasEnough && (
          <p className="mt-2 text-red-600 font-medium">
            Insufficient balance. <button onClick={() => router.push('/dashboard/wallet')} className="underline">Top up wallet →</button>
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !hasEnough}
        className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Placing order...' : `Place order · $${cart.total} USDT`}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Funds will be frozen until each domain is confirmed. Failed domains are automatically refunded.
      </p>
    </div>
  )
}
