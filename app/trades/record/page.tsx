'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Trash2, Plus, DollarSign, Calculator, TrendingUp, TrendingDown, Undo, Bot, Import } from 'lucide-react'

interface EquityTrade {
  action: 'buy' | 'sell'
  ticker: string
  qty: number
  unit_price: number
  currency: 'CAD' | 'USD'
}

interface CryptoTrade {
  action: 'buy' | 'sell'
  symbol: string
  qty: number
  unit_price: number
}

interface TradeImpact {
  newEquityHoldings: Array<{ ticker: string; shares: number; avg_cost: number; currency: string }>
  newCryptoHoldings: Array<{ symbol: string; amount: number; avg_cost_cad: number }>
  totalCost: number
  netCashFlow: number
  currentEquityValue: number
  currentCryptoValue: number
  newEquityValue: number
  newCryptoValue: number
  portfolioValueChange: number
}

function getNearestSunday(): string {
  const today = new Date()
  const dayOfWeek = today.getDay()
  
  if (dayOfWeek === 0) {
    // Today is Sunday
    return today.toISOString().split('T')[0]
  } else {
    // Next Sunday
    const daysUntilSunday = 7 - dayOfWeek
    const nextSunday = new Date(today.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000)
    return nextSunday.toISOString().split('T')[0]
  }
}

