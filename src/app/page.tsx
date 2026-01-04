export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold mb-4">ReplenOps</h1>
        <p className="text-lg text-muted-foreground">
          Enterprise Resource Planning System
        </p>
        <div className="mt-8 space-y-4">
          <a
            href="/admin"
            className="block px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            管理端入口 (PC)
          </a>
          <a
            href="/mobile"
            className="block px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
          >
            移动端入口 (Mobile)
          </a>
        </div>
      </div>
    </main>
  )
}
