'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Entry } from '@/lib/types'
import { useCurrency } from '@/lib/currency-context'
import { formatDate } from '@/lib/utils'
import { Copy, ChevronDown, ChevronUp } from 'lucide-react'

interface TimelineProps {
  entries: Entry[]
}

export function Timeline({ entries }: TimelineProps) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set())
  const { formatCurrency } = useCurrency()

  const toggleWeek = (weekStart: string) => {
    const newExpanded = new Set(expandedWeeks)
    if (newExpanded.has(weekStart)) {
      newExpanded.delete(weekStart)
    } else {
      newExpanded.add(weekStart)
    }
    setExpandedWeeks(newExpanded)
  }

  // Detect entry type based on ticker symbols and trade types
  const getEntryType = (entry: Entry): 'stocks' | 'crypto' => {
    const cryptoTickers = ['BTC', 'ETH', 'DOGE', 'AVAX', 'DOT', 'ENA', 'WLD', 'BNB', 'MOODENG']

    // Check regular trades for crypto
    const hasCryptoInTrades = entry.trades.some(trade => cryptoTickers.includes(trade.ticker))

    // Check crypto_trades array
    const hasCryptoTrades = entry.crypto_trades && entry.crypto_trades.length > 0

    return hasCryptoInTrades || hasCryptoTrades ? 'crypto' : 'stocks'
  }

  const copyToClipboard = (entries: Entry[]) => {
    navigator.clipboard.writeText(JSON.stringify(entries, null, 2))
  }

  // Group entries by week
  const groupedEntries = entries.reduce((groups, entry) => {
    const week = entry.week_start
    if (!groups[week]) {
      groups[week] = []
    }
    groups[week].push(entry)
    return groups
  }, {} as Record<string, Entry[]>)

  // Sort weeks chronologically
  const sortedWeeks = Object.keys(groupedEntries).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  )

  let runningTotal = 0

  return (
    <div className="space-y-6">
      {sortedWeeks.map((weekStart) => {
        const weekEntries = groupedEntries[weekStart]
        const weekDeposit = weekEntries.reduce((sum, entry) => sum + entry.deposit_cad, 0)
        const totalTrades = weekEntries.reduce((sum, entry) => sum + entry.trades.length, 0)
        runningTotal += weekDeposit
        
        const stockEntry = weekEntries.find(entry => getEntryType(entry) === 'stocks')
        const cryptoEntry = weekEntries.find(entry => getEntryType(entry) === 'crypto')
        
        const isExpanded = expandedWeeks.has(weekStart)

        return (
          <Card key={weekStart} className="shadow-sm border-2">
            <CardHeader 
              className="cursor-pointer"
              onClick={() => toggleWeek(weekStart)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Week of {formatDate(weekStart)}
                  </CardTitle>
                  <div className="flex items-center gap-3 mt-2">
                    {stockEntry && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        📈 Stocks
                      </span>
                    )}
                    {cryptoEntry && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                        ₿ Crypto
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                    <span>Total Deposit: {formatCurrency(weekDeposit)}</span>
                    <span>Total Trades: {totalTrades}</span>
                    <span>Running Total: {formatCurrency(runningTotal)}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      copyToClipboard(weekEntries)
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-6">
                {stockEntry && (
                  <div className="border-l-4 border-l-blue-500 pl-4 bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-r-lg">
                    <h4 className="font-semibold flex items-center gap-2 mb-3">
                      <span>📈</span> Stock Trades
                    </h4>
                    {stockEntry.trades.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Action</th>
                              <th className="text-left p-2">Ticker</th>
                              <th className="text-right p-2">Quantity</th>
                              <th className="text-right p-2">Price</th>
                              <th className="text-right p-2">Value</th>
                              <th className="text-left p-2">Currency</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stockEntry.trades.map((trade, index) => (
                              <tr key={index} className="border-b">
                                <td className="p-2">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    trade.action === 'buy' 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                  }`}>
                                    {trade.action.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-2 font-mono">{trade.ticker}</td>
                                <td className="text-right p-2">{trade.qty}</td>
                                <td className="text-right p-2">{formatCurrency(trade.price)}</td>
                                <td className="text-right p-2">{formatCurrency(trade.qty * trade.price)}</td>
                                <td className="p-2">{trade.currency}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No stock trades this week</p>
                    )}
                  </div>
                )}

                {cryptoEntry && (
                  <div className="border-l-4 border-l-orange-500 pl-4 bg-orange-50/50 dark:bg-orange-950/20 p-4 rounded-r-lg">
                    <h4 className="font-semibold flex items-center gap-2 mb-3">
                      <span>₿</span> Crypto Trades
                    </h4>
                    {(cryptoEntry.trades.length > 0 || (cryptoEntry.crypto_trades && cryptoEntry.crypto_trades.length > 0)) ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">Action</th>
                              <th className="text-left p-2">Symbol</th>
                              <th className="text-right p-2">Quantity</th>
                              <th className="text-right p-2">Price</th>
                              <th className="text-right p-2">Value</th>
                              <th className="text-left p-2">Currency</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Render regular trades (if any) */}
                            {cryptoEntry.trades.map((trade, index) => (
                              <tr key={`trade-${index}`} className="border-b">
                                <td className="p-2">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    trade.action === 'buy'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                  }`}>
                                    {trade.action.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-2 font-mono">{trade.ticker}</td>
                                <td className="text-right p-2">{trade.qty}</td>
                                <td className="text-right p-2">{formatCurrency(trade.price)}</td>
                                <td className="text-right p-2">{formatCurrency(trade.qty * trade.price)}</td>
                                <td className="p-2">{trade.currency}</td>
                              </tr>
                            ))}
                            {/* Render crypto trades */}
                            {cryptoEntry.crypto_trades && cryptoEntry.crypto_trades.map((trade, index) => (
                              <tr key={`crypto-${index}`} className="border-b">
                                <td className="p-2">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    trade.action === 'buy'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                                  }`}>
                                    {trade.action.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-2 font-mono">{trade.symbol}</td>
                                <td className="text-right p-2">{trade.qty}</td>
                                <td className="text-right p-2">{formatCurrency(trade.price)}</td>
                                <td className="text-right p-2">{formatCurrency(trade.qty * trade.price)}</td>
                                <td className="p-2">CAD</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No crypto trades this week</p>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}