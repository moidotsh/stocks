'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
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
  // Individual crypto colors - better palette
  DOGE: '#F7931A',  // Bitcoin orange
  AVAX: '#E84142',  // Avalanche red
  DOT: '#E6007A',   // Polkadot pink
  ENA: '#00D4AA',   // Teal
  WLD: '#6366F1',   // Indigo (changed from black)
  BTC: '#F7931A',   // Bitcoin orange
  ETH: '#627EEA'    // Ethereum blue
}

// Backup color palette for any missing cryptos
const CRYPTO_BACKUP_COLORS = [
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#3B82F6', // Blue
  '#84CC16', // Lime
  '#F97316', // Orange
  '#EC4899', // Pink
]

export function AssetAllocationCharts({ holdings }: AssetAllocationChartsProps) {
  // Calculate total values
  const stockValue = holdings.positions.reduce((sum, pos) => sum + (pos.shares * pos.market_price), 0)
  const cryptoValue = (holdings.crypto_positions || []).reduce((sum, pos) => sum + (pos.qty * pos.current_price), 0)
  const cashValue = holdings.cash_cad
  const totalValue = stockValue + cryptoValue + cashValue

  // 1. Stocks vs Crypto vs Cash (filter out 0% values)
  const overallData = [
    { name: 'Stocks', value: stockValue, percentage: (stockValue / totalValue * 100).toFixed(1) },
    { name: 'Crypto', value: cryptoValue, percentage: (cryptoValue / totalValue * 100).toFixed(1) },
    { name: 'Cash', value: cashValue, percentage: (cashValue / totalValue * 100).toFixed(1) }
  ].filter(item => item.value > 0 && parseFloat(item.percentage) > 0)

  // 2. Individual stock allocation
  const stockData = holdings.positions.map(pos => ({
    name: pos.ticker,
    value: pos.shares * pos.market_price,
    percentage: ((pos.shares * pos.market_price) / stockValue * 100).toFixed(1)
  })).filter(item => item.value > 0)

  // 3. Individual crypto allocation
  const cryptoData = (holdings.crypto_positions || []).map(pos => ({
    name: pos.symbol, // Fixed: crypto positions use 'symbol' not 'ticker'
    value: pos.qty * pos.current_price,
    percentage: cryptoValue > 0 ? ((pos.qty * pos.current_price) / cryptoValue * 100).toFixed(1) : '0'
  })).filter(item => item.value > 0)
  
  // Debug crypto data
  console.log('Crypto positions:', holdings.crypto_positions)
  console.log('Crypto data for chart:', cryptoData)

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { name: string; value: number; percentage: string } }[] }) => {
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

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, percentage }: {
    cx: number
    cy: number
    midAngle: number
    innerRadius: number
    outerRadius: number
    name: string
    percentage: string
  }) => {
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="bold"
        stroke="rgba(0,0,0,0.8)"
        strokeWidth="0.5"
        paintOrder="stroke fill"
      >
        {`${name} (${percentage}%)`}
      </text>
    )
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
                    outerRadius={70}
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
                    outerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {cryptoData.map((entry, index) => {
                      const color = COLORS[entry.name as keyof typeof COLORS] || CRYPTO_BACKUP_COLORS[index % CRYPTO_BACKUP_COLORS.length]
                      console.log(`Crypto ${entry.name} gets color:`, color)
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={color} 
                        />
                      )
                    })}
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