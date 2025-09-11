'use client'

import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { PortfolioData } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PerformanceChartProps {
  data: PortfolioData
}

type ChartView = 'combined' | 'stock' | 'crypto' | 'stock-vs-crypto'
type DateRange = 'all' | '30d' | '7d' | '1d'

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
  
  // Filter data based on date range
  const filterDataByRange = (data: typeof chartData, range: DateRange) => {
    if (range === 'all') return data
    
    const now = new Date()
    const cutoffDays = range === '30d' ? 30 : range === '7d' ? 7 : 1
    const cutoffTime = now.getTime() - (cutoffDays * 24 * 60 * 60 * 1000)
    
    return data.filter(point => point.sortKey >= cutoffTime)
  }
  
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
  const medianSnapshots = new Set<string>()
  Object.entries(snapshotsByDate).forEach(([date, snapshots]) => {
    if (snapshots.length > 0) {
      // Sort by portfolio value, then by timestamp to break ties consistently
      const sorted = snapshots.sort((a, b) => {
        const portfolioDiff = a.portfolio - b.portfolio
        if (portfolioDiff !== 0) return portfolioDiff
        // If portfolio values are the same, sort by timestamp to ensure consistent selection
        return a.date.localeCompare(b.date)
      })
      
      const medianIndex = Math.floor(sorted.length / 2)
      const medianSnapshot = sorted[medianIndex]
      
      // Only add the ONE median snapshot for this date
      medianSnapshots.add(medianSnapshot.date)
      console.log(`Median for ${date}: ${medianSnapshot.date} (${snapshots.length} snapshots, portfolio: ${medianSnapshot.portfolio})`)
    }
  })

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
    })
    
    const minValue = Math.min(...allValues) * 0.95 // Add 5% padding
    const maxValue = Math.max(...allValues) * 1.05 // Add 5% padding
    
    return [minValue, maxValue]
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
            />
            <Line 
              type="monotone" 
              dataKey="hisa" 
              stroke="#10b981" 
              strokeWidth={2}
              name="If HISA (3%)"
              dot={false}
              strokeDasharray="5 5"
            />
            <Line 
              type="monotone" 
              dataKey="sp500" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="If S&P 500"
              dot={false}
              strokeDasharray="5 5"
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
            />
            <Line 
              type="monotone" 
              dataKey="stockHisa" 
              stroke="#10b981" 
              strokeWidth={2}
              name="If Stock → HISA (3%)"
              dot={false}
              strokeDasharray="5 5"
            />
            <Line 
              type="monotone" 
              dataKey="stockSP500" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="If Stock → S&P 500"
              dot={false}
              strokeDasharray="5 5"
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
            />
            <Line 
              type="monotone" 
              dataKey="cryptoHisa" 
              stroke="#10b981" 
              strokeWidth={2}
              name="If Crypto → HISA (3%)"
              dot={false}
              strokeDasharray="5 5"
            />
            <Line 
              type="monotone" 
              dataKey="cryptoSP500" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="If Crypto → S&P 500"
              dot={false}
              strokeDasharray="5 5"
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
            />
            <Line 
              type="monotone" 
              dataKey="cryptoPortfolio" 
              stroke="#8b5cf6" 
              strokeWidth={3}
              name="Crypto Portfolio"
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="stockHisa" 
              stroke="#10b981" 
              strokeWidth={2}
              name="If HISA (3%)"
              dot={false}
              strokeDasharray="5 5"
            />
            <Line 
              type="monotone" 
              dataKey="stockSP500" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="If S&P 500"
              dot={false}
              strokeDasharray="5 5"
            />
          </>
        )
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Controls - Stack vertically on mobile */}
      <div className="flex flex-col space-y-3 md:space-y-4">
        {/* View Toggle Buttons */}
        <div className={`flex gap-2 ${isMobile ? 'flex-col' : 'justify-center'}`}>
          <Button
            variant={view === 'combined' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('combined')}
            className={isMobile ? 'w-full' : ''}
          >
            Combined
          </Button>
          <Button
            variant={view === 'stock' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('stock')}
            className={isMobile ? 'w-full' : ''}
          >
            Stock
          </Button>
          <Button
            variant={view === 'crypto' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('crypto')}
            className={isMobile ? 'w-full' : ''}
          >
            Crypto
          </Button>
          <Button
            variant={view === 'stock-vs-crypto' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('stock-vs-crypto')}
            className={isMobile ? 'w-full' : ''}
          >
            Stock vs Crypto
          </Button>
        </div>
        
        {/* Date Range Selector */}
        <div className={`flex gap-2 ${isMobile ? 'flex-col' : 'justify-center'}`}>
          <Button
            variant={dateRange === '1d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('1d')}
            className={isMobile ? 'w-full' : ''}
          >
            1 Day
          </Button>
          <Button
            variant={dateRange === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('7d')}
            className={isMobile ? 'w-full' : ''}
          >
            7 Days
          </Button>
          <Button
            variant={dateRange === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('30d')}
            className={isMobile ? 'w-full' : ''}
          >
            30 Days
          </Button>
          <Button
            variant={dateRange === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateRange('all')}
            className={isMobile ? 'w-full' : ''}
          >
            All Time
          </Button>
        </div>
      </div>
      
      <div className={`w-full ${isMobile ? 'h-80' : 'h-96'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartDataWithMedian} 
            margin={isMobile ? 
              { top: 5, right: 10, left: 10, bottom: 5 } : 
              { top: 5, right: 30, left: 20, bottom: 5 }
            }
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
              width={isMobile ? 50 : 60}
            />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), '']}
              labelFormatter={(label: string, payload: any) => {
                if (payload && payload.length > 0) {
                  const dataPoint = payload[0].payload
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
            <Legend 
              wrapperStyle={{ fontSize: isMobile ? '12px' : '14px' }}
              layout={isMobile ? 'vertical' : 'horizontal'}
              align={isMobile ? 'right' : 'center'}
              verticalAlign={isMobile ? 'middle' : 'bottom'}
            />
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
    </div>
  )
}