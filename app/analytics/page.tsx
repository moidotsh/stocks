import { CurrentStateAnalysis } from '@/components/current-state-analysis'
import { getPortfolioData, getCryptoEntriesData } from '@/lib/data'
import { getLastDataUpdate, formatDataAge } from '@/lib/data-utils'

export default async function AnalyticsPage() {
  const [data, cryptoEntries] = await Promise.all([
    getPortfolioData(),
    getCryptoEntriesData()
  ])
  const lastUpdate = await getLastDataUpdate()

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Analytics</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            TFSA investment performance and insights
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Last Updated</div>
          <div className="text-sm font-medium">
            {lastUpdate.toLocaleDateString()} • {formatDataAge(lastUpdate)}
          </div>
        </div>
      </div>
      <CurrentStateAnalysis initialData={data} cryptoEntries={cryptoEntries} />
    </div>
  )
}