'use client'

import { Button } from '@/components/ui/button'
import { CalendarCheck, Copy, Check, AlertTriangle, CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { validateLLMOutput } from '@/lib/llm-validator'

interface CloseWeekPanelProps {
  isOpen: boolean
  onClose: () => void
}

const ValidationStatus = ({ validation, type }: { validation: any, type: string }) => {
  if (!validation) return null
  
  return (
    <div className={`flex items-center gap-2 text-sm ${
      validation.isValid ? 'text-green-600' : 'text-red-600'
    }`}>
      {validation.isValid ? (
        <CheckCircle className="h-4 w-4" />
      ) : (
        <AlertTriangle className="h-4 w-4" />
      )}
      <span>
        {validation.isValid 
          ? `Valid ${type} JSON` 
          : `Invalid ${type} JSON`}
      </span>
      {!validation.isValid && validation.errors && (
        <div className="text-xs">
          ({validation.errors.join(', ')})
        </div>
      )}
    </div>
  )
}

export function CloseWeekPanel({ isOpen, onClose }: CloseWeekPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [portfolioSummary, setPortfolioSummary] = useState<any>(null)
  const [cryptoSummary, setCryptoSummary] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [stocksOutput, setStocksOutput] = useState('')
  const [cryptoOutput, setCryptoOutput] = useState('')
  const [stocksValidation, setStocksValidation] = useState<{ isValid: boolean; errors?: string[] } | null>(null)
  const [cryptoValidation, setCryptoValidation] = useState<{ isValid: boolean; errors?: string[] } | null>(null)
  const [copiedStocks, setCopiedStocks] = useState(false)
  const [copiedCrypto, setCopiedCrypto] = useState(false)
  const [forceReplace, setForceReplace] = useState(false)
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false)

  const fetchSummaries = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [stocksResponse, cryptoResponse] = await Promise.all([
        fetch('/api/close-week?type=stocks'),
        fetch('/api/close-week?type=crypto')
      ])

      if (!stocksResponse.ok || !cryptoResponse.ok) {
        throw new Error('Failed to fetch summaries')
      }

      const [stocksData, cryptoData] = await Promise.all([
        stocksResponse.json(),
        cryptoResponse.json()
      ])

      setPortfolioSummary(stocksData)
      setCryptoSummary(cryptoData)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const createWeekSnapshot = async () => {
    setIsCreatingSnapshot(true)
    try {
      const body = forceReplace ? JSON.stringify({ forceReplace: true }) : undefined
      const response = await fetch('/api/close-week', {
        method: 'POST',
        ...(body && {
          headers: { 'Content-Type': 'application/json' },
          body
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create week snapshot')
      }

      const result = await response.json()
      alert(`Week snapshot created successfully! ${result.message}`)
      
      // Refresh summaries after creating snapshot
      await fetchSummaries()
    } catch (error) {
      alert(`Error creating week snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCreatingSnapshot(false)
    }
  }

  const validateOutput = (output: string, type: 'stocks' | 'crypto') => {
    try {
      const parsed = JSON.parse(output)
      
      // Extract validation context from the summaries
      const summary = type === 'stocks' ? portfolioSummary?.summary : cryptoSummary?.summary
      if (!summary) {
        // If no summary loaded yet, just do basic JSON validation
        const basicValidation = {
          isValid: true,
          errors: []
        }
        if (type === 'stocks') {
          setStocksValidation(basicValidation)
        } else {
          setCryptoValidation(basicValidation)
        }
        return
      }

      // Build price map and allowed set from candidates
      const payload = type === 'stocks' ? summary.stock_payload : summary.crypto_payload
      const candidates = payload?.candidates || []
      
      const priceBySymbol: Record<string, number> = {}
      const allowedSet = new Set<string>()
      
      candidates.forEach((candidate: any) => {
        if (type === 'stocks') {
          const ticker = candidate.ticker
          if (ticker) {
            allowedSet.add(ticker)
            priceBySymbol[ticker] = candidate.market_price || 0
          }
        } else {
          const symbol = candidate.symbol
          if (symbol) {
            allowedSet.add(symbol)
            priceBySymbol[symbol] = candidate.effective_buy_price_cad || candidate.market_price_cad || 0
          }
        }
      })

      // Call the proper validation
      const fullValidation = validateLLMOutput(parsed, {
        isCrypto: type === 'crypto',
        cashAvailable: payload?.cash_available_cad || 0,
        minTrade: payload?.constraints?.min_trade_size_cad || 1,
        maxTrades: payload?.constraints?.max_trades || (type === 'stocks' ? 3 : 2),
        priceBySymbol,
        allowedSet
      })
      
      // Adapt the validation result to match our state interface
      const validation = {
        isValid: fullValidation.valid,
        errors: fullValidation.valid ? [] : [fullValidation.error || 'Validation failed']
      }
      
      if (type === 'stocks') {
        setStocksValidation(validation)
      } else {
        setCryptoValidation(validation)
      }
    } catch {
      const validation = { 
        isValid: false, 
        errors: ['Invalid JSON format'] 
      }
      
      if (type === 'stocks') {
        setStocksValidation(validation)
      } else {
        setCryptoValidation(validation)
      }
    }
  }

  const copyToClipboard = async (text: string, type: 'stocks' | 'crypto') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'stocks') {
        setCopiedStocks(true)
        setTimeout(() => setCopiedStocks(false), 2000)
      } else {
        setCopiedCrypto(true)
        setTimeout(() => setCopiedCrypto(false), 2000)
      }
    } catch {
      console.error('Failed to copy to clipboard')
    }
  }

  useEffect(() => {
    if (isOpen && !portfolioSummary && !cryptoSummary) {
      fetchSummaries()
    }
  }, [isOpen, portfolioSummary, cryptoSummary])

  if (!isOpen) return null

  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Close Week</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="forceReplace"
              checked={forceReplace}
              onChange={(e) => setForceReplace(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="forceReplace" className="text-sm text-muted-foreground">
              Force replace existing snapshot
            </label>
          </div>
          <Button
            onClick={createWeekSnapshot}
            disabled={isCreatingSnapshot}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            {isCreatingSnapshot ? 'Creating...' : 'Create Week Snapshot'}
          </Button>
          <Button onClick={onClose} variant="ghost" size="sm">
            ×
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Error</span>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading summaries...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Week Summary */}
          {(portfolioSummary || cryptoSummary) && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-medium mb-3">Week Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Current Week</div>
                  <div className="font-mono text-lg">
                    {portfolioSummary?.summary?.current_week || cryptoSummary?.summary?.current_week || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">This Week&apos;s Deposit</div>
                  <div className="font-mono text-lg">
                    ${portfolioSummary?.summary?.next_week_deposit || cryptoSummary?.summary?.next_week_deposit || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Total Contributed</div>
                  <div className="font-mono text-lg">
                    ${portfolioSummary?.summary?.total_contributed_to_date || cryptoSummary?.summary?.total_contributed_to_date || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Week Period</div>
                  <div className="font-mono text-sm">
                    {portfolioSummary?.summary?.week_start || cryptoSummary?.summary?.week_start || '—'} to{' '}
                    {portfolioSummary?.summary?.week_end || cryptoSummary?.summary?.week_end || '—'}
                  </div>
                </div>
              </div>
              
              {/* Cash Allocation Breakdown */}
              <div className="mt-4 pt-3 border-t border-border">
                <div className="text-sm text-muted-foreground mb-2">Planned Cash Allocation (Full deposit to EACH):</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Stocks Cash:</span>
                    <span className="font-mono">
                      ${portfolioSummary?.summary?.cash_available?.stock_cash?.toFixed(2) || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Crypto Cash:</span>
                    <span className="font-mono">
                      ${cryptoSummary?.summary?.cash_available?.crypto_cash?.toFixed(2) || '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Weekly Workflow Instructions */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="workflow">
              <AccordionTrigger>Sunday Workflow</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">1. Decide this week&apos;s cash split (stocks vs crypto)</h4>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">2. Run the screeners:</h4>
                    <div className="bg-muted p-3 rounded font-mono text-xs space-y-2">
                      <div># Stocks</div>
                      <div>python3 screener_top40_fractional.py \</div>
                      <div className="ml-4">--cash &lt;stocks_cash_this_week&gt; \</div>
                      <div className="ml-4">--fractional --min-trade-size 1 \</div>
                      <div className="ml-4">--holdings holdings.csv</div>
                      <div className="mt-3"># Crypto (2% fee baked-in)</div>
                      <div>python3 screener_crypto_top40_fractional.py \</div>
                      <div className="ml-4">--cash &lt;crypto_cash_this_week&gt; \</div>
                      <div className="ml-4">--fractional --min-trade-size 1 \</div>
                      <div className="ml-4">--holdings crypto_holdings.csv --pages 3</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">3. Move files to site data folder:</h4>
                    <div className="bg-muted p-3 rounded font-mono text-xs space-y-1">
                      <div>DATE=$(date +%F)</div>
                      <div>mkdir -p data/candidates/$DATE</div>
                      <div>mv llm_candidates.json data/candidates/$DATE/stocks.json</div>
                      <div>mv llm_candidates_crypto.json data/candidates/$DATE/crypto.json</div>
                      <div>printf {`'{"{"}"latest":"%s"{"}"}{"\n"}'`} &quot;$DATE&quot; {">"}  data/candidates/latest.json</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">4. Use this Close Week panel to:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Copy the JSON payloads for each LLM</li>
                      <li>Get trading recommendations</li>
                      <li>Execute trades on Wealthsimple</li>
                      <li>Create week completion snapshot</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stocks Section */}
          <div className="space-y-4">
            <h3 className="text-md font-medium">Stocks (TFSA)</h3>
            
            {portfolioSummary?.warning && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Stale Data Warning</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{portfolioSummary.warning}</p>
              </div>
            )}

            {portfolioSummary && (
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium mb-2">LLM Prompt:</h4>
                  <div className="bg-muted p-3 rounded text-xs font-mono whitespace-pre-wrap">
                    {portfolioSummary.summary.prompts?.stock_prompt || 'You are a portfolio rebalancer for a Canadian TFSA. Return ONLY valid JSON:\n{\n  "trades": [{ "action":"buy|sell", "ticker":"", "qty":0, "limit_price": null }],\n  "rationale": "",\n  "risk_notes": ""\n}\nRules:\n- Long-only stocks/ETFs. Respect cash_available_cad, max_positions, max_weight_per_position, min_trade_size_cad, max_trades.\n- Prefer CAD listings when materially similar to USD.\n- Holding cash and sell-only weeks are allowed. Do not auto-redeploy sale proceeds.\n- Use limit_price only if you want a GTC limit; otherwise null (market). If it doesn\'t fill, nothing is recorded.\n- Only use tickers present in "candidates" (holdings already appended).\n- If no changes: {"trades":[],"rationale":"No change","risk_notes":""}. No text outside JSON.'}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">JSON Payload:</h4>
                  <div className="bg-muted p-3 rounded text-sm">
                    <pre className="whitespace-pre-wrap font-mono text-xs">
                      {JSON.stringify(portfolioSummary.summary.stock_payload || portfolioSummary.summary, null, 2)}
                    </pre>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => copyToClipboard(JSON.stringify(portfolioSummary.summary.stock_payload || portfolioSummary.summary, null, 2), 'stocks')}
                    size="sm"
                    variant="outline"
                  >
                    {copiedStocks ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy JSON Payload
                      </>
                    )}
                  </Button>
                </div>

                <div>
                  <label className="text-sm font-medium">Test LLM Output:</label>
                  <textarea
                    value={stocksOutput}
                    onChange={(e) => {
                      setStocksOutput(e.target.value)
                      if (e.target.value.trim()) {
                        validateOutput(e.target.value, 'stocks')
                      } else {
                        setStocksValidation(null)
                      }
                    }}
                    placeholder="Paste LLM JSON response to validate..."
                    className="w-full mt-1 p-2 border rounded text-sm font-mono"
                    rows={4}
                  />
                  <ValidationStatus validation={stocksValidation} type="stocks" />
                </div>
              </div>
            )}
          </div>

          {/* Crypto Section */}
          <div className="space-y-4">
            <h3 className="text-md font-medium">Crypto (Wealthsimple Crypto)</h3>
            
            {cryptoSummary?.warning && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Stale Data Warning</span>
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{cryptoSummary.warning}</p>
              </div>
            )}

            {cryptoSummary && (
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium mb-2">LLM Prompt:</h4>
                  <div className="bg-muted p-3 rounded text-xs font-mono whitespace-pre-wrap">
                    {cryptoSummary.summary.prompts?.crypto_prompt || 'You are a crypto allocator. Return ONLY valid JSON:\n{\n  "trades": [{ "action":"buy|sell", "symbol":"", "qty":0, "limit_price": null }],\n  "rationale": "",\n  "risk_notes": ""\n}\nRules:\n- Long-only spot. Enforce fractional_allowed, min_trade_size_cad, max_trades.\n- Fees baked in: buys use effective_buy_price_cad; sells use effective_sell_price_cad.\n- Σ(buy_qty*effective_buy) − Σ(sell_qty*effective_sell) ≤ cash_available_cad.\n- Holding cash and sell-only weeks are allowed. Market only (limit_price = null).\n- Use only symbols in "candidates" (holdings appended). If no changes: return empty trades. No text outside JSON.'}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">JSON Payload:</h4>
                  <div className="bg-muted p-3 rounded text-sm">
                    <pre className="whitespace-pre-wrap font-mono text-xs">
                      {JSON.stringify(cryptoSummary.summary.crypto_payload || cryptoSummary.summary, null, 2)}
                    </pre>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => copyToClipboard(JSON.stringify(cryptoSummary.summary.crypto_payload || cryptoSummary.summary, null, 2), 'crypto')}
                    size="sm"
                    variant="outline"
                  >
                    {copiedCrypto ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy JSON Payload
                      </>
                    )}
                  </Button>
                </div>

                <div>
                  <label className="text-sm font-medium">Test LLM Output:</label>
                  <textarea
                    value={cryptoOutput}
                    onChange={(e) => {
                      setCryptoOutput(e.target.value)
                      if (e.target.value.trim()) {
                        validateOutput(e.target.value, 'crypto')
                      } else {
                        setCryptoValidation(null)
                      }
                    }}
                    placeholder="Paste LLM JSON response to validate..."
                    className="w-full mt-1 p-2 border rounded text-sm font-mono"
                    rows={4}
                  />
                  <ValidationStatus validation={cryptoValidation} type="crypto" />
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  )
}