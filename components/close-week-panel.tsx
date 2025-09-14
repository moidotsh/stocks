'use client'

import { Button } from '@/components/ui/button'
import { CalendarCheck, AlertTriangle, CheckCircle, ExternalLink, TrendingUp } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface CloseWeekPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function CloseWeekPanel({ isOpen, onClose }: CloseWeekPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [weekSummary, setWeekSummary] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [forceReplace, setForceReplace] = useState(false)
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false)
  const [latestCandidatesDate, setLatestCandidatesDate] = useState<string | null>(null)

  const fetchWeekSummary = async () => {
    setIsLoading(true)
    setError(null)
    try {
      // Fetch latest candidates date and portfolio data
      const [candidatesResponse, portfolioResponse] = await Promise.all([
        fetch('/api/candidates/latest'),
        fetch('/api/portfolio-data')
      ])

      let candidatesDate = null
      if (candidatesResponse.ok) {
        const candidatesData = await candidatesResponse.json()
        candidatesDate = candidatesData.date
        setLatestCandidatesDate(candidatesDate)
      }

      if (!portfolioResponse.ok) {
        throw new Error('Failed to fetch portfolio data')
      }

      const portfolioData = await portfolioResponse.json()
      setWeekSummary({ ...portfolioData, candidatesDate })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const createWeekSnapshot = async () => {
    setIsCreatingSnapshot(true)
    try {
      const response = await fetch('/api/capture-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReplace })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create week snapshot')
      }

      const result = await response.json()
      alert(`Week snapshot created successfully!`)
      
      // Refresh summary after creating snapshot
      await fetchWeekSummary()
    } catch (error) {
      alert(`Error creating week snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCreatingSnapshot(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchWeekSummary()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarCheck className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Complete Week</h2>
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
            {isCreatingSnapshot ? 'Creating...' : 'Complete Week'}
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
          <p className="text-sm text-muted-foreground mt-2">Loading portfolio data...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Portfolio Status */}
          {weekSummary && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Portfolio Status
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Total Value</div>
                  <div className="font-mono text-lg">
                    ${weekSummary.totalValue?.toFixed(2) || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Stock Positions</div>
                  <div className="font-mono text-lg">
                    {weekSummary.stockPositions || 0}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Crypto Positions</div>
                  <div className="font-mono text-lg">
                    {weekSummary.cryptoPositions || 0}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Available Cash</div>
                  <div className="font-mono text-lg">
                    ${weekSummary.cashCad?.toFixed(2) || '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Workflow Status */}
          <div className="bg-card border rounded-lg p-4">
            <h3 className="font-medium mb-4">Weekly Workflow Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">1. Fresh candidates available</span>
                <div className="flex items-center gap-2">
                  {latestCandidatesDate ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-muted-foreground">{latestCandidatesDate}</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="text-xs text-orange-500">Run screeners</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">2. LLM workflow & trade recording</span>
                <Link 
                  href="/llm-workflow" 
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  Go to LLM Workflow <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm">3. Complete week with snapshot</span>
                <span className="text-xs text-muted-foreground">Click "Complete Week" above</span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          {weekSummary?.recentEntries && weekSummary.recentEntries.length > 0 && (
            <div className="bg-card border rounded-lg p-4">
              <h3 className="font-medium mb-3">Recent Activity</h3>
              <div className="space-y-2">
                {weekSummary.recentEntries.slice(-3).map((entry: any, index: number) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>{entry.date}</span>
                    <div className="flex items-center gap-4">
                      <span>Deposit: ${entry.deposit_cad}</span>
                      <span className="text-muted-foreground">
                        {entry.trades_summary || 'No trades'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Link href="/llm-workflow">
              <Button variant="outline" size="sm">
                LLM Workflow
              </Button>
            </Link>
            <Link href="/trades/record">
              <Button variant="outline" size="sm">
                Record Trades
              </Button>
            </Link>
            <Link href="/portfolio">
              <Button variant="outline" size="sm">
                View Portfolio
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}