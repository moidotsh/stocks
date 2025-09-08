'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

export function PriceRefreshButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/update-prices', {
        method: 'POST',
      })
      
      if (response.ok) {
        // Refresh the page to show updated prices
        window.location.reload()
      } else {
        console.error('Failed to update prices')
      }
    } catch (error) {
      console.error('Error updating prices:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button 
      onClick={handleRefresh} 
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Updating...' : 'Refresh Prices'}
    </Button>
  )
}