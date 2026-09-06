export default function MobilePageLoading() {
  return (
    <div role="status" aria-label="正在加载页面" aria-busy="true" className="min-w-0 p-4">
      <p className="mb-5 text-sm text-muted-foreground">正在加载...</p>
      <div aria-hidden="true">
        <div className="mb-5 h-10 rounded bg-muted" />
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex min-h-20 items-center gap-3 border-b py-4">
            <div className="h-12 w-12 shrink-0 rounded bg-muted" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-3 w-2/3 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
