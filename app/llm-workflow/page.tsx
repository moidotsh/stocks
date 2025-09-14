'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Copy, Check, AlertTriangle, CheckCircle, Bot, TrendingUp, FileText, ArrowRight, Terminal } from 'lucide-react'
import { CopyButton } from '@/components/ui/copy-button'

interface CandidateData {
  candidates: Array<{
    ticker?: string
    symbol?: string
    price?: number
    pct_change_1w?: number
    bucket?: string
    market_price?: number
    market_price_cad?: number
    effective_buy_price_cad?: number
    effective_sell_price_cad?: number
  }>
  holdings: Array<any>
  cash_available_cad: number
  constraints: {
    max_positions: number
    max_weight_per_position: number
    min_trade_size_cad: number
  }
  fractional_allowed: boolean
  as_of: string
}

interface LLMValidation {
  isValid: boolean
  errors?: string[]
  trades?: Array<any>
}

export default function LLMWorkflowPage() {
  const [activeTab, setActiveTab] = useState<'stocks' | 'crypto'>('stocks')
  const [stocksData, setStocksData] = useState<CandidateData | null>(null)
  const [cryptoData, setCryptoData] = useState<CandidateData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidatesDate, setCandidatesDate] = useState<string | null>(null)

  // LLM interaction states
  const [stocksPrompt, setStocksPrompt] = useState('')
  const [cryptoPrompt, setCryptoPrompt] = useState('')
  const [stocksResponse, setStocksResponse] = useState('')
  const [cryptoResponse, setCryptoResponse] = useState('')
  const [stocksValidation, setStocksValidation] = useState<LLMValidation | null>(null)
  const [cryptoValidation, setCryptoValidation] = useState<LLMValidation | null>(null)

  // Copy states
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [copiedPayload, setCopiedPayload] = useState(false)

  // Holdings export states
  const [exportingHoldings, setExportingHoldings] = useState(false)
  const [holdingsExported, setHoldingsExported] = useState(false)

  // Candidates import states
  const [importingCandidates, setImportingCandidates] = useState(false)
  const [candidatesImported, setCandidatesImported] = useState(false)

  const stocksLLMPrompt = `You are a portfolio rebalancer for a Canadian TFSA. Return ONLY valid JSON:
{
  "trades": [{ "action":"buy|sell", "ticker":"", "qty":0, "limit_price": null }],
  "holds": ["ticker1", "ticker2"],
  "rationale": "",
  "risk_notes": ""
}

Rules:
- Long-only stocks/ETFs. Respect cash_available_cad, max_positions, max_weight_per_position, min_trade_size_cad.
- DEPLOY AVAILABLE CASH: You should generally invest available cash rather than hold it, unless market conditions are poor.
- You can SELL existing holdings (even fractionally) to rebalance into better opportunities.
- Diversify across multiple positions when cash allows for meaningful trades (≥$1 each).
- Prefer CAD listings when materially similar to USD.
- ≤ 3 trades this week. Minimize churn.
- Use limit_price for planned limits (GTC). If it doesn't fill, nothing is recorded.
- Only tickers present in "candidates" (holdings already appended).
- Focus on "up" bucket candidates with strong momentum and liquidity.
- EXPLICITLY list all holdings you choose to KEEP in "holds" array (even if no trades).
- If truly no good opportunities: {"trades":[],"holds":["current_holdings"],"rationale":"No attractive opportunities","risk_notes":""}. No commentary outside JSON.`

  const cryptoLLMPrompt = `You are a crypto allocator. Return ONLY valid JSON:
{
  "trades": [{ "action":"buy|sell", "symbol":"", "qty":0, "limit_price": null }],
  "rationale": "",
  "risk_notes": ""
}
Rules:
- Long-only spot. Use fractional_allowed and min_trade_size_cad.
- Fees baked in: buys use effective_buy_price_cad; sells use effective_sell_price_cad.
- Σ(buy_qty*effective_buy) − Σ(sell_qty*effective_sell) ≤ cash_available_cad.
- It is acceptable to hold cash. Sell-only weeks allowed.
- ≤ 2 coins this week to reduce 2% fee drag. Market only (limit_price = null).
- Only symbols present in "candidates". If no changes: {"trades":[],"rationale":"No change","risk_notes":""}. No commentary outside JSON.`

  const loadCandidates = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Check if latest candidates exist
      const latestResponse = await fetch('/api/candidates/latest')
      if (!latestResponse.ok) {
        throw new Error('No candidate data found. Run screeners first.')
      }

      const latest = await latestResponse.json()
      const { date } = latest
      setCandidatesDate(date)

      // Load both stocks and crypto data
      const [stocksResponse, cryptoResponse] = await Promise.all([
        fetch(`/api/candidates/${date}/stocks`),
        fetch(`/api/candidates/${date}/crypto`)
      ])

      if (stocksResponse.ok) {
        const stocksData = await stocksResponse.json()
        setStocksData(stocksData)
      }

      if (cryptoResponse.ok) {
        const cryptoData = await cryptoResponse.json()
        setCryptoData(cryptoData)
      }

      setStocksPrompt(stocksLLMPrompt)
      setCryptoPrompt(cryptoLLMPrompt)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load candidates')
    } finally {
      setIsLoading(false)
    }
  }, [stocksLLMPrompt, cryptoLLMPrompt])

  const validateLLMResponse = (response: string, type: 'stocks' | 'crypto') => {
    try {
      const parsed = JSON.parse(response)

      // Basic validation
      if (!parsed.trades || !Array.isArray(parsed.trades)) {
        return { isValid: false, errors: ['Missing or invalid trades array'] }
      }

      if (!parsed.rationale || !parsed.risk_notes) {
        return { isValid: false, errors: ['Missing rationale or risk_notes'] }
      }

      if (type === 'stocks' && (!parsed.holds || !Array.isArray(parsed.holds))) {
        return { isValid: false, errors: ['Missing or invalid holds array'] }
      }

      // Validate each trade
      const errors: string[] = []
      const data = type === 'stocks' ? stocksData : cryptoData

      if (!data) {
        return { isValid: false, errors: ['No candidate data loaded'] }
      }

      const candidateSymbols = new Set(
        data.candidates.map(c => type === 'stocks' ? c.ticker : c.symbol).filter(Boolean)
      )

      let totalCost = 0

      for (const trade of parsed.trades) {
        if (!['buy', 'sell'].includes(trade.action)) {
          errors.push(`Invalid action: ${trade.action}`)
        }

        const symbol = type === 'stocks' ? trade.ticker : trade.symbol
        if (!symbol || !candidateSymbols.has(symbol)) {
          errors.push(`Invalid/missing ${type === 'stocks' ? 'ticker' : 'symbol'}: ${symbol}`)
        }

        if (!trade.qty || trade.qty <= 0) {
          errors.push(`Invalid quantity for ${symbol}: ${trade.qty}`)
        }

        // Calculate cost for validation
        if (trade.action === 'buy') {
          const candidate = data.candidates.find(c =>
            type === 'stocks' ? c.ticker === symbol : c.symbol === symbol
          )
          if (candidate) {
            const price = type === 'stocks'
              ? candidate.price || candidate.market_price || 0
              : candidate.effective_buy_price_cad || candidate.market_price_cad || 0
            totalCost += trade.qty * price
          }
        }
      }

      // Check cash constraint (with small tolerance for floating point precision)
      const tolerance = 0.01 // 1 cent tolerance
      if (totalCost > data.cash_available_cad + tolerance) {
        errors.push(`Total cost $${totalCost.toFixed(2)} exceeds available cash $${data.cash_available_cad.toFixed(2)}`)
      }

      // Check trade count
      const maxTrades = type === 'stocks' ? 3 : 2
      if (parsed.trades.length > maxTrades) {
        errors.push(`Too many trades: ${parsed.trades.length} (max ${maxTrades})`)
      }

      return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        trades: parsed.trades
      }

    } catch {
      return { isValid: false, errors: ['Invalid JSON format'] }
    }
  }

  const getCandidateStatusInfo = (data: CandidateData | null, date: string | null) => {
    if (!data || !date) return null

    const dataDate = new Date(date)
    const now = new Date()
    const hoursOld = (now.getTime() - dataDate.getTime()) / (1000 * 60 * 60)

    const isStale = hoursOld > 36
    const newCandidates = data.candidates.filter(c => c.bucket !== 'holding')
    const holdings = data.candidates.filter(c => c.bucket === 'holding')

    return {
      isStale,
      hoursOld: Math.round(hoursOld),
      totalCandidates: data.candidates.length,
      newCandidates: newCandidates.length,
      holdings: holdings.length,
      date,
      cash: data.cash_available_cad
    }
  }

  const copyToClipboard = async (text: string, type: 'prompt' | 'payload') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'prompt') {
        setCopiedPrompt(true)
        setTimeout(() => setCopiedPrompt(false), 2000)
      } else {
        setCopiedPayload(true)
        setTimeout(() => setCopiedPayload(false), 2000)
      }
    } catch {
      console.error('Failed to copy to clipboard')
    }
  }

  const handleResponseChange = (response: string, type: 'stocks' | 'crypto') => {
    if (type === 'stocks') {
      setStocksResponse(response)
      if (response.trim()) {
        setStocksValidation(validateLLMResponse(response, 'stocks'))
      } else {
        setStocksValidation(null)
      }
    } else {
      setCryptoResponse(response)
      if (response.trim()) {
        setCryptoValidation(validateLLMResponse(response, 'crypto'))
      } else {
        setCryptoValidation(null)
      }
    }
  }

  const proceedToTradeRecording = () => {
    const validation = activeTab === 'stocks' ? stocksValidation : cryptoValidation
    if (validation?.isValid && validation.trades) {
      // Store validated trades in localStorage for the trade recording page
      localStorage.setItem('llm_recommended_trades', JSON.stringify({
        asset: activeTab,
        trades: validation.trades,
        timestamp: Date.now()
      }))

      // Navigate to trade recording
      window.location.href = '/trades/record'
    }
  }

  const exportHoldings = async () => {
    setExportingHoldings(true)
    setHoldingsExported(false)

    try {
      const response = await fetch('/api/holdings/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setHoldingsExported(true)
        setTimeout(() => setHoldingsExported(false), 3000)
      } else {
        console.error('Failed to export holdings')
      }
    } catch (error) {
      console.error('Error exporting holdings:', error)
    } finally {
      setExportingHoldings(false)
    }
  }

  const importCandidates = async () => {
    setImportingCandidates(true)
    setCandidatesImported(false)

    try {
      const response = await fetch('/api/candidates/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        setCandidatesImported(true)
        setTimeout(() => setCandidatesImported(false), 3000)
        // Reload candidates after successful import
        loadCandidates()
      } else {
        const errorData = await response.json()
        console.error('Failed to import candidates:', errorData.error)
      }
    } catch (error) {
      console.error('Error importing candidates:', error)
    } finally {
      setImportingCandidates(false)
    }
  }

  useEffect(() => {
    loadCandidates()
  }, [])

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">LLM Trading Workflow</h1>
        <p className="text-muted-foreground">
          Streamlined process: Get candidates → Ask LLM → Validate response → Execute trades
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Workflow Steps */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Workflow Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">1</div>
                  <div className="text-sm">
                    <div className="font-medium">Load Candidates</div>
                    <div className="text-muted-foreground">Latest screener results</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-sm font-medium">2</div>
                  <div className="text-sm">
                    <div className="font-medium">Copy Prompt & Payload</div>
                    <div className="text-muted-foreground">Send to your LLM</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-medium">3</div>
                  <div className="text-sm">
                    <div className="font-medium">Validate Response</div>
                    <div className="text-muted-foreground">Check constraints</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-medium">4</div>
                  <div className="text-sm">
                    <div className="font-medium">Execute & Record</div>
                    <div className="text-muted-foreground">Trade & log fills</div>
                  </div>
                </div>
              </div>

              {/* Export Holdings */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100">Holdings Export</h4>
                  </div>
                  <Button
                    onClick={exportHoldings}
                    disabled={exportingHoldings}
                                        className="bg-blue-600 hover:bg-blue-700"
                  >
                    {exportingHoldings ? 'Exporting...' : 'Export Holdings CSV'}
                  </Button>
                </div>
                <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
                  Generate holdings.csv and crypto_holdings.csv from your current portfolio for use with Python screeners.
                </p>
                {holdingsExported && (
                  <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                    <CheckCircle className="h-3 w-3" />
                    Holdings CSV files exported successfully
                  </div>
                )}
              </div>

              {/* Import Candidates */}
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <h4 className="font-medium text-sm text-green-900 dark:text-green-100">Import Python Candidates</h4>
                  </div>
                  <Button
                    onClick={importCandidates}
                    disabled={importingCandidates}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {importingCandidates ? 'Importing...' : 'Import Candidates'}
                  </Button>
                </div>
                <p className="text-xs text-green-800 dark:text-green-200 mb-2">
                  Import llm_candidates.json and llm_candidates_crypto.json from python/tfsa-llm/ to make them available in the web app.
                </p>
                {candidatesImported && (
                  <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                    <CheckCircle className="h-3 w-3" />
                    Candidate files imported successfully
                  </div>
                )}
              </div>

              {/* Screener Commands */}
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal className="h-4 w-4" />
                  <h4 className="font-medium text-sm">Python Screener Commands</h4>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Stocks</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 overflow-x-auto">
                        cd python/scripts && python screener_top40_fractional.py --cash 11 --fractional --min-trade-size 1 --holdings ../outputs/holdings.csv --tsx-only
                      </code>
                      <CopyButton
                        text="cd python/scripts && python screener_top40_fractional.py --cash 11 --fractional --min-trade-size 1 --holdings ../outputs/holdings.csv --tsx-only"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Crypto</div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 overflow-x-auto">
                        cd python/scripts && python screener_crypto_top40_fractional.py --cash 11 --fractional --min-trade-size 1 --holdings ../outputs/crypto_holdings.csv --pages 3
                      </code>
                      <CopyButton
                        text="cd python/scripts && python screener_crypto_top40_fractional.py --cash 11 --fractional --min-trade-size 1 --holdings ../outputs/crypto_holdings.csv --pages 3"
                                              />
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">📁 Next Step</div>
                    <div className="text-xs text-blue-800 dark:text-blue-200">
                      After running the screeners, use the green <strong>"Import Candidates"</strong> button above to make them available in the web app.
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground mt-3">
                  💡 Run these commands from your project root directory (where holdings.csv is located)
                </div>
              </div>

              <Button
                onClick={loadCandidates}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                {isLoading ? 'Loading...' : 'Refresh Candidates'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Workflow */}
        <div className="lg:col-span-2">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'stocks' | 'crypto')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stocks" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Stocks
              </TabsTrigger>
              <TabsTrigger value="crypto" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Crypto
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stocks" className="space-y-4">
              {stocksData ? (
                <div className="space-y-4">
                  {/* Candidates Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Stocks Candidates</span>
                        {(() => {
                          const status = getCandidateStatusInfo(stocksData, candidatesDate)
                          return status?.isStale ? (
                            <div className="flex items-center gap-1 text-orange-600 text-sm font-normal">
                              <AlertTriangle className="h-4 w-4" />
                              <span>Stale ({status.hoursOld}h old)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600 text-sm font-normal">
                              <CheckCircle className="h-4 w-4" />
                              <span>Fresh</span>
                            </div>
                          )
                        })()
                        }
                      </CardTitle>
                      <CardDescription>
                        {(() => {
                          const status = getCandidateStatusInfo(stocksData, candidatesDate)
                          return status ? (
                            <>
                              {status.newCandidates} new candidates, {status.holdings} holdings • ${status.cash} available
                              <br />
                              <span className="text-xs">Generated: {status.date}</span>
                            </>
                          ) : (
                            `${stocksData.candidates.length} candidates • $${stocksData.cash_available_cad} available`
                          )
                        })()
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const status = getCandidateStatusInfo(stocksData, candidatesDate)
                        if (status?.isStale) {
                          return (
                            <Alert variant="destructive" className="mb-4">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                Candidate data is {status.hoursOld} hours old (stale after 36h).
                                Run fresh screeners for optimal results.
                              </AlertDescription>
                            </Alert>
                          )
                        }
                        if (status && status.newCandidates < 10) {
                          return (
                            <Alert className="mb-4">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                Only {status.newCandidates} new candidates found.
                                Consider running screeners with more liquidity or broader criteria.
                              </AlertDescription>
                            </Alert>
                          )
                        }
                        return null
                      })()
                      }
                      <div className="text-sm text-muted-foreground">
                        Max positions: {stocksData.constraints.max_positions} •
                        Min trade: ${stocksData.constraints.min_trade_size_cad} •
                        Fractional: {stocksData.fractional_allowed ? 'Yes' : 'No'}
                      </div>
                    </CardContent>
                  </Card>

                  {/* LLM Interaction */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        LLM Interaction
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Prompt */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Prompt</label>
                          <Button
                            onClick={() => copyToClipboard(stocksPrompt, 'prompt')}
                                                        variant="outline"
                          >
                            {copiedPrompt ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <div className="bg-muted p-3 rounded text-xs font-mono whitespace-pre-wrap">
                          {stocksPrompt}
                        </div>
                      </div>

                      {/* Payload */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">JSON Payload</label>
                          <Button
                            onClick={() => copyToClipboard(JSON.stringify(stocksData, null, 2), 'payload')}
                                                        variant="outline"
                          >
                            {copiedPayload ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <div className="bg-muted p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                          {JSON.stringify(stocksData, null, 2)}
                        </div>
                      </div>

                      {/* Response */}
                      <div>
                        <label className="text-sm font-medium">LLM Response</label>
                        <textarea
                          value={stocksResponse}
                          onChange={(e) => handleResponseChange(e.target.value, 'stocks')}
                          placeholder="Paste LLM JSON response here..."
                          className="w-full mt-1 p-3 border rounded text-sm font-mono"
                          rows={6}
                        />

                        {stocksValidation && (
                          <div className={`mt-2 flex items-center gap-2 text-sm ${stocksValidation.isValid ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {stocksValidation.isValid ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <AlertTriangle className="h-4 w-4" />
                            )}
                            <span>
                              {stocksValidation.isValid ? 'Valid response!' : 'Validation failed'}
                            </span>
                            {stocksValidation.errors && (
                              <div className="ml-2 text-xs">
                                ({stocksValidation.errors.join(', ')})
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Proceed Button */}
                      {stocksValidation?.isValid && (
                        <Button
                          onClick={proceedToTradeRecording}
                          className="w-full"
                          size="lg"
                        >
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Proceed to Trade Recording
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No stocks candidates loaded</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="crypto" className="space-y-4">
              {cryptoData ? (
                <div className="space-y-4">
                  {/* Candidates Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Crypto Candidates</span>
                        {(() => {
                          const status = getCandidateStatusInfo(cryptoData, candidatesDate)
                          return status?.isStale ? (
                            <div className="flex items-center gap-1 text-orange-600 text-sm font-normal">
                              <AlertTriangle className="h-4 w-4" />
                              <span>Stale ({status.hoursOld}h old)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-green-600 text-sm font-normal">
                              <CheckCircle className="h-4 w-4" />
                              <span>Fresh</span>
                            </div>
                          )
                        })()
                        }
                      </CardTitle>
                      <CardDescription>
                        {(() => {
                          const status = getCandidateStatusInfo(cryptoData, candidatesDate)
                          return status ? (
                            <>
                              {status.newCandidates} new candidates, {status.holdings} holdings • ${status.cash} available
                              <br />
                              <span className="text-xs">Generated: {status.date}</span>
                            </>
                          ) : (
                            `${cryptoData.candidates.length} candidates • $${cryptoData.cash_available_cad} available`
                          )
                        })()
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const status = getCandidateStatusInfo(cryptoData, candidatesDate)
                        if (status?.isStale) {
                          return (
                            <Alert variant="destructive" className="mb-4">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                Candidate data is {status.hoursOld} hours old (stale after 36h).
                                Run fresh screeners for optimal results.
                              </AlertDescription>
                            </Alert>
                          )
                        }
                        if (status && status.newCandidates < 5) {
                          return (
                            <Alert className="mb-4">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                Only {status.newCandidates} new candidates found.
                                Consider running screeners with more coins or different criteria.
                              </AlertDescription>
                            </Alert>
                          )
                        }
                        return null
                      })()
                      }
                      <div className="text-sm text-muted-foreground">
                        Max positions: {cryptoData.constraints?.max_positions || 'N/A'} •
                        Min trade: ${cryptoData.constraints.min_trade_size_cad} •
                        Fractional: {cryptoData.fractional_allowed ? 'Yes' : 'No'}
                      </div>
                    </CardContent>
                  </Card>

                  {/* LLM Interaction */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        LLM Interaction
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Prompt */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Prompt</label>
                          <Button
                            onClick={() => copyToClipboard(cryptoPrompt, 'prompt')}
                                                        variant="outline"
                          >
                            {copiedPrompt ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <div className="bg-muted p-3 rounded text-xs font-mono whitespace-pre-wrap">
                          {cryptoPrompt}
                        </div>
                      </div>

                      {/* Payload */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">JSON Payload</label>
                          <Button
                            onClick={() => copyToClipboard(JSON.stringify(cryptoData, null, 2), 'payload')}
                                                        variant="outline"
                          >
                            {copiedPayload ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <div className="bg-muted p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                          {JSON.stringify(cryptoData, null, 2)}
                        </div>
                      </div>

                      {/* Response */}
                      <div>
                        <label className="text-sm font-medium">LLM Response</label>
                        <textarea
                          value={cryptoResponse}
                          onChange={(e) => handleResponseChange(e.target.value, 'crypto')}
                          placeholder="Paste LLM JSON response here..."
                          className="w-full mt-1 p-3 border rounded text-sm font-mono"
                          rows={6}
                        />

                        {cryptoValidation && (
                          <div className={`mt-2 flex items-center gap-2 text-sm ${cryptoValidation.isValid ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {cryptoValidation.isValid ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <AlertTriangle className="h-4 w-4" />
                            )}
                            <span>
                              {cryptoValidation.isValid ? 'Valid response!' : 'Validation failed'}
                            </span>
                            {cryptoValidation.errors && (
                              <div className="ml-2 text-xs">
                                ({cryptoValidation.errors.join(', ')})
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Proceed Button */}
                      {cryptoValidation?.isValid && (
                        <Button
                          onClick={proceedToTradeRecording}
                          className="w-full"
                          size="lg"
                        >
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Proceed to Trade Recording
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No crypto candidates loaded</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}