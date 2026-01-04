export default function MobileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Layout with ShadcnUI will be implemented here */}
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
