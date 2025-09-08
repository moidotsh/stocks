'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Minus } from 'lucide-react'
import { Trade } from '@/lib/types'

export function AdminForm() {
  const [weekStart, setWeekStart] = useState('')
  const [depositCad, setDepositCad] = useState('')
  const [notes, setNotes] = useState('')
  const [trades, setTrades] = useState<Trade[]>([])

  const addTrade = () => {
    setTrades([...trades, {
      action: 'buy',
      ticker: '',
      qty: 0,
      price: 0,
      currency: 'CAD'
    }])
  }

  const removeTrade = (index: number) => {
    setTrades(trades.filter((_, i) => i !== index))
  }

  const updateTrade = (index: number, field: keyof Trade, value: string | number) => {
    const updatedTrades = trades.map((trade, i) => 
      i === index ? { ...trade, [field]: value } : trade
    )
    setTrades(updatedTrades)
  }

  const generateJson = () => {
    const entry = {
      week_start: weekStart,
      deposit_cad: parseFloat(depositCad) || 0,
      trades: trades.filter(trade => trade.ticker && trade.qty > 0 && trade.price > 0),
      ...(notes && { notes })
    }

    return JSON.stringify(entry, null, 2)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateJson())
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Add Weekly Entry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="week-start">Week Start (Sunday)</Label>
            <Input
              id="week-start"
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="deposit">Deposit (CAD)</Label>
            <Input
              id="deposit"
              type="number"
              step="0.01"
              min="0"
              value={depositCad}
              onChange={(e) => setDepositCad(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <Label>Trades</Label>
            <Button onClick={addTrade} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Trade
            </Button>
          </div>
          
          <div className="space-y-4">
            {trades.map((trade, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Trade {index + 1}</span>
                  <Button
                    onClick={() => removeTrade(index)}
                    variant="ghost"
                    size="sm"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <Label>Action</Label>
                    <select 
                      className="w-full p-2 border rounded-md bg-background"
                      value={trade.action}
                      onChange={(e) => updateTrade(index, 'action', e.target.value as 'buy' | 'sell')}
                    >
                      <option value="buy">Buy</option>
                      <option value="sell">Sell</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label>Ticker</Label>
                    <Input
                      value={trade.ticker}
                      onChange={(e) => updateTrade(index, 'ticker', e.target.value)}
                      placeholder="XIU.TO"
                    />
                  </div>
                  
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      step="0.001"
                      min="0"
                      value={trade.qty || ''}
                      onChange={(e) => updateTrade(index, 'qty', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div>
                    <Label>Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={trade.price || ''}
                      onChange={(e) => updateTrade(index, 'price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div>
                    <Label>Currency</Label>
                    <select 
                      className="w-full p-2 border rounded-md bg-background"
                      value={trade.currency}
                      onChange={(e) => updateTrade(index, 'currency', e.target.value as 'CAD' | 'USD')}
                    >
                      <option value="CAD">CAD</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Short weekly note..."
          />
        </div>

        <div className="space-y-4">
          <Label>Generated JSON:</Label>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
            {generateJson()}
          </pre>
          
          <Button onClick={copyToClipboard} className="w-full">
            Copy to Clipboard
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}