'use client'

import { Button } from '@/components/ui/button'
import { CalendarCheck } from 'lucide-react'
import { useState, useEffect } from 'react'

interface CloseWeekButtonProps {
  onToggle: () => void
  isActive: boolean
}

export function CloseWeekButton({ onToggle, isActive }: CloseWeekButtonProps) {
  const [isLocalhost, setIsLocalhost] = useState(false)

  useEffect(() => {
    // Check if we're running on localhost
    setIsLocalhost(
      typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' ||
       window.location.hostname === '0.0.0.0')
    )
  }, [])

  // Only show on localhost
  if (!isLocalhost) {
    return null
  }

  return (
    <Button 
      onClick={onToggle}
      variant={isActive ? "default" : "outline"}
      size="sm"
      title="Open Close Week panel"
    >
      <CalendarCheck className="h-4 w-4 mr-2" />
      Close Week
    </Button>
  )
}