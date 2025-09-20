'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { PortfolioData } from '@/lib/types'
import { useCurrency } from '@/lib/currency-context'
import { CONTRIBUTION_FORMULA } from '@/lib/contribution-utils'
import { calculateWeeklyPerformance } from '@/lib/weekly-performance'
import { TrendingUp, TrendingDown, Target, DollarSign, Activity, Brain, Zap, Clock, Calendar } from 'lucide-react'

interface CurrentStateAnalysisProps {
  initialData: PortfolioData
  cryptoEntries?: any[]
}

interface WeeklySummary {
  week: number
  date: string
  weeklyContribution: number
  weeklyPortfolioValue: number
  weeklyProfit: number
  weeklyReturn: number
  totalPurchaseValue: number
  trades: Array<{
    symbol: string
    qty: number
    purchasePrice: number
    currentPrice: number
    profit: number
  }>
}

export function CurrentStateAnalysis({ initialData, cryptoEntries = [] }: CurrentStateAnalysisProps) {
  const { formatCurrency, formatPercentage } = useCurrency()

  // Current week calculation using formula
  const currentWeek = CONTRIBUTION_FORMULA.getWeekNumber()
  const currentContribution = CONTRIBUTION_FORMULA.getContributionPerPortfolio(currentWeek)

  // Calculate weekly performance from actual trades
  const weeklySummaries = useMemo(() => {
    const performanceData = calculateWeeklyPerformance(initialData, cryptoEntries)

    return performanceData.map(week => ({
      week: week.week,
      date: week.date,
      weeklyContribution: week.weeklyContribution,
      weeklyPortfolioValue: week.totalCurrentValue,
      weeklyProfit: week.totalProfit,
      weeklyReturn: week.totalReturn,
      totalPurchaseValue: week.totalPurchaseValue,
      trades: week.trades.map(trade => ({
        symbol: trade.symbol,
        qty: trade.qty,
        purchasePrice: trade.purchasePrice,
        currentPrice: trade.currentPrice,
        profit: trade.profit
      }))
    }))
  }, [initialData, cryptoEntries])

  // Current holdings analysis
  const currentHoldings = useMemo(() => {
    const { holdings } = initialData

    // Stock holdings
    const stockPositions = holdings.positions.map(pos => ({
      ticker: pos.ticker,
      shares: pos.shares,
      avgCost: pos.avg_cost,
      currentPrice: pos.market_price,
      value: pos.shares * pos.market_price,
      unrealizedPL: (pos.market_price - pos.avg_cost) * pos.shares,
      returnPercentage: ((pos.market_price - pos.avg_cost) / pos.avg_cost) * 100
    }))

    // Crypto holdings
    const cryptoPositions = (holdings.crypto_positions || []).map(pos => ({
      symbol: pos.symbol,
      qty: pos.qty,
      avgCost: pos.avg_cost,
      currentPrice: pos.current_price,
      value: pos.qty * pos.current_price,
      unrealizedPL: (pos.current_price - pos.avg_cost) * pos.qty,
      returnPercentage: ((pos.current_price - pos.avg_cost) / pos.avg_cost) * 100
    }))

    return { stockPositions, cryptoPositions }
  }, [initialData.holdings])

  // Calculate what current week contribution should be
  const nextWeekInfo = useMemo(() => {
    return {
      week: currentWeek,
      dateRange: CONTRIBUTION_FORMULA.getWeekDateRange(currentWeek),
      totalContribution: CONTRIBUTION_FORMULA.getTotalContribution(currentWeek),
      eachPortfolio: CONTRIBUTION_FORMULA.getContributionPerPortfolio(currentWeek),
      daysUntil: Math.ceil((new Date('2025-09-21').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    }
  }, [currentWeek])

  // Performance vs benchmarks (current)
  const latestData = initialData.chartData[initialData.chartData.length - 1]
  const benchmarkComparison = useMemo(() => {
    const totalContributed = CONTRIBUTION_FORMULA.getHistoricalTotalContributed(currentWeek)
    const portfolioReturn = latestData?.portfolio > 0
      ? ((latestData.portfolio - totalContributed) / totalContributed) * 100
      : 0

    const sp500Return = latestData?.sp500 > 0
      ? ((latestData.sp500 - totalContributed) / totalContributed) * 100
      : 0

    const hisaReturn = latestData?.hisa > 0
      ? ((latestData.hisa - totalContributed) / totalContributed) * 100
      : 0

    return {
      portfolioReturn,
      sp500Return,
      hisaReturn,
      outperformingSP500: portfolioReturn > sp500Return,
      outperformingHISA: portfolioReturn > hisaReturn
    }
  }, [latestData, currentWeek])

  // Best/Worst performers
  const performers = useMemo(() => {
    const allPositions = [
      ...currentHoldings.stockPositions.map(p => ({ ...p, type: 'stock' as const })),
      ...currentHoldings.cryptoPositions.map(p => ({ ...p, type: 'crypto' as const, symbol: p.symbol }))
    ]

    const best = allPositions.reduce((best, current) =>
      current.returnPercentage > best.returnPercentage ? current : best
    )

    const worst = allPositions.reduce((worst, current) =>
      current.returnPercentage < worst.returnPercentage ? current : worst
    )

    return { best, worst }
  }, [currentHoldings])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold">TFSA Experiment: Current State</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Week {currentWeek} starting tomorrow • LLM-driven investment experiment
        </p>
      </div>

      {/* Key Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Week {currentWeek}</div>
            <p className="text-xs text-muted-foreground">
              {nextWeekInfo.dateRange}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Contribution</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(nextWeekInfo.totalContribution)}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(nextWeekInfo.eachPortfolio)} each portfolio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(latestData?.portfolio || 0)}</div>
            <p className="text-xs text-muted-foreground">
              ${((latestData?.portfolio || 0) - CONTRIBUTION_FORMULA.getHistoricalTotalContributed(currentWeek)).toFixed(2)} P/L
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">vs Benchmarks</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Your Portfolio:</span>
                <Badge variant={benchmarkComparison.portfolioReturn >= 0 ? "default" : "secondary"}>
                  {benchmarkComparison.portfolioReturn.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">vs S&P 500:</span>
                <Badge variant={benchmarkComparison.outperformingSP500 ? "default" : "secondary"}>
                  {benchmarkComparison.sp500Return.toFixed(1)}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">vs HISA:</span>
                <Badge variant={benchmarkComparison.outperformingHISA ? "default" : "secondary"}>
                  {benchmarkComparison.hisaReturn.toFixed(1)}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Progress Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {weeklySummaries.map((week) => (
              <div key={week.week} className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Week {week.week}</h4>
                  <span className="text-sm text-muted-foreground">{week.date}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Invested:</span>
                    <span className="font-medium">{formatCurrency(week.totalPurchaseValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Current Value:</span>
                    <span className={`font-medium ${week.weeklyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(week.weeklyPortfolioValue)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Profit/Loss:</span>
                    <span className={`font-medium ${week.weeklyProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(week.weeklyProfit)} ({week.weeklyReturn.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {week.trades.length} trades this week
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklySummaries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'Current Value') return [formatCurrency(value), 'Current value of trades made this week']
                    if (name === 'Amount Invested') return [formatCurrency(value), 'Total amount invested in trades this week']
                    return [value, name]
                  }}
                />
                <Legend />
                <Bar dataKey="totalPurchaseValue" fill="#6b7280" name="Amount Invested" />
                <Bar dataKey="weeklyPortfolioValue" fill="#10b981" name="Current Value" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Holdings Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Current Holdings Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="text-sm text-muted-foreground">Best Performer</div>
                  <div className="font-bold text-green-600">
                    {performers.best.type === 'stock' ? performers.best.ticker : performers.best.symbol}
                  </div>
                  <div className="text-xs">
                    {performers.best.returnPercentage.toFixed(1)}%
                  </div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <div className="text-sm text-muted-foreground">Worst Performer</div>
                  <div className="font-bold text-red-600">
                    {performers.worst.type === 'stock' ? performers.worst.ticker : performers.worst.symbol}
                  </div>
                  <div className="text-xs">
                    {performers.worst.returnPercentage.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Stock Holdings</h4>
                {currentHoldings.stockPositions.map(pos => (
                  <div key={pos.ticker} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span className="font-medium">{pos.ticker}</span>
                    <div className="text-right">
                      <div className={pos.returnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {pos.returnPercentage.toFixed(1)}%
                      </div>
                      <div className="text-xs">{formatCurrency(pos.value)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="font-medium">Crypto Holdings</h4>
                {currentHoldings.cryptoPositions.map(pos => (
                  <div key={pos.symbol} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span className="font-medium">{pos.symbol}</span>
                    <div className="text-right">
                      <div className={pos.returnPercentage >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {pos.returnPercentage.toFixed(1)}%
                      </div>
                      <div className="text-xs">{formatCurrency(pos.value)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Next Week Planning */}
        <Card>
          <CardHeader>
            <CardTitle>Week {nextWeekInfo.week} Planning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="text-sm text-muted-foreground">Contribution Schedule</div>
                <div className="text-2xl font-bold">{formatCurrency(nextWeekInfo.totalContribution)}</div>
                <div className="text-xs">
                  {formatCurrency(nextWeekInfo.eachPortfolio)} to each portfolio
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {nextWeekInfo.dateRange}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    <span className="font-medium">LLM Status</span>
                  </div>
                  <Badge variant="outline">Awaiting candidates</Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Days Until</span>
                  </div>
                  <span className="font-bold">{nextWeekInfo.daysUntil} days</span>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    <span className="font-medium">Action Required</span>
                  </div>
                  <span className="text-sm">Run screeners Sunday</span>
                </div>
              </div>

              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Next Steps</h4>
                <ol className="text-xs space-y-1 text-yellow-700 dark:text-yellow-300">
                  <li>1. Sunday: Run screeners for fresh candidates</li>
                  <li>2. Use LLM Workflow page for recommendations</li>
                  <li>3. Execute trades on Wealthsimple</li>
                  <li>4. Record actual fills</li>
                  <li>5. Complete week for timeline snapshot</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Experiment Status Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4">
              <div className="text-sm text-muted-foreground">Total Weeks</div>
              <div className="text-2xl font-bold">{weeklySummaries.length}</div>
              <div className="text-xs">Active investment weeks</div>
            </div>

            <div className="text-center p-4">
              <div className="text-sm text-muted-foreground">Total Contributed</div>
              <div className="text-2xl font-bold">{formatCurrency(CONTRIBUTION_FORMULA.getHistoricalTotalContributed(currentWeek))}</div>
              <div className="text-xs">{CONTRIBUTION_FORMULA.getHistoricalTotalContributed(currentWeek) / 2} each portfolio</div>
            </div>

            <div className="text-center p-4">
              <div className="text-sm text-muted-foreground">Current Return</div>
              <div className={`text-2xl font-bold ${benchmarkComparison.portfolioReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {benchmarkComparison.portfolioReturn.toFixed(1)}%
              </div>
              <div className="text-xs">
                S&P 500: {benchmarkComparison.sp500Return.toFixed(1)}% • HISA: {benchmarkComparison.hisaReturn.toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}