import { Timeline } from '@/components/timeline'
import { getEntriesData, getCryptoEntriesData } from '@/lib/data'

export default async function TimelinePage() {
  const [entries, cryptoEntries] = await Promise.all([
    getEntriesData(),
    getCryptoEntriesData()
  ])

  // Combine all entries and sort by date
  const allEntries = [...entries, ...cryptoEntries].sort((a, b) => 
    new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Trading Timeline</h1>
        <p className="text-muted-foreground">
          Detailed history of all weekly trades and contributions
        </p>
      </div>

      <Timeline entries={allEntries} />
    </div>
  )
}