'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Holdings } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import { useState } from 'react'

interface PortfolioTableProps {
  holdings: Holdings
}

export function PortfolioTable({ holdings }: PortfolioTableProps) {
  const [activeTab, setActiveTab] = useState<'combined' | 'stocks' | 'crypto'>('combined')
  
  // Stock calculations
  const stockMarketValue = holdings.positions.reduce((sum, pos) => 
    sum + (pos.shares * pos.market_price), 0)
  
  const stockUnrealizedPL = holdings.positions.reduce((sum, pos) => 
    sum + ((pos.market_price - pos.avg_cost) * pos.shares), 0)
  
  // Crypto calculations
  const cryptoMarketValue = (holdings.crypto_positions || []).reduce((sum, pos) => 
    sum + (pos.qty * pos.current_price), 0)
  
  const cryptoUnrealizedPL = (holdings.crypto_positions || []).reduce((sum, pos) => 
    sum + ((pos.qty * pos.current_price) - (pos.qty * pos.avg_cost)), 0)
  
  // Combined totals
  const totalMarketValue = stockMarketValue + cryptoMarketValue
  const totalUnrealizedPL = stockUnrealizedPL + cryptoUnrealizedPL

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Holdings Breakdown</CardTitle>
        <div className="flex space-x-1 mt-4">
          {(['combined', 'stocks', 'crypto'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Ticker</th>
                <th className="text-right p-3">Shares</th>
                <th className="text-right p-3">Avg Cost</th>
                <th className="text-right p-3">Market Price</th>
                <th className="text-right p-3">Market Value</th>
                <th className="text-right p-3">Unrealized P/L</th>
                <th className="text-left p-3">Currency</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'combined' || activeTab === 'stocks') && holdings.positions.map((position) => {
                const marketValue = position.shares * position.market_price
                const unrealizedPL = (position.market_price - position.avg_cost) * position.shares
                
                return (
                  <tr key={position.ticker} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-mono font-medium">{position.ticker}</td>
                    <td className="text-right p-3">{position.shares.toFixed(3)}</td>
                    <td className="text-right p-3">{formatCurrency(position.avg_cost)}</td>
                    <td className="text-right p-3">{formatCurrency(position.market_price)}</td>
                    <td className="text-right p-3">{formatCurrency(marketValue)}</td>
                    <td className={`text-right p-3 ${
                      unrealizedPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(unrealizedPL)}
                    </td>
                    <td className="p-3">{position.currency}</td>
                  </tr>
                )
              })}
              
              {/* Crypto Positions */}
              {(activeTab === 'combined' || activeTab === 'crypto') && (holdings.crypto_positions || []).map((position) => {
                const marketValue = position.qty * position.current_price
                const unrealizedPL = marketValue - (position.qty * position.avg_cost)
                
                return (
                  <tr key={position.symbol} className="border-b hover:bg-muted/50 bg-orange-50 dark:bg-orange-950/20">
                    <td className="p-3 font-mono font-medium">
                      {position.symbol}
                      <span className="text-xs text-muted-foreground ml-1">(Crypto)</span>
                    </td>
                    <td className="text-right p-3">{position.qty.toFixed(8)}</td>
                    <td className="text-right p-3">{formatCurrency(position.avg_cost)}</td>
                    <td className="text-right p-3">{formatCurrency(position.current_price)}</td>
                    <td className="text-right p-3">{formatCurrency(marketValue)}</td>
                    <td className={`text-right p-3 ${
                      unrealizedPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatCurrency(unrealizedPL)}
                    </td>
                    <td className="p-3">CAD</td>
                  </tr>
                )
              })}
              
              {activeTab === 'combined' && holdings.cash_cad > 0 && (
                <tr className="border-b hover:bg-muted/50">
                  <td className="p-3 font-medium">Cash</td>
                  <td className="text-right p-3">-</td>
                  <td className="text-right p-3">-</td>
                  <td className="text-right p-3">-</td>
                  <td className="text-right p-3">{formatCurrency(holdings.cash_cad)}</td>
                  <td className="text-right p-3">-</td>
                  <td className="p-3">CAD</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-semibold">
                <td className="p-3">Total</td>
                <td className="text-right p-3">-</td>
                <td className="text-right p-3">-</td>
                <td className="text-right p-3">-</td>
                <td className="text-right p-3">
                  {formatCurrency(
                    activeTab === 'stocks' ? stockMarketValue :
                    activeTab === 'crypto' ? cryptoMarketValue :
                    totalMarketValue + holdings.cash_cad
                  )}
                </td>
                <td className={`text-right p-3 ${
                  (activeTab === 'stocks' ? stockUnrealizedPL :
                   activeTab === 'crypto' ? cryptoUnrealizedPL :
                   totalUnrealizedPL) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(
                    activeTab === 'stocks' ? stockUnrealizedPL :
                    activeTab === 'crypto' ? cryptoUnrealizedPL :
                    totalUnrealizedPL
                  )}
                </td>
                <td className="p-3">-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}