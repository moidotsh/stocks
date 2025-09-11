import { KpiCards } from '@/components/kpi-cards'
import { PerformanceChart } from '@/components/performance-chart'
import { PriceRefreshButton } from '@/components/price-refresh-button'
import { SnapshotButton } from '@/components/snapshot-button'
import { KpiCardsSkeleton } from '@/components/kpi-cards-skeleton'
import { PerformanceChartSkeleton } from '@/components/performance-chart-skeleton'
import { getPortfolioData } from '@/lib/data'
import { Suspense } from 'react'

export default async function HomePage() {
  const data = await getPortfolioData()

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start animate-slide-up">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">Portfolio Overview</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Track your TFSA performance against benchmarks
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <SnapshotButton />
          <PriceRefreshButton />
        </div>
      </div>

      <div className="animate-fade-in">
        <Suspense fallback={<KpiCardsSkeleton />}>
          <KpiCards data={data} />
        </Suspense>
      </div>
      
      <div className="bg-card rounded-2xl p-4 md:p-6 shadow-sm hover-lift animate-scale-in">
        <h2 className="text-lg md:text-xl font-semibold mb-4">Performance Comparison</h2>
        <Suspense fallback={<PerformanceChartSkeleton />}>
          <PerformanceChart data={data} />
        </Suspense>
      </div>
    </div>
  )
}