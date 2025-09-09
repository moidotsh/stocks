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
  
  // Smart number formatting to remove trailing zeros
  const formatQuantity = (num: number) => {
    if (num === 0) return '0'
    // For very small numbers, show up to 8 decimals but remove trailing zeros
    if (num < 0.001) {
      return parseFloat(num.toFixed(8)).toString()
    }
    // For larger numbers, show up to 6 decimals but remove trailing zeros
    if (num < 1) {
      return parseFloat(num.toFixed(6)).toString()
    }
    // For numbers >= 1, show up to 3 decimals but remove trailing zeros
    return parseFloat(num.toFixed(3)).toString()
  }
  
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
        {/* Mobile card layout */}
        <div className="sm:hidden space-y-3">
          {(activeTab === 'combined' || activeTab === 'stocks') && holdings.positions.map((position) => {
            const marketValue = position.shares * position.market_price
            const unrealizedPL = (position.market_price - position.avg_cost) * position.shares
            
            return (
              <div key={position.ticker} className="border rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-mono font-medium text-lg">{position.ticker}</h4>
                  <span className="text-sm text-muted-foreground">{position.currency}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Shares:</span>
                    <div className="font-medium">{formatQuantity(position.shares)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Cost:</span>
                    <div className="font-medium">{formatCurrency(position.avg_cost)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Market Price:</span>
                    <div className="font-medium">{formatCurrency(position.market_price)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Market Value:</span>
                    <div className="font-medium">{formatCurrency(marketValue)}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Unrealized P/L:</span>
                  <span className={`font-medium ${
                    unrealizedPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(unrealizedPL)}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Crypto positions in mobile card layout */}
          {(activeTab === 'combined' || activeTab === 'crypto') && (holdings.crypto_positions || []).map((position) => {
            const marketValue = position.qty * position.current_price
            const unrealizedPL = marketValue - (position.qty * position.avg_cost)
            
            return (
              <div key={position.symbol} className="border rounded-lg p-4 space-y-2 bg-orange-50/50 dark:bg-orange-950/20">
                <div className="flex justify-between items-center">
                  <h4 className="font-mono font-medium text-lg">
                    {position.symbol}
                    <span className="text-xs text-muted-foreground ml-1">(Crypto)</span>
                  </h4>
                  <span className="text-sm text-muted-foreground">CAD</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Quantity:</span>
                    <div className="font-medium">{formatQuantity(position.qty)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Avg Cost:</span>
                    <div className="font-medium">{formatCurrency(position.avg_cost)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current Price:</span>
                    <div className="font-medium">{formatCurrency(position.current_price)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Market Value:</span>
                    <div className="font-medium">{formatCurrency(marketValue)}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Unrealized P/L:</span>
                  <span className={`font-medium ${
                    unrealizedPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {formatCurrency(unrealizedPL)}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Cash in mobile layout */}
          {activeTab === 'combined' && holdings.cash_cad > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="font-medium text-lg">Cash</h4>
                <span className="text-sm text-muted-foreground">CAD</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Value:</span>
                <span className="font-medium">{formatCurrency(holdings.cash_cad)}</span>
              </div>
            </div>
          )}

          {/* Mobile totals */}
          <div className="border-2 border-primary/20 rounded-lg p-4 bg-primary/5">
            <div className="flex justify-between items-center">
              <h4 className="font-semibold text-lg">Total</h4>
              <div className="text-right">
                <div className="font-semibold text-lg">
                  {formatCurrency(
                    activeTab === 'stocks' ? stockMarketValue :
                    activeTab === 'crypto' ? cryptoMarketValue :
                    totalMarketValue + holdings.cash_cad
                  )}
                </div>
                <div className={`text-sm ${
                  (activeTab === 'stocks' ? stockUnrealizedPL :
                   activeTab === 'crypto' ? cryptoUnrealizedPL :
                   totalUnrealizedPL) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCurrency(
                    activeTab === 'stocks' ? stockUnrealizedPL :
                    activeTab === 'crypto' ? cryptoUnrealizedPL :
                    totalUnrealizedPL
                  )} P/L
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop table layout with better scroll indicators */}
        <div className="hidden sm:block">
          <div className="overflow-x-auto relative">
            {/* Scroll fade indicators for larger screens */}
            <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none lg:hidden z-10" />
            
            <table className="w-full text-sm min-w-[600px]">
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
                    <td className="text-right p-3">{formatQuantity(position.shares)}</td>
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
                    <td className="text-right p-3">{formatQuantity(position.qty)}</td>
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
        </div>
      </CardContent>
    </Card>
  )
}