'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { isUserInSweden, convertCADtoSEK, getCADtoSEKRate } from './currency-converter'

interface CurrencyContextType {
  isSwedishUser: boolean
  exchangeRate: number | null
  isLoading: boolean
  formatCurrency: (amount: number) => string
  formatPercentage: (value: number) => string
  convertAmount: (usdAmount: number) => Promise<number>
  isSwedishMode: boolean
  toggleSwedishMode: () => void
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [isSwedishUser, setIsSwedishUser] = useState(false)
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSwedishMode, setIsSwedishMode] = useState(false)

  useEffect(() => {
    const initializeCurrency = async () => {
      setIsLoading(true)
      
      try {
        // Only run on client side
        if (typeof window !== 'undefined') {
          const isSweden = isUserInSweden()
          setIsSwedishUser(isSweden)
          setIsSwedishMode(isSweden)
          
          // Always get exchange rate for potential manual toggle
          const rate = await getCADtoSEKRate()
          setExchangeRate(rate)
        }
      } catch (error) {
        console.error('Failed to initialize currency:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeCurrency()
  }, [])

  // Add Alt key listener for toggling Swedish mode
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && !event.repeat) {
        setIsSwedishMode(prev => !prev)
      }
    }

    const handleKeyUp = () => {
      // Optional: Could add additional logic here if needed
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      
      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
      }
    }
  }, [])

  const formatCurrency = (amount: number): string => {
    // If we're still loading or exchange rate not available, use CAD
    if (isLoading || !exchangeRate) {
      return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
      }).format(amount)
    }
    
    // Use Swedish mode (either auto-detected or manually toggled)
    if (isSwedishMode) {
      const sekAmount = amount * exchangeRate
      return new Intl.NumberFormat('sv-SE', {
        style: 'currency',
        currency: 'SEK',
      }).format(sekAmount)
    }
    
    // Default to CAD
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(amount)
  }

  const convertAmount = async (cadAmount: number): Promise<number> => {
    if (isSwedishMode) {
      return await convertCADtoSEK(cadAmount)
    }
    return cadAmount
  }

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(2)}%`
  }

  const toggleSwedishMode = () => {
    setIsSwedishMode(prev => !prev)
  }

  return (
    <CurrencyContext.Provider value={{
      isSwedishUser,
      exchangeRate,
      isLoading,
      formatCurrency,
      formatPercentage,
      convertAmount,
      isSwedishMode,
      toggleSwedishMode
    }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}
