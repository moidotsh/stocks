// Currency conversion utilities for Swedish users

interface ExchangeRateResponse {
  success: boolean
  rates: {
    SEK: number
  }
  base: string
  date: string
}

// Cache for exchange rates to avoid excessive API calls
let exchangeRateCache: {
  rate: number
  timestamp: number
} | null = null

const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

export async function getCADtoSEKRate(): Promise<number> {
  // Check cache first
  if (exchangeRateCache && Date.now() - exchangeRateCache.timestamp < CACHE_DURATION) {
    return exchangeRateCache.rate
  }

  try {
    // Using exchangerate-api.com (free, no API key required) - get CAD to SEK rate
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/CAD')
    
    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`)
    }
    
    const data: ExchangeRateResponse = await response.json()
    
    if (!data.success || !data.rates.SEK) {
      throw new Error('Invalid exchange rate response')
    }
    
    const rate = data.rates.SEK
    
    // Cache the result
    exchangeRateCache = {
      rate,
      timestamp: Date.now()
    }
    
    return rate
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error)
    
    // Fallback to a reasonable estimate if API fails
    // CAD to SEK is typically around 6.77 SEK per CAD (current rate)
    return 6.77
  }
}

export function isUserInSweden(): boolean {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return false
  }
  
  try {
    // Check timezone - Sweden is in Europe/Stockholm
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return timezone === 'Europe/Stockholm'
  } catch {
    // Fallback: check navigator language
    return navigator.language.startsWith('sv') || 
           navigator.languages.some(lang => lang.startsWith('sv'))
  }
}

export async function convertCADtoSEK(cadAmount: number): Promise<number> {
  const rate = await getCADtoSEKRate()
  return cadAmount * rate
}





