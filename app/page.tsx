import { PortfolioDashboard } from '@/components/portfolio-dashboard'
import { getPortfolioData, getEntriesData } from '@/lib/data'

export default async function HomePage() {
  const [data, entries] = await Promise.all([
    getPortfolioData(),
    getEntriesData()
  ])

  // Calculate total weeks from entries
  const totalWeeks = entries.length

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Main dashboard with integrated controls */}
      <PortfolioDashboard 
        initialData={data} 
        totalWeeks={totalWeeks}
      />
    </div>
  )
}