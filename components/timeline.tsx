'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Entry } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Copy, ChevronDown, ChevronUp } from 'lucide-react'

interface TimelineProps {
  entries: Entry[]
}

export function Timeline({ entries }: TimelineProps) {
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())

  const toggleEntry = (weekStart: string) => {
    const newExpanded = new Set(expandedEntries)
    if (newExpanded.has(weekStart)) {
      newExpanded.delete(weekStart)
    } else {
      newExpanded.add(weekStart)
    }
    setExpandedEntries(newExpanded)
  }

  const copyToClipboard = (entry: Entry) => {
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2))
  }

  let runningTotal = 0

  return (
    <div className="space-y-4">
      {entries.map((entry) => {
        runningTotal += entry.deposit_cad
        const isExpanded = expandedEntries.has(entry.week_start)

        return (
          <Card key={entry.week_start} className="shadow-sm">
            <CardHeader 
              className="cursor-pointer"
              onClick={() => toggleEntry(entry.week_start)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Week of {formatDate(entry.week_start)}
                  </CardTitle>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                    <span>Deposit: {formatCurrency(entry.deposit_cad)}</span>
                    <span>Trades: {entry.trades.length}</span>
                    <span>Running Total: {formatCurrency(runningTotal)}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      copyToClipboard(entry)
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
              <CardContent>
                {entry.trades.length > 0 ? (
                  <div className="space-y-4">
                    <h4 className="font-semibold">Trades</h4>
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
                          {entry.trades.map((trade, index) => (
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
                  </div>
                ) : (
                  <p className="text-muted-foreground">No trades this week</p>
                )}

                {entry.notes && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground">{entry.notes}</p>
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