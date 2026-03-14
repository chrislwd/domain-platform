import Link from 'next/link'

const navItems = [
  { href: '/admin/review', label: 'Review Queue' },
  { href: '/admin/orgs', label: 'Organizations' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-52 bg-gray-900 text-gray-300 flex-shrink-0">
        <div className="p-4 border-b border-gray-700">
          <span className="font-bold text-white text-sm">Admin Console</span>
        </div>
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded text-sm hover:bg-gray-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/dashboard" className="block px-3 py-2 rounded text-xs text-gray-500 hover:text-gray-300 mt-4">
            ← Back to App
          </Link>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