export default function TradeRecordPage() {
  const [assetType, setAssetType] = useState<'equity' | 'crypto'>('equity')
  const [weekStart, setWeekStart] = useState(getNearestSunday())
  const [depositCad, setDepositCad] = useState<number>(0)
  const [notes, setNotes] = useState('')
  
  const [equityTrades, setEquityTrades] = useState<EquityTrade[]>([])
  const [cryptoTrades, setCryptoTrades] = useState<CryptoTrade[]>([])
  
  const [preview, setPreview] = useState<TradeImpact | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUndoing, setIsUndoing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [llmRecommendations, setLlmRecommendations] = useState<any>(null)

  const addEquityTrade = () => {
    setEquityTrades([...equityTrades, {
      action: 'buy',
      ticker: '',
      qty: 0,
      unit_price: 0,
      currency: 'CAD'
    }])
  }

  const addCryptoTrade = () => {
    setCryptoTrades([...cryptoTrades, {
      action: 'buy',
      symbol: '',
      qty: 0,
      unit_price: 0
    }])
  }

  const removeEquityTrade = (index: number) => {
    setEquityTrades(equityTrades.filter((_, i) => i !== index))
  }

  const removeCryptoTrade = (index: number) => {
    setCryptoTrades(cryptoTrades.filter((_, i) => i !== index))
  }

  const updateEquityTrade = (index: number, field: keyof EquityTrade, value: any) => {
    const updated = [...equityTrades]
    updated[index] = { ...updated[index], [field]: value }
    setEquityTrades(updated)
  }

  const updateCryptoTrade = (index: number, field: keyof CryptoTrade, value: any) => {
    const updated = [...cryptoTrades]
    updated[index] = { ...updated[index], [field]: value }
    setCryptoTrades(updated)
  }

  const loadPreview = async () => {
    if (equityTrades.length === 0 && cryptoTrades.length === 0) {
      setPreview(null)
      return
    }

    setIsLoadingPreview(true)
    setError(null)

    try {
      const response = await fetch('/api/trades/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equityTrades: equityTrades.filter(t => t.ticker && t.qty > 0),
          cryptoTrades: cryptoTrades.filter(t => t.symbol && t.qty > 0)
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load preview')
      }

      setPreview(data.impact)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handleSubmit = async () => {
    // Client-side validation
    const validEquityTrades = equityTrades.filter(t => t.ticker?.trim() && t.qty > 0 && t.unit_price > 0)
    const validCryptoTrades = cryptoTrades.filter(t => t.symbol?.trim() && t.qty > 0 && t.unit_price > 0)
    const hasChanges = depositCad > 0 || validEquityTrades.length > 0 || validCryptoTrades.length > 0

    if (!hasChanges) {
      setError('Please add a deposit amount or valid trades before submitting.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/trades/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: assetType,
          weekStart,
          depositCad,
          equityTrades: validEquityTrades,
          cryptoTrades: validCryptoTrades,
          notes: notes || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record trades')
      }

      setSuccess('Trades recorded successfully!')
      
      // Reset form
      setEquityTrades([])
      setCryptoTrades([])
      setDepositCad(0)
      setNotes('')
      setPreview(null)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record trades')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUndo = async () => {
    setIsUndoing(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/trades/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset: assetType })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to undo last operation')
      }

      setSuccess(`Undo successful! Restored from ${data.backupUsed}`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to undo last operation')
    } finally {
      setIsUndoing(false)
    }
  }

  const loadLLMRecommendations = () => {
    try {
      const stored = localStorage.getItem('llm_recommended_trades')
      if (stored) {
        const recommendations = JSON.parse(stored)
        
        // Check if recommendations are recent (less than 1 hour old)
        const age = Date.now() - recommendations.timestamp
        if (age > 60 * 60 * 1000) {
          localStorage.removeItem('llm_recommended_trades')
          return
        }
        
        setLlmRecommendations(recommendations)
        setAssetType(recommendations.asset)
        
        // Convert LLM trades to our format
        const trades = recommendations.trades || []
        if (recommendations.asset === 'equity') {
          const convertedTrades: EquityTrade[] = trades.map((trade: any) => ({
            action: trade.action,
            ticker: trade.ticker,
            qty: trade.qty || 0,
            unit_price: 0, // User needs to fill in actual price
            currency: 'CAD' // Default to CAD, user can change
          }))
          setEquityTrades(convertedTrades)
        } else {
          const convertedTrades: CryptoTrade[] = trades.map((trade: any) => ({
            action: trade.action,
            symbol: trade.symbol,
            qty: trade.qty || 0,
            unit_price: 0 // User needs to fill in actual price
          }))
          setCryptoTrades(convertedTrades)
        }
        
        // Clear the stored recommendations
        localStorage.removeItem('llm_recommended_trades')
      }
    } catch (err) {
      console.error('Failed to load LLM recommendations:', err)
    }
  }

  useEffect(() => {
    loadLLMRecommendations()
  }, [])

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Record Trades</h1>
        <p className="text-muted-foreground">
          Enter executed trades and update your holdings. This replaces the Python ledger_tui.py script.
        </p>
      </div>

      {llmRecommendations && (
        <Alert className="border-blue-200 bg-blue-50 text-blue-800">
          <Bot className="h-4 w-4" />
          <AlertDescription>
            Loaded {llmRecommendations.trades.length} LLM-recommended trades for {llmRecommendations.asset}. 
            Please fill in the actual execution prices and quantities based on your Wealthsimple fills.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Main Form */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Entry</CardTitle>
            <CardDescription>
              Record your executed trades for this week
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="asset-type">Asset Type</Label>
                <Select value={assetType} onValueChange={(value: 'equity' | 'crypto') => setAssetType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="week-start">Week Start</Label>
                <Input
                  id="week-start"
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit">Weekly Deposit (CAD)</Label>
              <Input
                id="deposit"
                type="number"
                min="0"
                step="0.01"
                value={depositCad}
                onChange={(e) => setDepositCad(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Week notes..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Portfolio Impact Preview
            </CardTitle>
            <CardDescription>
              See how your trades will affect your portfolio
            </CardDescription>
          </CardHeader>
          <CardContent>
            {preview ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Total Cost</div>
                    <div className="text-2xl font-bold">${preview.totalCost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="font-medium">Net Cash Flow</div>
                    <div className={`text-2xl font-bold ${preview.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${preview.netCashFlow.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="font-medium mb-2">Portfolio Value Change</div>
                  <div className={`text-xl font-bold flex items-center gap-2 ${
                    preview.portfolioValueChange >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {preview.portfolioValueChange >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    ${preview.portfolioValueChange.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ${(preview.currentEquityValue + preview.currentCryptoValue).toFixed(2)} → ${(preview.newEquityValue + preview.newCryptoValue).toFixed(2)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Add trades to see portfolio impact
              </div>
            )}
            
            <Button 
              onClick={loadPreview} 
              disabled={isLoadingPreview || (equityTrades.length === 0 && cryptoTrades.length === 0)}
              className="w-full mt-4"
              variant="outline"
            >
              {isLoadingPreview ? 'Loading...' : 'Update Preview'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Equity Trades */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Equity Trades</CardTitle>
              <CardDescription>Stocks and ETFs traded this week</CardDescription>
            </div>
            <Button onClick={addEquityTrade} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Trade
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {equityTrades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No equity trades yet. Click "Add Trade" to start.
            </div>
          ) : (
            equityTrades.map((trade, index) => (
              <div key={index} className="grid grid-cols-6 gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select 
                    value={trade.action} 
                    onValueChange={(value: 'buy' | 'sell') => updateEquityTrade(index, 'action', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Ticker</Label>
                  <Input
                    value={trade.ticker}
                    onChange={(e) => updateEquityTrade(index, 'ticker', e.target.value.toUpperCase())}
                    placeholder="ABX.TO"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.000001"
                    value={trade.qty}
                    onChange={(e) => updateEquityTrade(index, 'qty', parseFloat(e.target.value) || 0)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={trade.unit_price}
                    onChange={(e) => updateEquityTrade(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select 
                    value={trade.currency} 
                    onValueChange={(value: 'CAD' | 'USD') => updateEquityTrade(index, 'currency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CAD">CAD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Actions</Label>
                  <Button 
                    onClick={() => removeEquityTrade(index)} 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Crypto Trades */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Crypto Trades</CardTitle>
              <CardDescription>Cryptocurrency traded this week</CardDescription>
            </div>
            <Button onClick={addCryptoTrade} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Trade
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {cryptoTrades.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No crypto trades yet. Click "Add Trade" to start.
            </div>
          ) : (
            cryptoTrades.map((trade, index) => (
              <div key={index} className="grid grid-cols-5 gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select 
                    value={trade.action} 
                    onValueChange={(value: 'buy' | 'sell') => updateCryptoTrade(index, 'action', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <Input
                    value={trade.symbol}
                    onChange={(e) => updateCryptoTrade(index, 'symbol', e.target.value.toUpperCase())}
                    placeholder="BTC"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.000001"
                    value={trade.qty}
                    onChange={(e) => updateCryptoTrade(index, 'qty', parseFloat(e.target.value) || 0)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Unit Price (CAD)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={trade.unit_price}
                    onChange={(e) => updateCryptoTrade(index, 'unit_price', parseFloat(e.target.value) || 0)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Actions</Label>
                  <Button 
                    onClick={() => removeCryptoTrade(index)} 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-between items-center">
        <Button 
          onClick={handleUndo}
          disabled={isUndoing}
          variant="outline"
          size="lg"
        >
          <Undo className="h-4 w-4 mr-2" />
          {isUndoing ? 'Undoing...' : 'Undo Last Operation'}
        </Button>
        
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          size="lg"
        >
          <DollarSign className="h-4 w-4 mr-2" />
          {isSubmitting ? 'Recording...' : 'Record Trades'}
        </Button>
      </div>
    </div>
  )
}