export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      {/* Admin Layout with Ant Design will be implemented here */}
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Admin Dashboard</h2>
        {children}
      </div>
    </div>
  )
}
