import Link from 'next/link'

const navItems = [
  { href: '/dashboard/wallet', label: 'Wallet' },
  { href: '/dashboard/search', label: 'Search Domains' },
  { href: '/dashboard/orders', label: 'Orders' },
  { href: '/dashboard/domains', label: 'Portfolio' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-white border-r flex-shrink-0">
        <div className="p-4 border-b">
          <span className="font-bold text-blue-600">DomainPlatform</span>
        </div>
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded text-sm text-gray-700 hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
