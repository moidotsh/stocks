'use client'

import { useState, useEffect } from 'react'
import { KpiCards } from '@/components/kpi-cards'
import { PerformanceChart } from '@/components/performance-chart'
import { PercentageGrowthChart } from '@/components/percentage-growth-chart'
import { PriceRefreshButton } from '@/components/price-refresh-button'
import { SnapshotButton } from '@/components/snapshot-button'
import { PortfolioData } from '@/lib/types'
import { Settings, TrendingUp, DollarSign } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PortfolioDashboardProps {
  initialData: PortfolioData
}

export function PortfolioDashboard({ initialData }: PortfolioDashboardProps) {
  const [showAdminControls, setShowAdminControls] = useState(false)
  const [isLocalhost, setIsLocalhost] = useState(false)

  useEffect(() => {
    setIsLocalhost(
      typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' ||
       window.location.hostname === '0.0.0.0')
    )
  }, [])

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
          
          {/* Admin controls - only on localhost */}
          {isLocalhost && (
            <div className="flex items-center gap-2">
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
                    <PriceRefreshButton />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="animate-fade-in">
        <KpiCards data={initialData} />
      </div>
      
      <div className="bg-card rounded-2xl p-4 md:p-6 shadow-sm hover-lift animate-scale-in">
        <h2 className="text-lg md:text-xl font-semibold mb-4">
          Performance Analysis
        </h2>
        <Tabs defaultValue="percentage" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="value" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Dollar Value
            </TabsTrigger>
            <TabsTrigger value="percentage" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              % Growth
            </TabsTrigger>
          </TabsList>

          <TabsContent value="value" className="space-y-4">
            <PerformanceChart data={initialData} />
          </TabsContent>

          <TabsContent value="percentage" className="space-y-4">
            <PercentageGrowthChart data={initialData} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}