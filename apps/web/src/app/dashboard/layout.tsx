'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CartProvider, useCart } from '@/context/cart'

const navItems = [
  { href: '/dashboard/wallet', label: 'Wallet' },
  { href: '/dashboard/search', label: 'Search Domains' },
  { href: '/dashboard/orders', label: 'Orders' },
  { href: '/dashboard/domains', label: 'Portfolio' },
]

function CartBadge() {
  const { items } = useCart()
  if (!items.length) return null
  return (
    <span className="ml-auto bg-blue-600 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
      {items.length}
    </span>
  )
}

function Nav() {
  const pathname = usePathname()
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-white border-r flex-shrink-0 flex flex-col">
        <div className="p-4 border-b">
          <span className="font-bold text-blue-600">DomainPlatform</span>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2 rounded text-sm hover:bg-gray-100 ${
                pathname.startsWith(item.href) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
              }`}
            >
              {item.label}
              {item.href === '/dashboard/search' && <CartBadge />}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t">
          <Link
            href="/admin"
            className="block px-3 py-2 rounded text-xs text-gray-400 hover:bg-gray-100"
          >
            Admin
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <CartProvider>
          <InnerLayout />
        </CartProvider>
      </main>
    </div>
  )
}

// CartProvider wraps the main content so the cart badge in Nav can read it
function InnerLayout() {
  return null // placeholder — actual content rendered by Next.js
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen">
        <aside className="w-56 bg-white border-r flex-shrink-0 flex flex-col">
          <div className="p-4 border-b">
            <span className="font-bold text-blue-600">DomainPlatform</span>
          </div>
          <nav className="p-3 space-y-1 flex-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center px-3 py-2 rounded text-sm text-gray-700 hover:bg-gray-100"
              >
                {item.label}
                {item.href === '/dashboard/search' && <CartBadge />}
              </Link>
            ))}
          </nav>
          <div className="p-3 border-t">
            <Link href="/admin" className="block px-3 py-2 rounded text-xs text-gray-400 hover:bg-gray-100">
              Admin
            </Link>
          </div>
        </aside>
        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>
    </CartProvider>
  )
}
