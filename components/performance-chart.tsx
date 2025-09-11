'use client'

import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { PortfolioData } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PerformanceChartProps {
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

export function PerformanceChart({ data }: PerformanceChartProps) {
  const [view, setView] = useState<ChartView>('combined')
  const [dateRange, setDateRange] = useState<DateRange>('all')
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
  
  // Debug: Log the first few sorted data points to see ordering
  console.log('First 5 filtered chart data points:', 
    filteredChartData.slice(0, 5).map(p => ({ 
      date: p.date, 
      dateFormatted: p.dateFormatted, 
      portfolio: p.portfolio, 
      isSnapshot: p.isSnapshot 
    }))
  )

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
        const sorted = typedSnapshots.sort((a: any, b: any) => {
          const portfolioDiff = a.portfolio - b.portfolio
          if (portfolioDiff !== 0) return portfolioDiff
          // If portfolio values are the same, sort by timestamp to ensure consistent selection
          return a.date.localeCompare(b.date)
        })
        
        const medianIndex = Math.floor(sorted.length / 2)
        const medianSnapshot = sorted[medianIndex]
        
        // Only add the ONE median snapshot for this date
        result.add(medianSnapshot.date)
        console.log(`Median for ${date}: ${medianSnapshot.date} (${typedSnapshots.length} snapshots, portfolio: ${medianSnapshot.portfolio})`)
      }
    })
    return result
  }, [snapshotsByDate])

  // Add isMedianSnapshot flag to chart data
  const chartDataWithMedian = useMemo(() => filteredChartData.map(point => ({
    ...point,
    isMedianSnapshot: point.isSnapshot && medianSnapshots.has(point.date)
  })), [filteredChartData, medianSnapshots])

  // Debug: Log how many median snapshots we have
  const medianCount = chartDataWithMedian.filter(point => point.isMedianSnapshot).length
  console.log(`Total median snapshots marked: ${medianCount}`)
  console.log('Median snapshots:', Array.from(medianSnapshots))

  // Calculate Y-axis domain based on current view
  const getYAxisDomain = () => {
    const allValues = chartDataWithMedian.flatMap(point => {
      switch (view) {
        case 'combined':
          return [point.portfolio, point.hisa, point.sp500]
        case 'stock':
          return [point.stockPortfolio, point.stockHisa, point.stockSP500]
        case 'crypto':
          return [point.cryptoPortfolio, point.cryptoHisa, point.cryptoSP500]
        case 'stock-vs-crypto':
          return [point.stockPortfolio, point.cryptoPortfolio, point.stockHisa, point.stockSP500]
        default:
          return [point.portfolio, point.hisa, point.sp500]
      }
    }).filter(value => value !== null && value !== undefined && !isNaN(value))
    
    if (allValues.length === 0) return [0, 100]
    
    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)
    const range = maxValue - minValue
    
    // If range is very small, set a minimum range
    const minRange = Math.max(range, (maxValue * 0.1) || 1)
    
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
              dataKey="portfolio" 
              stroke="hsl(var(--primary))" 
              strokeWidth={3}
              name="My Portfolio"
              dot={false}
              animationBegin={0}
              animationDuration={800}
            />
            <Line 
              type="monotone" 
              dataKey="hisa" 
              stroke="#10b981" 
              strokeWidth={2}
              name="If HISA (3%)"
              dot={false}
              strokeDasharray="5 5"
              animationBegin={200}
              animationDuration={800}
            />
            <Line 
              type="monotone" 
              dataKey="sp500" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="If S&P 500"
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
              dataKey="stockPortfolio" 
              stroke="#3b82f6" 
              strokeWidth={3}
              name="Stock Portfolio"
              dot={false}
              animationBegin={0}
              animationDuration={800}
            />
            <Line 
              type="monotone" 
              dataKey="stockHisa" 
              stroke="#10b981" 
              strokeWidth={2}
              name="If Stock → HISA (3%)"
              dot={false}
              strokeDasharray="5 5"
              animationBegin={200}
              animationDuration={800}
            />
            <Line 
              type="monotone" 
              dataKey="stockSP500" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="If Stock → S&P 500"
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
              dataKey="cryptoPortfolio" 
              stroke="#8b5cf6" 
              strokeWidth={3}
              name="Crypto Portfolio"
              dot={false}
              animationBegin={0}
              animationDuration={800}
            />
            <Line 
              type="monotone" 
              dataKey="cryptoHisa" 
              stroke="#10b981" 
              strokeWidth={2}
              name="If Crypto → HISA (3%)"
              dot={false}
              strokeDasharray="5 5"
              animationBegin={200}
              animationDuration={800}
            />
            <Line 
              type="monotone" 
              dataKey="cryptoSP500" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="If Crypto → S&P 500"
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
              dataKey="stockPortfolio" 
              stroke="#3b82f6" 
              strokeWidth={3}
              name="Stock Portfolio"
              dot={false}
              animationBegin={0}
              animationDuration={800}
            />
            <Line 
              type="monotone" 
              dataKey="cryptoPortfolio" 
              stroke="#8b5cf6" 
              strokeWidth={3}
              name="Crypto Portfolio"
              dot={false}
              animationBegin={200}
              animationDuration={800}
            />
            <Line 
              type="monotone" 
              dataKey="stockHisa" 
              stroke="#10b981" 
              strokeWidth={2}
              name="If HISA (3%)"
              dot={false}
              strokeDasharray="5 5"
              animationBegin={400}
              animationDuration={800}
            />
            <Line 
              type="monotone" 
              dataKey="stockSP500" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="If S&P 500"
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
          { name: 'Portfolio', color: '#8884d8' },
          { name: 'HISA (3%)', color: '#82ca9d' },
          { name: 'S&P 500', color: '#ffc658' }
        )
        break
      case 'stock':
        items.push(
          { name: 'Stock Portfolio', color: '#8884d8' },
          { name: 'If HISA (3%)', color: '#82ca9d' },
          { name: 'If S&P 500', color: '#ffc658' }
        )
        break
      case 'crypto':
        items.push(
          { name: 'Crypto Portfolio', color: '#8884d8' },
          { name: 'If HISA (3%)', color: '#82ca9d' },
          { name: 'If S&P 500', color: '#ffc658' }
        )
        break
      case 'stock-vs-crypto':
        items.push(
          { name: 'Stock Portfolio', color: '#8884d8' },
          { name: 'Crypto Portfolio', color: '#ff7300' },
          { name: 'If HISA (3%)', color: '#82ca9d' },
          { name: 'If S&P 500', color: '#ffc658' }
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
            data={chartDataWithMedian} 
            margin={isMobile ? 
              { top: 5, right: 10, left: 10, bottom: 5 } : 
              { top: 5, right: 30, left: 20, bottom: 5 }
            }
            key={`${view}-${dateRange}`} // Force re-render for smooth transitions
            style={{ transition: 'all 0.3s ease-in-out' }}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="dateFormatted" 
              className="text-sm"
              tick={{ fontSize: isMobile ? 10 : 12 }}
              type="category"
              interval={isMobile ? 'preserveStartEnd' : 0}
              angle={isMobile ? -45 : 0}
              textAnchor={isMobile ? 'end' : 'middle'}
              height={isMobile ? 60 : 30}
              tickFormatter={(value) => {
                // Only show tick labels for day starts, using formatted date
                const label = dayStartTicks[value] || ''
                // On mobile, truncate longer labels
                if (isMobile && label.length > 8) {
                  return label.split(' ')[0] // Just show the date part
                }
                return label
              }}
            />
            <YAxis 
              className="text-sm"
              tick={{ fontSize: isMobile ? 10 : 12 }}
              tickFormatter={(value) => {
                // On mobile, use shorter currency format
                if (isMobile) {
                  return value >= 1000 ? `$${(value/1000).toFixed(0)}k` : `$${value.toFixed(0)}`
                }
                return formatCurrency(value)
              }}
              domain={[minValue, maxValue]}
              tickCount={6}
              width={isMobile ? 50 : 60}
            />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), '']}
              labelFormatter={(label: string, payload: unknown) => {
                if (payload && Array.isArray(payload) && payload.length > 0) {
                  const dataPoint = (payload[0] as any).payload
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
                  }
                }
                return label
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
            {/* Show dots only for median snapshots per day */}
            {view === 'combined' && (
              <Line 
                type="monotone" 
                dataKey="portfolio" 
                stroke="transparent"
                strokeWidth={0}
                dot={false}
                activeDot={{ r: 5 }}
                name=""
                connectNulls={false}
              />
            )}
            {view === 'stock' && (
              <Line 
                type="monotone" 
                dataKey="stockPortfolio" 
                stroke="transparent"
                strokeWidth={0}
                dot={false}
                activeDot={{ r: 5 }}
                name=""
                connectNulls={false}
              />
            )}
            {view === 'crypto' && (
              <Line 
                type="monotone" 
                dataKey="cryptoPortfolio" 
                stroke="transparent"
                strokeWidth={0}
                dot={false}
                activeDot={{ r: 5 }}
                name=""
                connectNulls={false}
              />
            )}
            {view === 'stock-vs-crypto' && (
              <>
                <Line 
                  type="monotone" 
                  dataKey="stockPortfolio" 
                  stroke="transparent"
                  strokeWidth={0}
                  dot={false}
                  activeDot={{ r: 5 }}
                  name=""
                  connectNulls={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="cryptoPortfolio" 
                  stroke="transparent"
                  strokeWidth={0}
                  dot={false}
                  activeDot={{ r: 5 }}
                  name=""
                  connectNulls={false}
                />
              </>
            )}
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