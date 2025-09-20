import { ExperimentAnalysis } from '@/components/experiment-analysis'
import { getPortfolioData } from '@/lib/data'

export default async function ExperimentPage() {
  const data = await getPortfolioData()

  return (
    <div className="space-y-6 md:space-y-8">
      <ExperimentAnalysis initialData={data} />
    </div>
  )
}