'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Holdings } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

interface AssetAllocationChartsProps {
  holdings: Holdings
}

const COLORS = {
  stocks: '#3b82f6',
  crypto: '#f59e0b',
  cash: '#10b981',
  // Individual stock colors
  ABX: '#ef4444',
  'XIU.TO': '#8b5cf6',
  VTI: '#06b6d4',
  TDB902: '#84cc16',
  // Individual crypto colors
  DOGE: '#fbbf24',
  AVAX: '#f87171',
  DOT: '#a78bfa',
  ENA: '#34d399',
  WLD: '#fb7185',
  BTC: '#f97316',
  ETH: '#6366f1'
}

export function AssetAllocationCharts({ holdings }: AssetAllocationChartsProps) {
  // Calculate total values
  const stockValue = holdings.positions.reduce((sum, pos) => sum + (pos.shares * pos.market_price), 0)
  const cryptoValue = (holdings.crypto_positions || []).reduce((sum, pos) => sum + (pos.qty * pos.current_price), 0)
  const cashValue = holdings.cash_cad
  const totalValue = stockValue + cryptoValue + cashValue

  // 1. Stocks vs Crypto vs Cash
  const overallData = [
    { name: 'Stocks', value: stockValue, percentage: (stockValue / totalValue * 100).toFixed(1) },
    { name: 'Crypto', value: cryptoValue, percentage: (cryptoValue / totalValue * 100).toFixed(1) },
    { name: 'Cash', value: cashValue, percentage: (cashValue / totalValue * 100).toFixed(1) }
  ].filter(item => item.value > 0)

  // 2. Individual stock allocation
  const stockData = holdings.positions.map(pos => ({
    name: pos.ticker,
    value: pos.shares * pos.market_price,
    percentage: ((pos.shares * pos.market_price) / stockValue * 100).toFixed(1)
  })).filter(item => item.value > 0)

  // 3. Individual crypto allocation
  const cryptoData = (holdings.crypto_positions || []).map(pos => ({
    name: pos.ticker,
    value: pos.qty * pos.current_price,
    percentage: ((pos.qty * pos.current_price) / cryptoValue * 100).toFixed(1)
  })).filter(item => item.value > 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm">{formatCurrency(data.value)} ({data.percentage}%)</p>
        </div>
      )
    }
    return null
  }

  const renderCustomLabel = ({ name, percentage }: any) => {
    return `${name} (${percentage}%)`
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Overall Allocation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Asset Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overallData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {overallData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.name === 'Stocks' ? COLORS.stocks : entry.name === 'Crypto' ? COLORS.crypto : COLORS.cash} 
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Stock Allocation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Stock Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {stockData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stockData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stockData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[entry.name as keyof typeof COLORS] || COLORS.stocks} 
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No stock positions
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Crypto Allocation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Crypto Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {cryptoData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cryptoData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {cryptoData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[entry.name as keyof typeof COLORS] || COLORS.crypto} 
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No crypto positions
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}