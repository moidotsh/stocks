'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, ReferenceLine } from 'recharts'
import { PortfolioData } from '@/lib/types'
import { useCurrency } from '@/lib/currency-context'
import { TrendingUp, TrendingDown, Activity, Target, BarChart3, PieChart, ScatterChart as ScatterChartIcon, Download, RotateCcw } from 'lucide-react'

interface AnalyticsDashboardProps {
  initialData: PortfolioData
}

interface RiskMetrics {
  volatility: number
  sharpeRatio: number
  maxDrawdown: number
  beta: number
  alpha: number
  informationRatio: number
}

interface CorrelationData {
  asset: string
  correlation: number
}

export function AnalyticsDashboard({ initialData }: AnalyticsDashboardProps) {
  const { formatCurrency, formatPercentage } = useCurrency()
  const [timeRange, setTimeRange] = useState<'all' | '30d' | '90d' | '1y'>('all')
  const [benchmark, setBenchmark] = useState<'sp500' | 'hisa'>('sp500')
  const [isLoading, setIsLoading] = useState(false)

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

  // Calculate risk metrics
  const riskMetrics = useMemo(() => {
    const portfolioReturns = filteredData.slice(1).map((point, i) => {
      const prevValue = filteredData[i].portfolio
      const currValue = point.portfolio
      return (currValue - prevValue) / prevValue
    })

    const benchmarkReturns = filteredData.slice(1).map((point, i) => {
      const prevValue = filteredData[i][benchmark === 'sp500' ? 'sp500' : 'hisa']
      const currValue = point[benchmark === 'sp500' ? 'sp500' : 'hisa']
      return (currValue - prevValue) / prevValue
    })

    const meanReturn = portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length
    const meanBenchmarkReturn = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length

    // Volatility (standard deviation of returns)
    const variance = portfolioReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / portfolioReturns.length
    const volatility = Math.sqrt(variance) * Math.sqrt(252) // Annualized

    // Sharpe Ratio (assuming risk-free rate of 2%)
    const riskFreeRate = 0.02
    const sharpeRatio = (meanReturn * 252 - riskFreeRate) / volatility

    // Maximum Drawdown
    let peak = filteredData[0].portfolio
    let maxDrawdown = 0
    for (const point of filteredData) {
      if (point.portfolio > peak) peak = point.portfolio
      const drawdown = (peak - point.portfolio) / peak
      if (drawdown > maxDrawdown) maxDrawdown = drawdown
    }

    // Beta (covariance / variance)
    const covariance = portfolioReturns.reduce((sum, r, i) => {
      return sum + ((r - meanReturn) * (benchmarkReturns[i] - meanBenchmarkReturn))
    }, 0) / portfolioReturns.length

    const benchmarkVariance = benchmarkReturns.reduce((sum, r) => sum + Math.pow(r - meanBenchmarkReturn, 2), 0) / benchmarkReturns.length
    const beta = covariance / benchmarkVariance

    // Alpha
    const alpha = (meanReturn * 252) - (riskFreeRate + beta * (meanBenchmarkReturn * 252 - riskFreeRate))

    // Information Ratio
    const trackingError = portfolioReturns.reduce((sum, r, i) => {
      return sum + Math.pow((r - benchmarkReturns[i]) - (meanReturn - meanBenchmarkReturn), 2)
    }, 0) / portfolioReturns.length

    const informationRatio = (meanReturn - meanBenchmarkReturn) * 252 / Math.sqrt(trackingError * 252)

    return {
      volatility,
      sharpeRatio,
      maxDrawdown,
      beta,
      alpha,
      informationRatio
    }
  }, [filteredData, benchmark])

  // Calculate correlations
  const correlations = useMemo(() => {
    const portfolioValues = filteredData.map(p => p.portfolio)
    const stockValues = filteredData.map(p => p.stockPortfolio)
    const cryptoValues = filteredData.map(p => p.cryptoPortfolio)
    const sp500Values = filteredData.map(p => p.sp500)

    const calculateCorrelation = (arr1: number[], arr2: number[]) => {
      const mean1 = arr1.reduce((sum, val) => sum + val, 0) / arr1.length
      const mean2 = arr2.reduce((sum, val) => sum + val, 0) / arr2.length

      const covariance = arr1.reduce((sum, val, i) => sum + ((val - mean1) * (arr2[i] - mean2)), 0) / arr1.length
      const std1 = Math.sqrt(arr1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / arr1.length)
      const std2 = Math.sqrt(arr2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / arr2.length)

      return covariance / (std1 * std2)
    }

    return [
      { asset: 'Stock Portfolio', correlation: calculateCorrelation(portfolioValues, stockValues) },
      { asset: 'Crypto Portfolio', correlation: calculateCorrelation(portfolioValues, cryptoValues) },
      { asset: 'S&P 500', correlation: calculateCorrelation(portfolioValues, sp500Values) },
    ]
  }, [filteredData])

  // Calculate drawdown data
  const drawdownData = useMemo(() => {
    let peak = filteredData[0].portfolio
    return filteredData.map(point => {
      if (point.portfolio > peak) peak = point.portfolio
      const drawdown = ((peak - point.portfolio) / peak) * 100
      return {
        date: point.date,
        drawdown,
        portfolio: point.portfolio,
        peak
      }
    })
  }, [filteredData])

  // Calculate monthly returns data
  const monthlyReturnsData = useMemo(() => {
    const monthlyData: Record<string, { portfolio: number; benchmark: number; date: string }> = {}

    filteredData.forEach(point => {
      const date = new Date(point.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          portfolio: 0,
          benchmark: 0,
          date: monthKey
        }
      }
    })

    Object.keys(monthlyData).forEach(monthKey => {
      const monthPoints = filteredData.filter(point => {
        const date = new Date(point.date)
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === monthKey
      })

      if (monthPoints.length >= 2) {
        const firstPoint = monthPoints[0]
        const lastPoint = monthPoints[monthPoints.length - 1]
        monthlyData[monthKey].portfolio = ((lastPoint.portfolio - firstPoint.portfolio) / firstPoint.portfolio) * 100
        monthlyData[monthKey].benchmark = ((lastPoint[benchmark === 'sp500' ? 'sp500' : 'hisa'] - firstPoint[benchmark === 'sp500' ? 'sp500' : 'hisa']) / firstPoint[benchmark === 'sp500' ? 'sp500' : 'hisa']) * 100
      }
    })

    return Object.values(monthlyData).filter(d => d.portfolio !== 0 || d.benchmark !== 0)
  }, [filteredData, benchmark])

  const handleExport = async () => {
    setIsLoading(true)
    try {
      const exportData = {
        riskMetrics,
        correlations,
        monthlyReturns: monthlyReturnsData,
        drawdowns: drawdownData,
        exportDate: new Date().toISOString(),
        timeRange
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tfsa-analytics-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">Advanced Analytics</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Deep dive into portfolio performance metrics and risk analysis
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>

          <Select value={benchmark} onValueChange={(value: any) => setBenchmark(value)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sp500">S&P 500</SelectItem>
              <SelectItem value="hisa">HISA (3%)</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleExport} disabled={isLoading} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            {isLoading ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="risk" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="risk" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Risk Analysis
          </TabsTrigger>
          <TabsTrigger value="returns" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Returns
          </TabsTrigger>
          <TabsTrigger value="correlation" className="flex items-center gap-2">
            <ScatterChartIcon className="h-4 w-4" />
            Correlation
          </TabsTrigger>
          <TabsTrigger value="drawdown" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Drawdown
          </TabsTrigger>
        </TabsList>

        <TabsContent value="risk" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Volatility</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatPercentage(riskMetrics.volatility)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Annualized standard deviation
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${riskMetrics.sharpeRatio > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {riskMetrics.sharpeRatio.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Risk-adjusted returns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatPercentage(riskMetrics.maxDrawdown)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum loss from peak
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Beta</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {riskMetrics.beta.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Market sensitivity
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alpha</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${riskMetrics.alpha > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercentage(riskMetrics.alpha)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Excess returns vs benchmark
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Information Ratio</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${riskMetrics.informationRatio > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {riskMetrics.informationRatio.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Consistency of outperformance
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="returns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Returns Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyReturnsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(2)}%`, '']}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="portfolio" fill="#3b82f6" name="Portfolio Returns" />
                    <Bar dataKey="benchmark" fill="#10b981" name={`${benchmark === 'sp500' ? 'S&P 500' : 'HISA'} Returns`} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correlation" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Correlation Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {correlations.map((corr, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="font-medium">{corr.asset}</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-32 h-2 rounded-full ${
                          Math.abs(corr.correlation) > 0.7 ? 'bg-red-500' :
                          Math.abs(corr.correlation) > 0.5 ? 'bg-orange-500' :
                          Math.abs(corr.correlation) > 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}>
                          <div
                            className={`h-full rounded-full ${
                              corr.correlation > 0 ? 'bg-blue-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.abs(corr.correlation) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono w-12 text-right">
                          {corr.correlation.toFixed(3)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Portfolio vs Benchmark Scatter</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart data={filteredData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey={benchmark === 'sp500' ? 'sp500' : 'hisa'}
                        type="number"
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <YAxis
                        dataKey="portfolio"
                        type="number"
                        tickFormatter={(value) => formatCurrency(value)}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Scatter
                        dataKey="portfolio"
                        fill="#3b82f6"
                        name="Portfolio"
                      />
                      <ReferenceLine
                        x={filteredData[0]?.[benchmark === 'sp500' ? 'sp500' : 'hisa']}
                        stroke="#10b981"
                        strokeDasharray="5 5"
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="drawdown" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Portfolio Drawdown Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={drawdownData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'Drawdown']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="drawdown"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}