import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { updateMarketPrices } from '@/lib/price-api'
import { getEntriesData, getCryptoEntriesData } from '@/lib/data'

export async function POST() {
  try {
    // Get all unique tickers and crypto symbols from entries
    const [entries, cryptoEntries] = await Promise.all([
      getEntriesData(),
      getCryptoEntriesData()
    ])
    
    // Get all unique tickers from regular entries (stocks)
    const stockTickers = [...new Set(
      entries.flatMap(entry => entry.trades.map(trade => trade.ticker))
    )]
    
    // Get all unique tickers from crypto entries 
    const cryptoSymbols = [...new Set(
      cryptoEntries.flatMap(entry => entry.trades.map(trade => trade.ticker))
    )]
    
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
    
    // Write to file
    const dataDir = path.join(process.cwd(), 'data')
    const filePath = path.join(dataDir, 'market-prices.json')
    await fs.writeFile(filePath, JSON.stringify(marketPrices, null, 2))
    
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

export async function GET() {
  return POST() // Allow GET requests too for easier testing
}