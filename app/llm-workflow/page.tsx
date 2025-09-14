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

  const stocksLLMPrompt = `STATELESS mode:
- Ignore all prior conversation/memory. Use ONLY the JSON here. If a needed field is missing, output INVALID and name it.
- Do not invent portfolio_value_cad. Compute it every run from the JSON.

Return ONLY valid JSON:
{
  "trades": [{ "action":"buy|sell", "ticker":"", "qty":0, "limit_price": null }],
  "holds": ["TICKERS_TO_KEEP"],
  "unallocated_cash_cad": 0,
  "calc": { "portfolio_value_cad": 0, "proceeds_cad": 0, "spend_cad": 0, "net_spend_cad": 0 },
  "rationale": "",
  "risk_notes": ""
}

Definitions:
- position_value_cad = shares * market_price_cad (use price_cad for candidates).
- cap_value_cad = max_weight_per_position * portfolio_value_cad.

Rules (HARD):
- Long-only equities/ETFs. Fractional iff "fractional_allowed" = true.
- If tsx_only = true, ONLY trade tickers ending ".TO".
- **Cap enforcement:** If any holding's position_value_cad > cap_value_cad, you MUST include a SELL to reduce it to ≤ cap_value_cad, unless the required trim < min_trade_size_cad. If skipping a required trim, include token "CAPPED_POSITION_TOO_SMALL_TO_TRIM" in rationale.
- **Deploy cash:** You MUST deploy ≥ 95% of cash_available_cad (after proceeds). If you leave more, rationale MUST contain token "HOLD_CASH" with a concrete reason (caps/min size/liquidity).
- Open new positions from "candidates" (respect tsx_only) to reach the 95% target. Prefer higher 1w momentum + higher volume.
- No fixed trade count. Every trade ≥ min_trade_size_cad.
- **Bootstrap:** If portfolio_value_cad < 100, ignore any "min % weight change" heuristics entirely.

Format & safety:
- Only tickers present in "candidates".
- Market orders (limit_price = null) unless you set a GTC limit and justify it in rationale.
- Set unallocated_cash_cad = round(cash_available_cad + proceeds_cad − spend_cad, 2). It MUST be ≥ 0 (no margin).
- "holds" must be the exact set of tickers kept after trades.
- "rationale" and "risk_notes" must be non-empty, meaningful.

VALIDATION (answer is INVALID unless ALL pass):
- portfolio_value_cad = cash_available_cad + Σ(holdings.shares * holdings.market_price_cad). No invented values.
- unallocated_cash_cad = round(cash_available_cad + proceeds_cad − spend_cad, 2) and ≥ 0.
- Post-trade every position_value_cad ≤ cap_value_cad, or you emitted "CAPPED_POSITION_TOO_SMALL_TO_TRIM".
- If unallocated_cash_cad > 0.05 * cash_available_cad and rationale lacks "HOLD_CASH", recompute.
- Do not trade any ticker not in "candidates".`

  const cryptoLLMPrompt = `STATeless mode:
- You MUST ignore any prior conversation or remembered context.
- Use ONLY the JSON in this message. If you need a value that isn't in the JSON, set output to INVALID and explain which field is missing.
- Do not invent portfolio_value_cad. Compute it from the JSON each run.

Return ONLY valid JSON:
{
  "trades": [{ "action":"buy|sell", "symbol":"", "qty":0, "limit_price": null }],
  "holds": ["SYMBOLS_TO_KEEP"],
  "unallocated_cash_cad": 0,
  "calc": { "portfolio_value_cad": 0, "proceeds_cad": 0, "spend_cad": 0, "net_spend_cad": 0 },
  "rationale": "",
  "risk_notes": ""
}

Rules (hard):
- Long-only spot. Use fractional_allowed and min_trade_size_cad.
- Fees baked in: buys use effective_buy_price_cad; sells use effective_sell_price_cad.
- position_value_cad = amount * market_price_cad.
- cap_per_position_cad = max_weight_per_position * portfolio_value_cad - position_value_cad (floor at 0).
- You MUST deploy ≥95% of cash_available_cad (after fees), unless you output a non-empty "rationale" that explicitly includes the token "HOLD_CASH" and why (caps/min size/liquidity).
- No fixed trade count. Prefer fewer, larger trades but you MAY use as many trades as needed to hit the 95% target while respecting caps.
- To reach 95%: first top up existing 'up' holdings to their caps; if cash remains, OPEN new 'up' positions (best combo of high volume + strong 1w momentum) until you hit caps/max_positions or the 95% target.
- You MAY SELL 'down' or over-weight holdings to fund better 'up' opportunities; realized proceeds increase spendable cash. Avoid dust: each trade must be ≥ min_trade_size_cad AND must change that position's weight by ≥ 0.5 percentage points of portfolio value (skip this second rule if portfolio_value_cad < 50).

Rules (format & safety):
- Only symbols present in "candidates".
- Market orders only (limit_price = null).
- Respect max_positions and max_weight_per_position at all times.
- Set "unallocated_cash_cad" = round(cash_available_cad + proceeds - spend, 2).
- Set "calc" fields with your arithmetic (rounded to cents).
- If you leave >5% unallocated, explain exactly why in "rationale" (e.g., caps/min size). 
- Do not promise profits; state risks in "risk_notes".
- "rationale" and "risk_notes" must be non-empty strings with meaningful content.

VALIDATION:
- Compute portfolio_value_cad = cash_available_cad + Σ(amount*market_price_cad). Do not invent values.
- Set unallocated_cash_cad = round(cash_available_cad + proceeds_cad - spend_cad, 2). If this != your arithmetic, your answer is INVALID — recompute and re-output.
- If unallocated_cash_cad > 0.05*cash_available_cad and rationale does not include the token "HOLD_CASH", your answer is INVALID — revise with additional trades (open new 'up' positions if caps block deployment).`

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

  const validateCryptoPlan = (payload: any, plan: any) => {
    const cash = parseFloat(payload.cash_available_cad)
    const maxW = parseFloat(payload.constraints.max_weight_per_position)
    const minTrade = parseFloat(payload.constraints.min_trade_size_cad)

    // Build price maps
    const effBuy: Record<string, number> = {}
    const effSell: Record<string, number> = {}
    const mkt: Record<string, number> = {}
    
    for (const c of payload.candidates) {
      if (c.effective_buy_price_cad !== null && c.effective_buy_price_cad !== undefined) {
        effBuy[c.symbol] = parseFloat(c.effective_buy_price_cad)
      }
      if (c.effective_sell_price_cad !== null && c.effective_sell_price_cad !== undefined) {
        effSell[c.symbol] = parseFloat(c.effective_sell_price_cad)
      }
      if (c.market_price_cad !== null && c.market_price_cad !== undefined) {
        mkt[c.symbol] = parseFloat(c.market_price_cad)
      }
    }

    // Current holdings
    const hAmt: Record<string, number> = {}
    let hVal = 0
    for (const h of payload.holdings) {
      hAmt[h.symbol] = parseFloat(h.amount)
      const marketPrice = parseFloat(h.market_price_cad || mkt[h.symbol] || 0)
      hVal += parseFloat(h.amount) * marketPrice
    }

    // Spend/proceeds
    let spend = 0
    let proceeds = 0
    const pos = { ...hAmt }

    for (const t of plan.trades) {
      const sym = t.symbol
      const qty = parseFloat(t.qty)
      
      if (t.action === 'buy') {
        const price = effBuy[sym]
        if (price === undefined) return [false, `Missing effective_buy_price for ${sym}`]
        const cost = qty * price
        if (cost + 1e-9 < minTrade) return [false, `Trade < min size: ${sym} ${cost.toFixed(2)}`]
        spend += cost
        pos[sym] = (pos[sym] || 0) + qty
      } else if (t.action === 'sell') {
        const price = effSell[sym]
        if (price === undefined) return [false, `Missing effective_sell_price for ${sym}`]
        const rev = qty * price
        if (rev + 1e-9 < minTrade) return [false, `Trade < min size: ${sym} ${rev.toFixed(2)}`]
        proceeds += rev
        if (qty - 1e-9 > (pos[sym] || 0)) return [false, `Oversell ${sym}`]
        pos[sym] = (pos[sym] || 0) - qty
      } else {
        return [false, `Bad action ${t.action}`]
      }
    }

    // Cash math
    const unalloc = Math.round((cash + proceeds - spend) * 100) / 100
    const planUnalloc = plan.unallocated_cash_cad !== undefined && plan.unallocated_cash_cad !== null 
      ? parseFloat(plan.unallocated_cash_cad) 
      : 999
    if (Math.abs(unalloc - planUnalloc) > 0.01) {
      return [false, `Unallocated mismatch. Expected ${unalloc.toFixed(2)}, got ${planUnalloc}`]
    }

    // Weight caps post-trade
    const port1 = unalloc + Object.entries(pos).reduce((sum, [sym, amt]) => 
      sum + (amt || 0) * (mkt[sym] || 0), 0)
    
    for (const [sym, amt] of Object.entries(pos)) {
      const val = (amt || 0) * (mkt[sym] || 0)
      if (port1 > 0 && val > maxW * port1 + 1e-6) {
        return [false, `Cap breach ${sym}: ${val.toFixed(2)} > ${(maxW * port1).toFixed(2)}`]
      }
    }

    // 95% deploy of cash unless HOLD_CASH
    if (cash > 0 && unalloc > Math.round(0.05 * cash * 100) / 100 && 
        !(plan.rationale || '').includes('HOLD_CASH')) {
      return [false, `Left ${unalloc.toFixed(2)} unallocated without HOLD_CASH rationale`]
    }

    return [true, 'OK']
  }

  const validateLLMResponse = (response: string, type: 'stocks' | 'crypto') => {
    try {
      const parsed = JSON.parse(response)

      // Basic validation
      if (!parsed.trades || !Array.isArray(parsed.trades)) {
        return { isValid: false, errors: ['Missing or invalid trades array'] }
      }

      if (!parsed.rationale || !parsed.risk_notes || 
          typeof parsed.rationale !== 'string' || typeof parsed.risk_notes !== 'string' ||
          parsed.rationale.trim() === '' || parsed.risk_notes.trim() === '') {
        return { isValid: false, errors: ['Missing rationale or risk_notes'] }
      }

      if (!parsed.holds || !Array.isArray(parsed.holds)) {
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
      }

      // Use advanced crypto validation if available
      if (type === 'crypto') {
        const [isValid, message] = validateCryptoPlan(data, parsed)
        if (!isValid) {
          errors.push(message as string)
        }
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
                        cd python/scripts && python screener_crypto_top40_fractional.py --cash 11 --fractional --min-trade-size 1 --holdings ../outputs/crypto_holdings.csv
                      </code>
                      <CopyButton
                        text="cd python/scripts && python screener_crypto_top40_fractional.py --cash 11 --fractional --min-trade-size 1 --holdings ../outputs/crypto_holdings.csv"
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