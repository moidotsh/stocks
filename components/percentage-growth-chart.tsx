'use client'

import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { PortfolioData } from '@/lib/types'
import { useCurrency } from '@/lib/currency-context'
import { formatDate } from '@/lib/utils'

interface PercentageGrowthChartProps {
  data: PortfolioData
}

type ChartView = 'combined' | 'stock' | 'crypto' | 'stock-vs-crypto'
type DateRange = 'all' | '30d' | '7d' | '1d'

// Filter data based on date range - moved outside component to avoid dependency issues
const filterDataByRange = (data: any[], range: DateRange) => {
  if (range === 'all') return data

  const now = new Date()
  const cutoffDays = range === '30d' ? 30 : range === '7d' ? 7 : 1
  const cutoffTime = now.getTime() - (cutoffDays * 24 * 60 * 60 * 1000)

  return data.filter(point => point.sortKey >= cutoffTime)
}

export function PercentageGrowthChart({ data }: PercentageGrowthChartProps) {
  const [view, setView] = useState<ChartView>('combined')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const { formatPercentage } = useCurrency()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle view changes with animation
  const handleViewChange = (newView: ChartView) => {
    if (newView === view) return
    setView(newView)
  }

  // Handle date range changes with animation
  const handleDateRangeChange = (newRange: DateRange) => {
    if (newRange === dateRange) return
    setDateRange(newRange)
  }

  const chartData = useMemo(() => data.chartData.map(point => {
    // Check if this is a snapshot point (has pipe separator or time format)
    const isSnapshot = point.date.includes('|') || (point.date.includes(' ') && point.date.includes(':'))

    let dateFormatted
    let sortKey

    if (isSnapshot) {
      if (point.date.includes('|')) {
        // New format with full timestamp: "2025-09-09T11:45:35.209Z|07:45"
        const [fullTimestamp, displayTime] = point.date.split('|')
        sortKey = new Date(fullTimestamp).getTime()
        dateFormatted = displayTime
      } else {
        // Legacy format: "2025-09-09 07:45"
        sortKey = new Date(point.date.replace(' ', 'T')).getTime()
        dateFormatted = point.date.split(' ')[1] || point.date
      }
    } else {
      // For regular entries, use date
      sortKey = new Date(point.date).getTime()
      dateFormatted = formatDate(point.date)
    }

    return {
      ...point,
      dateFormatted,
      sortKey,
      isSnapshot
    }
  }), [data.chartData])

  // Sort chart data chronologically using sortKey
  chartData.sort((a, b) => a.sortKey - b.sortKey)

  const filteredChartData = useMemo(() => filterDataByRange(chartData, dateRange), [chartData, dateRange])

  // Identify ticks that should show dates (start of new days)
  const dayStartTicks: { [key: string]: string } = {}
  let lastDate = ''

  filteredChartData.forEach((point) => {
    let currentDate = ''

    if (point.isSnapshot && point.date.includes('|')) {
      // New format: "2025-09-09T11:45:35.209Z|07:45"
      currentDate = point.date.split('T')[0]
    } else if (point.isSnapshot) {
      // Legacy format: "2025-09-09 07:45"
      currentDate = point.date.split(' ')[0]
    } else {
      // Regular date format: "2025-09-07"
      currentDate = point.date
    }

    if (currentDate !== lastDate) {
      // For day starts, use formatted date instead of time
      const dayLabel = formatDate(currentDate)
      dayStartTicks[point.dateFormatted] = dayLabel
      lastDate = currentDate
    }
  })

  // Group snapshots by date and find median for each day
  const snapshotsByDate = useMemo(() => filteredChartData
    .filter(point => point.isSnapshot)
    .reduce((acc, point) => {
      const date = point.date.split(' ')[0] // Extract date part
      if (!acc[date]) acc[date] = []
      acc[date].push(point)
      return acc
    }, {} as Record<string, typeof filteredChartData>), [filteredChartData])

  // Find median snapshot for each date - ensure only ONE per date
  const medianSnapshots = useMemo(() => {
    const result = new Set<string>()
    Object.entries(snapshotsByDate).forEach(([date, snapshots]) => {
      const typedSnapshots = snapshots as typeof filteredChartData
      if (typedSnapshots.length > 0) {
        // Sort by portfolio value, then by timestamp to break ties consistently
        const sorted = typedSnapshots.sort((a, b) => {
          const portfolioDiff = a.portfolio - b.portfolio
          if (portfolioDiff !== 0) return portfolioDiff
          // If portfolio values are the same, sort by timestamp to ensure consistent selection
          return a.date.localeCompare(b.date)
        })

        const medianIndex = Math.floor(sorted.length / 2)
        const medianSnapshot = sorted[medianIndex]

        // Only add the ONE median snapshot for this date
        result.add(medianSnapshot.date)
      }
    })
    return result
  }, [snapshotsByDate])

  // Create proportional x-axis data based on actual days from start, with smoothing
  const proportionalChartData = useMemo(() => {
    const result: typeof filteredChartData = []
    const startDate = new Date('2025-09-07') // Experiment start date

    // First, collect all points we want to include
    const allPoints: typeof filteredChartData = []

    filteredChartData.forEach(point => {
      // Only include regular entries OR median snapshots for cleaner visualization
      if (!point.isSnapshot || medianSnapshots.has(point.date)) {
        let dateKey = ''

        if (point.isSnapshot) {
          // Extract date from timestamp
          if (point.date.includes('|')) {
            dateKey = point.date.split('T')[0] // "2025-09-09T11:45:35.209Z|07:45" -> "2025-09-09"
          } else {
            dateKey = point.date.split(' ')[0] // "2025-09-09 07:45" -> "2025-09-09"
          }
        } else {
          dateKey = point.date // "2025-09-07"
        }

        const pointDate = new Date(dateKey)
        const daysFromStart = (pointDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)

        allPoints.push({
          ...point,
          xPosition: daysFromStart, // Use days from start for x-axis
          weekLabel: dateKey // Use date as label
        })
      }
    })

    // Apply smoothing: show daily snapshots + regular entries, but ensure regular entries are always preserved
    const smoothedPoints = []
    const regularEntryDates = new Set<string>() // Track dates that have regular entries

    // First pass: collect all regular entry dates
    for (const point of allPoints) {
      if (!point.isSnapshot) {
        regularEntryDates.add(point.weekLabel)
      }
    }

    // Second pass: build the smoothed data, ensuring regular entries are never filtered out
    let lastXPosition = -1
    for (let i = 0; i < allPoints.length; i++) {
      const point = allPoints[i]

      // Always include regular entries (weekly contributions) - never filter these
      if (!point.isSnapshot) {
        smoothedPoints.push(point)
        lastXPosition = point.xPosition
        continue
      }

      // For snapshots, include every day, but be more permissive to avoid hiding data near regular entries
      if (point.xPosition - lastXPosition >= 0.1 || i === allPoints.length - 1) {
        smoothedPoints.push(point)
        lastXPosition = point.xPosition
      }
    }

    return smoothedPoints
  }, [filteredChartData, medianSnapshots])

  // Add isMedianSnapshot flag to chart data
  const chartDataWithMedian = useMemo(() => proportionalChartData.map(point => ({
    ...point,
    isMedianSnapshot: point.isSnapshot && medianSnapshots.has(point.date)
  })), [proportionalChartData, medianSnapshots])

  // Calculate percentage data - smoothed returns to eliminate contribution spikes
  const percentageData = useMemo(() => {
    // First calculate raw percentages for all points
    const rawPercentages = chartDataWithMedian.map((point) => {
      const daysFromStart = point.xPosition

      // Calculate total contributions up to this point using proper week boundaries
      const getTotalContributions = (days: number) => {
        // Use ceiling to include contributions that have been made
        const weeks = Math.ceil(days / 7)
        let totalContributions = 0

        // Add contributions for all weeks up to and including current week
        for (let week = 1; week <= weeks && week <= 4; week++) {
          const weekContribution = 10 + (week - 1) * 1 // $10 for week 1, $11 for week 2, etc.
          totalContributions += weekContribution * 2 // Stock + crypto
        }

        return totalContributions
      }

      const totalContributions = getTotalContributions(daysFromStart)

      // Calculate absolute percentages first
      const getAbsolutePercentage = (currentValue: number) => {
        const profit = currentValue - totalContributions
        if (totalContributions <= 0) return 0
        return (profit / totalContributions) * 100
      }

      // Calculate percentages relative to HISA benchmark
      const getRelativePercentage = (currentValue: number, hisaValue: number) => {
        const currentPercent = getAbsolutePercentage(currentValue)
        const hisaPercent = getAbsolutePercentage(hisaValue)
        return currentPercent - hisaPercent // Show outperformance/underperformance vs HISA
      }

      const portfolioAbsolute = getAbsolutePercentage(point.portfolio)
      const hisaAbsolute = getAbsolutePercentage(point.hisa)
      const sp500Absolute = getAbsolutePercentage(point.sp500)
      const stockPortfolioAbsolute = getAbsolutePercentage(point.stockPortfolio)
      const cryptoPortfolioAbsolute = getAbsolutePercentage(point.cryptoPortfolio)
      const stockHisaAbsolute = getAbsolutePercentage(point.stockHisa)
      const stockSP500Absolute = getAbsolutePercentage(point.stockSP500)
      const cryptoHisaAbsolute = getAbsolutePercentage(point.cryptoHisa)
      const cryptoSP500Absolute = getAbsolutePercentage(point.cryptoSP500Percent)

      return {
        ...point,
        // Absolute percentages (for reference, not displayed)
        portfolioAbsolute,
        hisaAbsolute,
        sp500Absolute,
        stockPortfolioAbsolute,
        cryptoPortfolioAbsolute,
        stockHisaAbsolute,
        stockSP500Absolute,
        cryptoHisaAbsolute,
        cryptoSP500Absolute,

        // Relative percentages (what we'll display)
        portfolioPercent: getRelativePercentage(point.portfolio, point.hisa), // Portfolio vs HISA
        hisaPercent: 0, // HISA is the baseline, so it's always 0
        sp500Percent: getRelativePercentage(point.sp500, point.hisa), // S&P vs HISA
        stockPortfolioPercent: getRelativePercentage(point.stockPortfolio, point.stockHisa), // Stock Portfolio vs Stock HISA
        cryptoPortfolioPercent: getRelativePercentage(point.cryptoPortfolio, point.cryptoHisa), // Crypto Portfolio vs Crypto HISA
        stockHisaPercent: 0, // Stock HISA is baseline for stock comparison
        stockSP500Percent: getRelativePercentage(point.stockSP500, point.stockHisa), // Stock S&P vs Stock HISA
        cryptoHisaPercent: 0, // Crypto HISA is baseline for crypto comparison
        cryptoSP500Percent: getRelativePercentage(point.cryptoSP500Percent, point.cryptoHisa) // Crypto S&P vs Crypto HISA
      }
    })

    // Apply smoothing to the relative performance data (much simpler now since HISA is always 0)
    let smoothedData = [...rawPercentages]

    // First pass: Smooth contribution days and large spikes
    smoothedData = smoothedData.map((point, index) => {
      // Skip smoothing for first and last few points
      if (index === 0 || index >= smoothedData.length - 2) return point

      const prevPoint = smoothedData[index - 1]
      const nextPoint = smoothedData[index + 1]

      // Check for any significant change in portfolio relative performance
      const portfolioChange = Math.abs(point.portfolioPercent - prevPoint.portfolioPercent)
      const isSpike = portfolioChange > 5 // Lower threshold for relative performance

      // Also smooth regular entries (contribution days)
      const isContributionDay = !point.isSnapshot

      if (isSpike || isContributionDay) {
        // Apply weighted moving average
        const smoothValue = (key: keyof typeof point) => {
          const pointValue = point[key] as number
          const prevValue = prevPoint[key] as number
          const nextValue = nextPoint[key] as number

          // For HISA baseline, keep it at 0
          if (typeof key === 'string' && key.includes('hisaPercent') && key !== 'stockHisaPercent' && key !== 'cryptoHisaPercent') {
            return 0
          }

          // Weighted average: 40% prev, 20% current, 40% next
          return (prevValue * 0.4 + pointValue * 0.2 + nextValue * 0.4)
        }

        return {
          ...point,
          portfolioPercent: smoothValue('portfolioPercent'),
          hisaPercent: 0, // Keep HISA at 0
          sp500Percent: smoothValue('sp500Percent'),
          stockPortfolioPercent: smoothValue('stockPortfolioPercent'),
          cryptoPortfolioPercent: smoothValue('cryptoPortfolioPercent'),
          stockHisaPercent: 0, // Keep stock HISA at 0
          stockSP500Percent: smoothValue('stockSP500Percent'),
          cryptoHisaPercent: 0, // Keep crypto HISA at 0
          cryptoSP500Percent: smoothValue('cryptoSP500Percent')
        }
      }

      return point
    })

    // Second pass: Clean up any remaining irregularities
    smoothedData = smoothedData.map((point, index) => {
      // Skip smoothing for first and last points
      if (index === 0 || index >= smoothedData.length - 1) return point

      const prevPoint = smoothedData[index - 1]
      const nextPoint = smoothedData[index + 1]

      // Check for remaining small spikes in relative performance
      const portfolioChange = Math.abs(point.portfolioPercent - prevPoint.portfolioPercent)
      const nextChange = Math.abs(nextPoint.portfolioPercent - point.portfolioPercent)

      // If this point creates a "V" shape or inverted "V" shape, smooth it
      const isIrregular = (portfolioChange > 2 && nextChange > 2) &&
        ((point.portfolioPercent > prevPoint.portfolioPercent && point.portfolioPercent > nextPoint.portfolioPercent) ||
         (point.portfolioPercent < prevPoint.portfolioPercent && point.portfolioPercent < nextPoint.portfolioPercent))

      if (isIrregular) {
        // Simple 3-point average for final smoothing
        const smoothValue = (key: keyof typeof point) => {
          const pointValue = point[key] as number
          const prevValue = prevPoint[key] as number
          const nextValue = nextPoint[key] as number

          // Keep HISA baselines at 0
          if (typeof key === 'string' && key.includes('hisaPercent') && key !== 'stockHisaPercent' && key !== 'cryptoHisaPercent') {
            return 0
          }

          return (prevValue + pointValue + nextValue) / 3
        }

        return {
          ...point,
          portfolioPercent: smoothValue('portfolioPercent'),
          hisaPercent: 0, // Keep HISA at 0
          sp500Percent: smoothValue('sp500Percent'),
          stockPortfolioPercent: smoothValue('stockPortfolioPercent'),
          cryptoPortfolioPercent: smoothValue('cryptoPortfolioPercent'),
          stockHisaPercent: 0, // Keep stock HISA at 0
          stockSP500Percent: smoothValue('stockSP500Percent'),
          cryptoHisaPercent: 0, // Keep crypto HISA at 0
          cryptoSP500Percent: smoothValue('cryptoSP500Percent')
        }
      }

      return point
    })

    return smoothedData
  }, [chartDataWithMedian])

  // Calculate Y-axis domain for percentage data
  const getYAxisDomain = () => {
    const allValues = percentageData.flatMap(point => {
      switch (view) {
        case 'combined':
          return [point.portfolioPercent, point.hisaPercent, point.sp500Percent]
        case 'stock':
          return [point.stockPortfolioPercent, point.stockHisaPercent, point.stockSP500Percent]
        case 'crypto':
          return [point.cryptoPortfolioPercent, point.cryptoHisaPercent, point.cryptoSP500Percent]
        case 'stock-vs-crypto':
          return [point.stockPortfolioPercent, point.cryptoPortfolioPercent, point.stockHisaPercent, point.stockSP500Percent]
        default:
          return [point.portfolioPercent, point.hisaPercent, point.sp500Percent]
      }
    }).filter(value => value !== null && value !== undefined && !isNaN(value))

    if (allValues.length === 0) return [-20, 50]

    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    const range = maxValue - minValue

    // If range is very small, set a minimum range
    const minRange = Math.max(range, 5)

    // Add padding that ensures nice round numbers
    const padding = minRange * 0.15 // 15% padding
    const paddedMin = minValue - padding
    const paddedMax = maxValue + padding

    // Round to nice numbers for better Y-axis labels
    const step = Math.pow(10, Math.floor(Math.log10(minRange)))
    const niceMin = Math.floor(paddedMin / step) * step
    const niceMax = Math.ceil(paddedMax / step) * step

    return [niceMin, niceMax]
  }

  const [minValue, maxValue] = getYAxisDomain()

  const renderLines = () => {
    switch (view) {
      case 'combined':
        return (
          <>
            <Line
              type="monotone"
              dataKey="portfolioPercent"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              name="Portfolio vs HISA"
              dot={false}
              animationBegin={0}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="hisaPercent"
              stroke="#10b981"
              strokeWidth={2}
              name="HISA (Baseline)"
              dot={false}
              animationBegin={200}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="sp500Percent"
              stroke="#f59e0b"
              strokeWidth={2}
              name="S&P 500 vs HISA"
              dot={false}
              strokeDasharray="5 5"
              animationBegin={400}
              animationDuration={800}
            />
          </>
        )

      case 'stock':
        return (
          <>
            <Line
              type="monotone"
              dataKey="stockPortfolioPercent"
              stroke="#3b82f6"
              strokeWidth={3}
              name="Stock vs HISA"
              dot={false}
              animationBegin={0}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="stockHisaPercent"
              stroke="#10b981"
              strokeWidth={2}
              name="HISA (Baseline)"
              dot={false}
              animationBegin={200}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="stockSP500Percent"
              stroke="#f59e0b"
              strokeWidth={2}
              name="S&P 500 vs HISA"
              dot={false}
              strokeDasharray="5 5"
              animationBegin={400}
              animationDuration={800}
            />
          </>
        )

      case 'crypto':
        return (
          <>
            <Line
              type="monotone"
              dataKey="cryptoPortfolioPercent"
              stroke="#8b5cf6"
              strokeWidth={3}
              name="Crypto vs HISA"
              dot={false}
              animationBegin={0}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="cryptoHisaPercent"
              stroke="#10b981"
              strokeWidth={2}
              name="HISA (Baseline)"
              dot={false}
              animationBegin={200}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="cryptoSP500Percent"
              stroke="#f59e0b"
              strokeWidth={2}
              name="S&P 500 vs HISA"
              dot={false}
              strokeDasharray="5 5"
              animationBegin={400}
              animationDuration={800}
            />
          </>
        )

      case 'stock-vs-crypto':
        return (
          <>
            <Line
              type="monotone"
              dataKey="stockPortfolioPercent"
              stroke="#3b82f6"
              strokeWidth={3}
              name="Stock vs HISA"
              dot={false}
              animationBegin={0}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="cryptoPortfolioPercent"
              stroke="#8b5cf6"
              strokeWidth={3}
              name="Crypto vs HISA"
              dot={false}
              animationBegin={200}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="stockHisaPercent"
              stroke="#10b981"
              strokeWidth={2}
              name="HISA (Baseline)"
              dot={false}
              animationBegin={400}
              animationDuration={800}
            />
            <Line
              type="monotone"
              dataKey="stockSP500Percent"
              stroke="#f59e0b"
              strokeWidth={2}
              name="S&P 500 vs HISA"
              dot={false}
              strokeDasharray="5 5"
              animationBegin={600}
              animationDuration={800}
            />
          </>
        )
    }
  }

  // Generate mobile legend items based on current view
  const getMobileLegendItems = () => {
    const items = []

    switch (view) {
      case 'combined':
        items.push(
          { name: 'Portfolio vs HISA', color: '#8884d8' },
          { name: 'HISA (Baseline)', color: '#82ca9d' },
          { name: 'S&P 500 vs HISA', color: '#ffc658' }
        )
        break
      case 'stock':
        items.push(
          { name: 'Stock vs HISA', color: '#8884d8' },
          { name: 'HISA (Baseline)', color: '#82ca9d' },
          { name: 'S&P 500 vs HISA', color: '#ffc658' }
        )
        break
      case 'crypto':
        items.push(
          { name: 'Crypto vs HISA', color: '#8884d8' },
          { name: 'HISA (Baseline)', color: '#82ca9d' },
          { name: 'S&P 500 vs HISA', color: '#ffc658' }
        )
        break
      case 'stock-vs-crypto':
        items.push(
          { name: 'Stock vs HISA', color: '#8884d8' },
          { name: 'Crypto vs HISA', color: '#ff7300' },
          { name: 'HISA (Baseline)', color: '#82ca9d' },
          { name: 'S&P 500 vs HISA', color: '#ffc658' }
        )
        break
    }

    return items
  }

  return (
    <div className="w-full space-y-4">
      {/* Mobile-First Controls */}
      <div className="space-y-4">
        {/* View Selector - Segmented Control Style */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Portfolio View</label>
          <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-lg">
            {[
              { key: 'combined', label: 'All', short: 'All' },
              { key: 'stock', label: 'Stock', short: 'Stock' },
              { key: 'crypto', label: 'Crypto', short: 'Crypto' },
              { key: 'stock-vs-crypto', label: 'Stock vs Crypto', short: 'Compare' }
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => handleViewChange(option.key as ChartView)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  view === option.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                } ${isMobile ? 'min-w-0' : ''}`}
              >
                <span className={isMobile ? 'hidden sm:inline' : ''}>{option.label}</span>
                <span className={isMobile ? 'sm:hidden' : 'hidden'}>{option.short}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Time Range Selector - Horizontal Scroll on Mobile */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Time Range</label>
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
            {[
              { key: '1d', label: '1 Day', short: '1D' },
              { key: '7d', label: '7 Days', short: '7D' },
              { key: '30d', label: '30 Days', short: '30D' },
              { key: 'all', label: 'All Time', short: 'All' }
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => handleDateRangeChange(option.key as DateRange)}
                className={`flex-shrink-0 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                  dateRange === option.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                <span className={isMobile ? 'hidden' : ''}>{option.label}</span>
                <span className={isMobile ? '' : 'hidden'}>{option.short}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`w-full ${isMobile ? 'h-80' : 'h-96'} relative`}>
        <ResponsiveContainer
          width="100%"
          height="100%"
          className="transition-all duration-300"
        >
          <LineChart
            data={percentageData}
            margin={isMobile ?
              { top: 5, right: 10, left: 10, bottom: 5 } :
              { top: 5, right: 30, left: 20, bottom: 5 }
            }
            key={`${view}-${dateRange}`} // Force re-render for smooth transitions
            style={{ transition: 'all 0.3s ease-in-out' }}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="xPosition"
              className="text-sm"
              tick={{ fontSize: isMobile ? 9 : 11 }}
              type="number"
              domain={[0, 'dataMax']}
              interval={0}
              ticks={[0, 7, 14, 21, 28]}
              tickFormatter={(value) => {
                // Show date labels for specific day positions
                const daysFromStart = Math.round(value)

                // Show week labels for all weeks
                if (daysFromStart === 0) {
                  return 'Week 1'
                } else if (daysFromStart === 7) {
                  return 'Week 2'
                } else if (daysFromStart === 14) {
                  return 'Week 3'
                } else if (daysFromStart === 21) {
                  return 'Week 4'
                } else if (daysFromStart === 28) {
                  return 'Week 5'
                }

                return ''
              }}
            />
            <YAxis
              className="text-sm"
              tick={{ fontSize: isMobile ? 10 : 12 }}
              tickFormatter={(value) => {
                return `${value.toFixed(1)}%`
              }}
              domain={[minValue, maxValue]}
              tickCount={6}
              width={isMobile ? 50 : 60}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                return [`${value.toFixed(1)}%`, name]
              }}
              labelFormatter={(_label: number, payload: unknown) => {
                if (payload && Array.isArray(payload) && payload.length > 0) {
                  const dataPoint = (payload[0] as { payload: any }).payload
                  if (dataPoint?.isSnapshot) {
                    // For snapshots, show full date and time
                    const fullDate = dataPoint.date
                    if (fullDate.includes('|')) {
                      // New format: "2025-09-09T11:45:35.209Z|07:45"
                      const [fullTimestamp, displayTime] = fullDate.split('|')
                      const datePart = fullTimestamp.split('T')[0]
                      return `${formatDate(datePart)} at ${displayTime}`
                    } else {
                      // Legacy format: "2025-09-09 07:45"
                      const [datePart, timePart] = fullDate.split(' ')
                      return `${formatDate(datePart)} at ${timePart}`
                    }
                  } else {
                    // For regular entries, use formatted date
                    return formatDate(dataPoint.date)
                  }
                }
                return ''
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            {!isMobile && (
              <Legend
                wrapperStyle={{ fontSize: '14px' }}
                layout="horizontal"
                align="center"
                verticalAlign="bottom"
              />
            )}
            {renderLines()}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Mobile Legend */}
      {isMobile && (
        <div className="mt-4 p-3 bg-muted/50 rounded-lg transition-all duration-300">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {getMobileLegendItems().map((item, index) => (
              <div
                key={`${view}-${index}`}
                className="flex items-center gap-2 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div
                  className="w-3 h-0.5 rounded-full transition-all duration-300"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground font-medium">
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}