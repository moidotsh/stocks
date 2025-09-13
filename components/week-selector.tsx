'use client'

import { useState, useEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, TrendingUp } from 'lucide-react'

interface WeekSelectorProps {
  selectedWeek: string
  onWeekChange: (week: string) => void
  totalWeeks?: number
}

export function WeekSelector({ selectedWeek, onWeekChange, totalWeeks = 10 }: WeekSelectorProps) {
  const [isLocalhost, setIsLocalhost] = useState(false)

  useEffect(() => {
    setIsLocalhost(
      typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' ||
       window.location.hostname === '0.0.0.0')
    )
  }, [])

  const weekOptions = [
    { value: 'current', label: 'Current', icon: TrendingUp },
    { value: 'ytd', label: 'YTD', icon: Calendar },
    ...Array.from({ length: totalWeeks }, (_, i) => {
      const weekNum = i + 1
      return {
        value: `week-${weekNum}`,
        label: `Week ${weekNum}`,
        icon: Calendar
      }
    })
  ]

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground hidden sm:inline">View as of:</span>
      <Select value={selectedWeek} onValueChange={onWeekChange}>
        <SelectTrigger className="w-[140px] sm:w-[180px]">
          <SelectValue placeholder="Select time period" />
        </SelectTrigger>
        <SelectContent>
          {weekOptions.map((option) => {
            const IconComponent = option.icon
            return (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <IconComponent className="h-4 w-4" />
                  <span className="font-medium">{option.label}</span>
                </div>
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
      
      {/* Show current selection info */}
      {selectedWeek !== 'current' && (
        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          {selectedWeek === 'ytd' ? 'Cumulative view' : 'Point-in-time snapshot'}
        </div>
      )}
    </div>
  )
}