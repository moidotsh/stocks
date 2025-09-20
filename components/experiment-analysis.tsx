'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, ReferenceLine, ComposedChart } from 'recharts'
import { PortfolioData } from '@/lib/types'
import { useCurrency } from '@/lib/currency-context'
import { TrendingUp, TrendingDown, Brain, Zap, Target, BarChart3, PieChart, Activity, DollarSign } from 'lucide-react'

interface ExperimentAnalysisProps {
  initialData: PortfolioData
}

interface WeeklyPerformance {
  week: number
  deposit: number
  stockValue: number
  cryptoValue: number
  totalValue: number
  stockReturn: number
  cryptoReturn: number
  sp500Return: number
  hisaReturn: number
}

interface DecisionQuality {
  week: number
  stockAccuracy: number // How well stock picks performed
  cryptoAccuracy: number // How well crypto picks performed
  overallWinRate: number
}

export function ExperimentAnalysis({ initialData }: ExperimentAnalysisProps) {
  const { formatCurrency, formatPercentage } = useCurrency()
  const [timeRange, setTimeRange] = useState<'all' | '30d' | '90d' | '1y'>('all')

  // Calculate weekly contribution schedule
  const weeklyContribution = (week: number) => 10 + (week - 1) * 1

  // Filter data based on time range
  const filteredData = useMemo(() => {
    if (timeRange === 'all') return initialData.chartData

    const now = new Date()
    const cutoffDays = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365
    const cutoffTime = now.getTime() - (cutoffDays * 24 * 60 * 60 * 1000)

    return initialData.chartData.filter(point => {
      const pointTime = new Date(point.date).getTime()
      return pointTime >= cutoffTime
    })
  }, [initialData.chartData, timeRange])

  // Calculate weekly performance metrics
  const weeklyPerformance = useMemo(() => {
    const weeklyData: WeeklyPerformance[] = []
    let weekCounter = 1

    // Group by weeks and calculate performance
    for (let i = 0; i < filteredData.length; i += 7) {
      const weekData = filteredData.slice(i, i + 7)
      if (weekData.length < 2) continue

      const firstPoint = weekData[0]
      const lastPoint = weekData[weekData.length - 1]

      const deposit = weeklyContribution(weekCounter)

      const stockReturn = firstPoint.stockPortfolio > 0
        ? ((lastPoint.stockPortfolio - firstPoint.stockPortfolio) / firstPoint.stockPortfolio)
        : 0

      const cryptoReturn = firstPoint.cryptoPortfolio > 0
        ? ((lastPoint.cryptoPortfolio - firstPoint.cryptoPortfolio) / firstPoint.cryptoPortfolio)
        : 0

      const sp500Return = firstPoint.sp500 > 0
        ? ((lastPoint.sp500 - firstPoint.sp500) / firstPoint.sp500)
        : 0

      const hisaReturn = firstPoint.hisa > 0
        ? ((lastPoint.hisa - firstPoint.hisa) / firstPoint.hisa)
        : 0

      weeklyData.push({
        week: weekCounter,
        deposit,
        stockValue: lastPoint.stockPortfolio,
        cryptoValue: lastPoint.cryptoPortfolio,
        totalValue: lastPoint.portfolio,
        stockReturn: stockReturn * 100,
        cryptoReturn: cryptoReturn * 100,
        sp500Return: sp500Return * 100,
        hisaReturn: hisaReturn * 100
      })

      weekCounter++
    }

    return weeklyData
  }, [filteredData])

  // Calculate LLM decision quality metrics
  const decisionQuality = useMemo(() => {
    return weeklyPerformance.map(week => {
      // Calculate "accuracy" as beating benchmarks
      const stockAccuracy = week.stockReturn > week.sp500Return ? 100 : 0
      const cryptoAccuracy = week.cryptoReturn > week.hisaReturn ? 100 : 0
      const overallWinRate = (week.stockReturn > week.sp500Return && week.cryptoReturn > week.hisaReturn) ? 100 : 50

      return {
        week: week.week,
        stockAccuracy,
        cryptoAccuracy,
        overallWinRate
      }
    })
  }, [weeklyPerformance])

  // Calculate contribution efficiency
  const contributionEfficiency = useMemo(() => {
    return weeklyPerformance.map(week => {
      const totalContributed = week.deposit * 2 // Split between stock and crypto
      const totalValue = week.stockValue + week.cryptoValue
      const efficiency = totalContributed > 0 ? ((totalValue - totalContributed) / totalContributed) * 100 : 0

      return {
        week: week.week,
        contribution: totalContributed,
        value: totalValue,
        efficiency,
        deposit: week.deposit
      }
    })
  }, [weeklyPerformance])

  // Calculate cumulative metrics
  const cumulativeMetrics = useMemo(() => {
    let totalContributed = 0
    let totalStockValue = 0
    let totalCryptoValue = 0

    return weeklyPerformance.map((week, index) => {
      totalContributed += week.deposit * 2
      totalStockValue = week.stockValue
      totalCryptoValue = week.cryptoValue

      return {
        week: week.week,
        totalContributed,
        totalStockValue,
        totalCryptoValue,
        totalValue: totalStockValue + totalCryptoValue,
        overallReturn: totalContributed > 0 ? ((totalStockValue + totalCryptoValue - totalContributed) / totalContributed) * 100 : 0
      }
    })
  }, [weeklyPerformance])

  // Calculate experiment statistics
  const experimentStats = useMemo(() => {
    const avgStockReturn = weeklyPerformance.reduce((sum, w) => sum + w.stockReturn, 0) / weeklyPerformance.length
    const avgCryptoReturn = weeklyPerformance.reduce((sum, w) => sum + w.cryptoReturn, 0) / weeklyPerformance.length
    const avgSp500Return = weeklyPerformance.reduce((sum, w) => sum + w.sp500Return, 0) / weeklyPerformance.length
    const avgHisaReturn = weeklyPerformance.reduce((sum, w) => sum + w.hisaReturn, 0) / weeklyPerformance.length

    const stockWinRate = (weeklyPerformance.filter(w => w.stockReturn > w.sp500Return).length / weeklyPerformance.length) * 100
    const cryptoWinRate = (weeklyPerformance.filter(w => w.cryptoReturn > w.hisaReturn).length / weeklyPerformance.length) * 100

    const bestStockWeek = weeklyPerformance.reduce((best, current) =>
      current.stockReturn > best.stockReturn ? current : best
    )

    const bestCryptoWeek = weeklyPerformance.reduce((best, current) =>
      current.cryptoReturn > best.cryptoReturn ? current : best
    )

    return {
      avgStockReturn,
      avgCryptoReturn,
      avgSp500Return,
      avgHisaReturn,
      stockWinRate,
      cryptoWinRate,
      bestStockWeek,
      bestCryptoWeek,
      totalWeeks: weeklyPerformance.length
    }
  }, [weeklyPerformance])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">LLM Investment Experiment Analysis</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Weekly LLM-driven investment decisions with linear contribution ramp
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="all">All Time</option>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
            <option value="1y">1 Year</option>
          </select>
        </div>
      </div>

      {/* Experiment Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weeks Active</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{experimentStats.totalWeeks}</div>
            <p className="text-xs text-muted-foreground">
              LLM decision cycles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${experimentStats.stockWinRate > 50 ? 'text-green-600' : 'text-red-600'}`}>
              {experimentStats.stockWinRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              vs S&P 500
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crypto Win Rate</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${experimentStats.cryptoWinRate > 50 ? 'text-green-600' : 'text-red-600'}`}>
              {experimentStats.cryptoWinRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              vs HISA
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Stock Week</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {experimentStats.bestStockWeek?.stockReturn.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Week {experimentStats.bestStockWeek?.week}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Performance: Stock vs Crypto vs Benchmarks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      stockReturn: 'Stock Portfolio',
                      cryptoReturn: 'Crypto Portfolio',
                      sp500Return: 'S&P 500',
                      hisaReturn: 'HISA (3%)'
                    }
                    return [`${value.toFixed(2)}%`, labels[name] || name]
                  }}
                  labelFormatter={(label) => `Week ${label}`}
                />
                <Legend />
                <Bar dataKey="stockReturn" fill="#3b82f6" name="Stock Portfolio" />
                <Bar dataKey="cryptoReturn" fill="#8b5cf6" name="Crypto Portfolio" />
                <Line
                  type="monotone"
                  dataKey="sp500Return"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="S&P 500"
                  strokeDasharray="5 5"
                />
                <Line
                  type="monotone"
                  dataKey="hisaReturn"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="HISA (3%)"
                  strokeDasharray="5 5"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contribution Efficiency */}
        <Card>
          <CardHeader>
            <CardTitle>Contribution Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={contributionEfficiency}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'efficiency') return [`${value.toFixed(2)}%`, 'Return on Contribution']
                      return [formatCurrency(value), name === 'contribution' ? 'Total Contributed' : 'Current Value']
                    }}
                    labelFormatter={(label) => `Week ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="efficiency"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* LLM Decision Quality */}
        <Card>
          <CardHeader>
            <CardTitle>LLM Decision Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={decisionQuality}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        stockAccuracy: 'Stock vs S&P 500',
                        cryptoAccuracy: 'Crypto vs HISA',
                        overallWinRate: 'Overall Win Rate'
                      }
                      return [`${value}%`, labels[name] || name]
                    }}
                    labelFormatter={(label) => `Week ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="stockAccuracy" fill="#3b82f6" name="Stock Accuracy" />
                  <Bar dataKey="cryptoAccuracy" fill="#8b5cf6" name="Crypto Accuracy" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cumulative Growth */}
      <Card>
        <CardHeader>
          <CardTitle>Cumulative Growth vs Contributions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      totalContributed: 'Total Contributed',
                      totalValue: 'Portfolio Value',
                      overallReturn: 'Overall Return'
                    }
                    return name === 'overallReturn' ? [`${value.toFixed(2)}%`, labels[name]] : [formatCurrency(value), labels[name]]
                  }}
                  labelFormatter={(label) => `Week ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="totalContributed"
                  stroke="#6b7280"
                  strokeWidth={2}
                  name="Total Contributed"
                />
                <Line
                  type="monotone"
                  dataKey="totalValue"
                  stroke="#10b981"
                  strokeWidth={3}
                  name="Portfolio Value"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Average Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Experiment Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="text-sm text-muted-foreground">Avg Stock Return</div>
              <div className={`text-2xl font-bold ${experimentStats.avgStockReturn > experimentStats.avgSp500Return ? 'text-green-600' : 'text-red-600'}`}>
                {experimentStats.avgStockReturn.toFixed(2)}%
              </div>
              <div className="text-xs text-muted-foreground">
                vs S&P 500: {experimentStats.avgSp500Return.toFixed(2)}%
              </div>
            </div>

            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <div className="text-sm text-muted-foreground">Avg Crypto Return</div>
              <div className={`text-2xl font-bold ${experimentStats.avgCryptoReturn > experimentStats.avgHisaReturn ? 'text-green-600' : 'text-red-600'}`}>
                {experimentStats.avgCryptoReturn.toFixed(2)}%
              </div>
              <div className="text-xs text-muted-foreground">
                vs HISA: {experimentStats.avgHisaReturn.toFixed(2)}%
              </div>
            </div>

            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-sm text-muted-foreground">Total Contributed</div>
              <div className="text-2xl font-bold">
                {formatCurrency(cumulativeMetrics[cumulativeMetrics.length - 1]?.totalContributed || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                Weekly linear ramp
              </div>
            </div>

            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
              <div className="text-sm text-muted-foreground">Current Value</div>
              <div className={`text-2xl font-bold ${cumulativeMetrics[cumulativeMetrics.length - 1]?.overallReturn > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(cumulativeMetrics[cumulativeMetrics.length - 1]?.totalValue || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {cumulativeMetrics[cumulativeMetrics.length - 1]?.overallReturn.toFixed(2)}% overall return
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}