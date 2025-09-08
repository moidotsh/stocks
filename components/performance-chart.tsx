'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { PortfolioData } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PerformanceChartProps {
  data: PortfolioData
}

type ChartView = 'combined' | 'stock' | 'crypto'

export function PerformanceChart({ data }: PerformanceChartProps) {
  const [view, setView] = useState<ChartView>('combined')
  
  const chartData = data.chartData.map(point => ({
    ...point,
    dateFormatted: formatDate(point.date)
  }))

  // Calculate consistent Y-axis domain across all views
  const allValues = chartData.flatMap(point => [
    point.portfolio,
    point.hisa,
    point.sp500,
    point.stockPortfolio,
    point.stockHisa,
    point.stockSP500,
    point.cryptoPortfolio,
    point.cryptoHisa,
    point.cryptoSP500
  ])
  
  const minValue = Math.min(...allValues) * 0.95 // Add 5% padding
  const maxValue = Math.max(...allValues) * 1.05 // Add 5% padding

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
    }
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex gap-2 justify-center">
        <Button
          variant={view === 'combined' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('combined')}
        >
          Combined
        </Button>
        <Button
          variant={view === 'stock' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('stock')}
        >
          Stock
        </Button>
        <Button
          variant={view === 'crypto' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('crypto')}
        >
          Crypto
        </Button>
      </div>
      
      <div className="w-full h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData} 
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            style={{ transition: 'all 0.3s ease-in-out' }}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis 
              dataKey="dateFormatted" 
              className="text-sm"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              className="text-sm"
              tick={{ fontSize: 12 }}
              tickFormatter={formatCurrency}
              domain={[minValue, maxValue]}
            />
            <Tooltip 
              formatter={(value: number) => [formatCurrency(value), '']}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
            />
            <Legend />
            {renderLines()}
            {/* Show dots for daily data points */}
            <Line 
              type="monotone" 
              dataKey="portfolio" 
              stroke="transparent"
              strokeWidth={0}
              dot={{ fill: 'hsl(var(--primary))', r: 3 }}
              activeDot={{ r: 5 }}
              name=""
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}