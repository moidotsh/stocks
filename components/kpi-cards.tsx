import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PortfolioData } from '@/lib/types'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign, Target, BarChart3 } from 'lucide-react'

interface KpiCardsProps {
  data: PortfolioData
}

export function KpiCards({ data }: KpiCardsProps) {
  const { metrics } = data

  const kpis = [
    {
      title: 'Total Contributed',
      value: formatCurrency(metrics.totalContributed),
      icon: DollarSign,
      description: 'Weekly deposits to TFSA'
    },
    {
      title: 'Current Value',
      value: formatCurrency(metrics.currentValue),
      icon: Target,
      description: 'Market value + cash'
    },
    {
      title: 'Unrealized P/L',
      value: formatCurrency(metrics.unrealizedPL),
      icon: metrics.unrealizedPL >= 0 ? TrendingUp : TrendingDown,
      description: 'Gain/loss vs contributions',
      trend: metrics.unrealizedPL >= 0 ? 'positive' : 'negative'
    },
    {
      title: 'IRR (Money-Weighted)',
      value: formatPercent(metrics.irr),
      icon: BarChart3,
      description: 'Internal rate of return'
    },
    {
      title: 'TWR (Time-Weighted)',
      value: formatPercent(metrics.twr),
      icon: BarChart3,
      description: 'Performance vs timing'
    },
    {
      title: 'vs HISA (3%)',
      value: formatCurrency(metrics.deltaVsHisa),
      icon: metrics.deltaVsHisa >= 0 ? TrendingUp : TrendingDown,
      description: 'Outperformance vs HISA',
      trend: metrics.deltaVsHisa >= 0 ? 'positive' : 'negative'
    },
    {
      title: 'vs S&P 500 DCA',
      value: formatCurrency(metrics.deltaVsSP500),
      icon: metrics.deltaVsSP500 >= 0 ? TrendingUp : TrendingDown,
      description: 'Outperformance vs index',
      trend: metrics.deltaVsSP500 >= 0 ? 'positive' : 'negative'
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