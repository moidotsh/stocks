import { Timeline } from '@/components/timeline'
import { getEntriesData } from '@/lib/data'

export default async function TimelinePage() {
  const entries = await getEntriesData()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Trading Timeline</h1>
        <p className="text-muted-foreground">
          Detailed history of all weekly trades and contributions
        </p>
      </div>

      <Timeline entries={entries} />
    </div>
  )
}