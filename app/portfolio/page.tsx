import { PortfolioTable } from '@/components/portfolio-table'
import { AllocationChart } from '@/components/allocation-chart'
import { getHoldingsData } from '@/lib/data'

export default async function PortfolioPage() {
  const holdings = await getHoldingsData()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Current Portfolio</h1>
        <p className="text-muted-foreground">
          Holdings as of {new Date(holdings.as_of).toLocaleDateString()}
        </p>
      </div>

      <div className="bg-card rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Asset Allocation</h2>
        <AllocationChart holdings={holdings} />
      </div>
      
      <PortfolioTable holdings={holdings} />
    </div>
  )
}