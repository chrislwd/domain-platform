'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import type { SearchResultItem } from '@domain-platform/types'

export interface CartItem {
  searchResultId: string
  domainName: string
  registrationPrice: string
  years: number
}

interface CartContextValue {
  items: CartItem[]
  add: (result: SearchResultItem) => void
  remove: (domainName: string) => void
  clear: () => void
  total: string
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  const add = useCallback((result: SearchResultItem) => {
    setItems((prev) => {
      if (prev.find((i) => i.domainName === result.domainName)) return prev
      return [...prev, {
        searchResultId: result.id,
        domainName: result.domainName,
        registrationPrice: result.registrationPrice,
        years: 1,
      }]
    })
  }, [])

  const remove = useCallback((domainName: string) => {
    setItems((prev) => prev.filter((i) => i.domainName !== domainName))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const total = items
    .reduce((sum, i) => sum + parseFloat(i.registrationPrice) * i.years, 0)
    .toFixed(2)

  return (
    <CartContext.Provider value={{ items, add, remove, clear, total }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
