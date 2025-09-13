'use client'

import { useState, useEffect } from 'react'
import { KpiCards } from '@/components/kpi-cards'
import { PerformanceChart } from '@/components/performance-chart'
import { WeekSelector } from '@/components/week-selector'
import { KpiCardsSkeleton } from '@/components/kpi-cards-skeleton'
import { PerformanceChartSkeleton } from '@/components/performance-chart-skeleton'
import { PriceRefreshButton } from '@/components/price-refresh-button'
import { SnapshotButton } from '@/components/snapshot-button'
import { CloseWeekButton } from '@/components/close-week-button'
import { CloseWeekPanel } from '@/components/close-week-panel'
import { PortfolioData } from '@/lib/types'
import { Settings } from 'lucide-react'

interface PortfolioDashboardProps {
  initialData: PortfolioData
  totalWeeks: number
}

export function PortfolioDashboard({ initialData, totalWeeks }: PortfolioDashboardProps) {
  const [selectedWeek, setSelectedWeek] = useState('current')
  const [data, setData] = useState<PortfolioData>(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [showAdminControls, setShowAdminControls] = useState(false)
  const [isLocalhost, setIsLocalhost] = useState(false)
  const [showCloseWeekPanel, setShowCloseWeekPanel] = useState(false)

  useEffect(() => {
    setIsLocalhost(
      typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' ||
       window.location.hostname === '0.0.0.0')
    )
  }, [])

  useEffect(() => {
    const fetchDataForWeek = async () => {
      if (selectedWeek === 'current') {
        // Use initial data for current view
        setData(initialData)
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`/api/portfolio-data?asOfWeek=${selectedWeek}`)
        if (response.ok) {
          const portfolioData = await response.json()
          setData(portfolioData)
        } else {
          console.error('Failed to fetch portfolio data for week:', selectedWeek)
          // Fallback to initial data
          setData(initialData)
        }
      } catch (error) {
        console.error('Error fetching portfolio data:', error)
        setData(initialData)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDataForWeek()
  }, [selectedWeek, initialData])

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 animate-slide-up">
        {/* Header with integrated controls */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold">Portfolio Overview</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Track your TFSA performance against benchmarks
            </p>
          </div>
          
          {/* Controls section */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {/* Week selector */}
            <div className="flex items-center gap-2">
              <WeekSelector 
                selectedWeek={selectedWeek} 
                onWeekChange={setSelectedWeek}
                totalWeeks={totalWeeks}
              />
              {selectedWeek !== 'current' && (
                <div className="text-xs text-muted-foreground bg-amber-100 dark:bg-amber-900/20 px-2 py-1 rounded whitespace-nowrap">
                  Historical
                </div>
              )}
            </div>

            {/* Admin controls - only on localhost */}
            {isLocalhost && (
              <div className="flex items-center gap-2">
                <div className="w-px h-6 bg-border hidden sm:block" />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowAdminControls(!showAdminControls)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
                    title="Admin controls"
                  >
                    <Settings className="h-3 w-3" />
                    <span className="hidden sm:inline">Admin</span>
                  </button>
                  
                  {showAdminControls && (
                    <div className="flex items-center gap-1 animate-fade-in">
                      <SnapshotButton />
                      <CloseWeekButton 
                        onToggle={() => setShowCloseWeekPanel(!showCloseWeekPanel)}
                        isActive={showCloseWeekPanel}
                      />
                      <PriceRefreshButton />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close Week Panel - full width below header */}
      {showCloseWeekPanel && (
        <div className="animate-fade-in">
          <CloseWeekPanel 
            isOpen={showCloseWeekPanel}
            onClose={() => setShowCloseWeekPanel(false)}
          />
        </div>
      )}

      <div className="animate-fade-in">
        {isLoading ? (
          <KpiCardsSkeleton />
        ) : (
          <KpiCards data={data} />
        )}
      </div>
      
      <div className="bg-card rounded-2xl p-4 md:p-6 shadow-sm hover-lift animate-scale-in">
        <h2 className="text-lg md:text-xl font-semibold mb-4">
          Performance Comparison
          {selectedWeek !== 'current' && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (as of {selectedWeek === 'ytd' ? 'year-to-date' : selectedWeek.replace('week-', 'week ')})
            </span>
          )}
        </h2>
        {isLoading ? (
          <PerformanceChartSkeleton />
        ) : (
          <PerformanceChart data={data} />
        )}
      </div>
    </div>
  )
}