'use client'

import { Button } from '@/components/ui/button'
import { Camera } from 'lucide-react'
import { useState, useEffect } from 'react'

export function SnapshotButton() {
  const [isLoading, setIsLoading] = useState(false)
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

  const handleSnapshot = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/capture-snapshot', {
        method: 'POST',
      })
      
      if (response.ok) {
        // Refresh the page to show updated snapshot data
        window.location.reload()
      } else {
        console.error('Failed to capture snapshot')
      }
    } catch (error) {
      console.error('Error capturing snapshot:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Only show on localhost
  if (!isLocalhost) {
    return null
  }

  return (
    <Button 
      onClick={handleSnapshot} 
      disabled={isLoading}
      variant="outline"
      size="sm"
      title="Capture daily snapshot for public portfolio"
    >
      <Camera className={`h-4 w-4 mr-2 ${isLoading ? 'animate-pulse' : ''}`} />
      {isLoading ? 'Capturing...' : 'Capture Snapshot'}
    </Button>
  )
}