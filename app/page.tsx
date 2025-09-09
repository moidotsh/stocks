import { KpiCards } from '@/components/kpi-cards'
import { PerformanceChart } from '@/components/performance-chart'
import { PriceRefreshButton } from '@/components/price-refresh-button'
import { SnapshotButton } from '@/components/snapshot-button'
import { getPortfolioData } from '@/lib/data'

export default async function HomePage() {
  const data = await getPortfolioData()

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Portfolio Overview</h1>
          <p className="text-muted-foreground">
            Track your TFSA performance against benchmarks
          </p>
        </div>
        <div className="flex gap-2">
          <SnapshotButton />
          <PriceRefreshButton />
        </div>
      </div>

      <KpiCards data={data} />
      
      <div className="bg-card rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Performance Comparison</h2>
        <PerformanceChart data={data} />
      </div>
    </div>
  )
}