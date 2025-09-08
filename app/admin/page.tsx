import { AdminForm } from '@/components/admin-form'

export default function AdminPage() {
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin</h1>
          <p className="text-muted-foreground">
            Data entry and management
          </p>
        </div>

        <div className="bg-card rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Production Mode</h2>
          <p className="mb-4">
            In production, data updates are made via pull requests to maintain 
            data integrity and version control.
          </p>
          
          <div className="space-y-4">
            <h3 className="font-semibold">Weekly Update Process:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Clone the repository locally</li>
              <li>Update <code>/data/entries.json</code> with new weekly entry</li>
              <li>Update current prices in <code>/data/holdings.json</code></li>
              <li>Add weekly S&P 500 level to <code>/data/benchmarks.json</code></li>
              <li>Run <code>npm run validate-data</code> to check data integrity</li>
              <li>Commit changes and create a pull request</li>
              <li>Deploy updates automatically via Vercel</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin</h1>
        <p className="text-muted-foreground">
          Add new weekly entries (development only)
        </p>
      </div>

      <AdminForm />
    </div>
  )
}