import { PortfolioDashboard } from '@/components/portfolio-dashboard'
import { getPortfolioData } from '@/lib/data'

export default async function HomePage() {
  const data = await getPortfolioData()

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Main dashboard with integrated controls */}
      <PortfolioDashboard initialData={data} />
    </div>
  )
}