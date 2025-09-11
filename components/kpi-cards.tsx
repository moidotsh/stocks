import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PortfolioData } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Trophy } from 'lucide-react'

interface KpiCardsProps {
  data: PortfolioData
}

export function KpiCards({ data }: KpiCardsProps) {
  const { metrics } = data

  // Calculate performance winner - comparing individual $10 portions
  const performances = [
    { name: 'Stock Portfolio', value: metrics.stockValue },
    { name: 'Crypto Portfolio', value: metrics.cryptoValue },
    { name: 'HISA (3%)', value: metrics.hisaValue / 2 }, // Half of total HISA for $10 comparison
    { name: 'S&P 500', value: metrics.sp500Value / 2 }   // Half of total S&P for $10 comparison
  ]
  
  const winner = performances.reduce((prev, current) => 
    current.value > prev.value ? current : prev
  )

  // Calculate percentage gain/loss for Unrealized P/L
  const percentageGainLoss = metrics.totalContributed > 0 
    ? ((metrics.unrealizedPL / metrics.totalContributed) * 100).toFixed(1)
    : '0.0'

  const kpis = [
    {
      title: 'Total Contributed',
      value: formatCurrency(metrics.totalContributed),
      icon: DollarSign,
      description: 'Weekly deposits to TFSA'
    },
    {
      title: 'Stock Portfolio',
      value: formatCurrency(metrics.stockValue),
      icon: Target,
      description: 'Stocks & ETFs'
    },
    {
      title: 'Crypto Portfolio',
      value: formatCurrency(metrics.cryptoValue),
      icon: Target,
      description: 'Cryptocurrency holdings'
    },
    {
      title: 'Best Performer',
      value: winner.name,
      icon: Trophy,
      description: `Leading by ${formatCurrency(winner.value - Math.max(...performances.filter(p => p.name !== winner.name).map(p => p.value)))}`
    },
    {
      title: 'If HISA (3%)',
      value: formatCurrency(metrics.hisaValue),
      icon: BarChart3,
      description: 'High interest savings'
    },
    {
      title: 'If S&P 500 DCA',
      value: formatCurrency(metrics.sp500Value),
      icon: BarChart3,
      description: 'S&P 500 dollar cost avg'
    },
    {
      title: 'Current Value',
      value: formatCurrency(metrics.currentValue),
      icon: Target,
      description: 'Total portfolio value'
    },
    {
      title: 'Unrealized P/L',
      value: `${formatCurrency(metrics.unrealizedPL)} (${percentageGainLoss}%)`,
      icon: metrics.unrealizedPL >= 0 ? TrendingUp : TrendingDown,
      description: 'Gain/loss vs contributions',
      trend: metrics.unrealizedPL >= 0 ? 'positive' : 'negative'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => (
        <Card key={index} className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
            <kpi.icon className={`h-4 w-4 ${
              kpi.trend === 'positive' ? 'text-green-500' : 
              kpi.trend === 'negative' ? 'text-red-500' : 
              'text-muted-foreground'
            }`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              kpi.trend === 'positive' ? 'text-green-500' : 
              kpi.trend === 'negative' ? 'text-red-500' : 
              ''
            }`}>
              {kpi.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpi.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}