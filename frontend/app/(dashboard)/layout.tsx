// app/(dashboard)/layout.tsx  
import Sidebar from '@/components/layout/Sidebar'
import Header  from '@/components/layout/Header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      {/* Push content right of sidebar — sidebar is 60 or 240px */}
      <div className="lg:pl-60">
        <Header />
        <main className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl">
          {children}
        </main>
      </div>
    </div>
  )
}