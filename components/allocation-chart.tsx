'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Holdings } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface AllocationChartProps {
  holdings: Holdings
}

export function AllocationChart({ holdings }: AllocationChartProps) {
  const data = [
    ...holdings.positions.map(pos => ({
      name: pos.ticker,
      value: pos.shares * pos.market_price,
      color: getColorForTicker(pos.ticker)
    })),
    ...(holdings.cash_cad > 0 ? [{
      name: 'Cash',
      value: holdings.cash_cad,
      color: '#64748b'
    }] : [])
  ]

  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [formatCurrency(value), 'Value']}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function getColorForTicker(ticker: string): string {
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ]
  
  let hash = 0
  for (let i = 0; i < ticker.length; i++) {
    hash = ticker.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  return colors[Math.abs(hash) % colors.length]
}