import { NextResponse } from 'next/server'
import path from 'path'
import { updateMarketPrices } from '@/lib/price-api'
import { getEntriesData, getCryptoEntriesData } from '@/lib/data'
import { withFileMutex, writeJsonAtomic } from '@/lib/file-utils'

export async function POST(request: Request) {
  try {
    // Simple token auth
    const token = process.env.ADMIN_TOKEN
    if (token) {
      const header = request.headers.get('x-admin-token')
      if (header !== token) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
    }
    // Get all unique tickers and crypto symbols from entries
    const [entries, cryptoEntries] = await Promise.all([
      getEntriesData(),
      getCryptoEntriesData()
    ])
    
    // Get all unique tickers from regular entries (stocks)
    const stockTickers = Array.from(new Set(
      entries.flatMap(entry => entry.trades.map(trade => trade.ticker))
    ))
    
    // Get all unique tickers from crypto entries 
    const cryptoSymbols = Array.from(new Set(
      cryptoEntries.flatMap(entry => entry.trades.map(trade => trade.ticker))
    ))
    
    console.log('Fetching prices for stocks:', stockTickers)
    console.log('Fetching prices for crypto:', cryptoSymbols)
    
    // Fetch live prices
    const { stocks, crypto } = await updateMarketPrices(stockTickers, cryptoSymbols)
    
    // Create updated market prices object
    const marketPrices = {
      as_of: new Date().toISOString().split('T')[0],
      stocks,
      crypto
    }
    
    // Write to file atomically, protected by mutex
    const dataDir = path.join(process.cwd(), 'data')
    const filePath = path.join(dataDir, 'market-prices.json')
    await withFileMutex(filePath, async () => {
      await writeJsonAtomic(filePath, marketPrices)
    })
    
    console.log('Updated market prices:', marketPrices)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Market prices updated successfully',
      data: marketPrices
    })
  } catch (error) {
    console.error('Error updating market prices:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return POST(request) // Allow GET requests too for easier testing
}