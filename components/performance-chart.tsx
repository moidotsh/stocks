'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { PortfolioData } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'

interface PerformanceChartProps {
  data: PortfolioData
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const chartData = data.chartData.map(point => ({
    ...point,
    dateFormatted: formatDate(point.date)
  }))

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
          <Line 
            type="monotone" 
            dataKey="portfolio" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            name="My Portfolio"
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="hisa" 
            stroke="#10b981" 
            strokeWidth={2}
            name="HISA (3%)"
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="sp500" 
            stroke="#f59e0b" 
            strokeWidth={2}
            name="S&P 500 DCA"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}