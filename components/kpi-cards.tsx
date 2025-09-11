import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PortfolioData } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, Target, BarChart3, Trophy, ArrowUpRight, ArrowDownRight } from 'lucide-react'

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

  // Calculate performance vs benchmarks
  const vsHisa = metrics.currentValue - metrics.hisaValue
  const vsSP500 = metrics.currentValue - metrics.sp500Value
  const isOutperforming = vsHisa > 0 && vsSP500 > 0
  const isUnderperforming = vsHisa < 0 && vsSP500 < 0

  const kpis = [
    {
      title: 'Total Contributed',
      value: formatCurrency(metrics.totalContributed),
      icon: DollarSign,
      description: 'Weekly deposits to TFSA',
      trend: 'neutral',
      badge: null
    },
    {
      title: 'Stock Portfolio',
      value: formatCurrency(metrics.stockValue),
      icon: Target,
      description: 'Stocks & ETFs',
      trend: 'neutral',
      badge: null
    },
    {
      title: 'Crypto Portfolio',
      value: formatCurrency(metrics.cryptoValue),
      icon: Target,
      description: 'Cryptocurrency holdings',
      trend: 'neutral',
      badge: null
    },
    {
      title: 'Best Performer',
      value: winner.name,
      icon: Trophy,
      description: (() => {
        const secondPlaceValue = Math.max(...performances.filter(p => p.name !== winner.name).map(p => p.value))
        const leadingAmount = winner.value - secondPlaceValue
        const leadingPercentage = ((leadingAmount / secondPlaceValue) * 100).toFixed(1)
        return `Leading by ${formatCurrency(leadingAmount)} (${leadingPercentage}%)`
      })(),
      trend: 'positive',
      badge: 'Winner'
    },
    {
      title: 'If HISA (3%)',
      value: formatCurrency(metrics.hisaValue),
      icon: BarChart3,
      description: 'High interest savings',
      trend: 'neutral',
      badge: null
    },
    {
      title: 'If S&P 500 DCA',
      value: formatCurrency(metrics.sp500Value),
      icon: BarChart3,
      description: 'S&P 500 dollar cost avg',
      trend: 'neutral',
      badge: null
    },
    {
      title: 'Current Value',
      value: formatCurrency(metrics.currentValue),
      icon: Target,
      description: 'Total portfolio value',
      trend: 'positive',
      badge: isOutperforming ? 'Outperforming' : isUnderperforming ? 'Underperforming' : null
    },
    {
      title: 'Unrealized P/L',
      value: `${formatCurrency(metrics.unrealizedPL)} (${percentageGainLoss}%)`,
      icon: metrics.unrealizedPL >= 0 ? TrendingUp : TrendingDown,
      description: 'Gain/loss vs contributions',
      trend: metrics.unrealizedPL >= 0 ? 'positive' : 'negative',
      badge: metrics.unrealizedPL >= 0 ? 'Gaining' : 'Losing'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpis.map((kpi, index) => (
        <Card key={index} className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.02] border-l-4 border-l-transparent hover:border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              {kpi.badge && (
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  kpi.badge === 'Outperforming' || kpi.badge === 'Gaining' || kpi.badge === 'Winner' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : kpi.badge === 'Underperforming' || kpi.badge === 'Losing'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                }`}>
                  {kpi.badge}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <kpi.icon className={`h-4 w-4 transition-colors ${
                kpi.trend === 'positive' ? 'text-green-500' : 
                kpi.trend === 'negative' ? 'text-red-500' : 
                'text-muted-foreground'
              }`} />
              {kpi.trend === 'positive' && (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              )}
              {kpi.trend === 'negative' && (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold transition-colors ${
              kpi.trend === 'positive' ? 'text-green-600 dark:text-green-400' : 
              kpi.trend === 'negative' ? 'text-red-600 dark:text-red-400' : 
              'text-foreground'
            }`}>
              {kpi.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {kpi.description}
            </p>
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}