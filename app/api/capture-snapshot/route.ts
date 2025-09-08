import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { DailySnapshotSchema, type DailySnapshot } from '@/lib/types'
import { getHoldingsData, getMarketPricesData } from '@/lib/data'

export async function POST() {
  try {
    const now = new Date()
    const timestamp = now.toISOString()
    
    // Get current portfolio values
    const [holdings, marketPrices] = await Promise.all([
      getHoldingsData(),
      getMarketPricesData()
    ])
    
    // Validate that we have crypto prices if we have crypto positions
    const hasCrypto = holdings.crypto_positions && holdings.crypto_positions.length > 0
    const hasCryptoPrices = Object.keys(marketPrices.crypto).length > 0
    
    if (hasCrypto && !hasCryptoPrices) {
      return NextResponse.json({ 
        success: false, 
        error: 'Crypto prices are not available. Please refresh prices first.'
      }, { status: 400 })
    }
    
    // Calculate current values
    const stockValue = holdings.positions.reduce((sum, pos) => sum + (pos.shares * pos.market_price), 0)
    const cryptoValue = (holdings.crypto_positions || []).reduce((sum, pos) => sum + (pos.qty * pos.current_price), 0)
    const cashValue = holdings.cash_cad
    const portfolioValue = stockValue + cryptoValue + cashValue
    
    // Create snapshot
    const snapshot: DailySnapshot = {
      timestamp,
      portfolio_value: portfolioValue,
      stock_value: stockValue,
      crypto_value: cryptoValue,
      cash_value: cashValue,
      market_prices: { ...marketPrices.stocks, ...marketPrices.crypto }
    }
    
    // Read existing snapshots
    const snapshotsPath = path.join(process.cwd(), 'data', 'daily-snapshots.json')
    let snapshots: DailySnapshot[] = []
    
    try {
      const existingData = await fs.readFile(snapshotsPath, 'utf8')
      snapshots = JSON.parse(existingData)
    } catch {
      console.log('No existing snapshots file, creating new one')
    }
    
    // Always add new snapshot (no more date-based deduplication)
    snapshots.push(snapshot)
    
    // Sort by timestamp
    snapshots.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    console.log(`Added new snapshot for ${timestamp}`)
    
    // Validate all snapshots
    const validatedSnapshots = snapshots.map(s => DailySnapshotSchema.parse(s))
    
    // Write back to file
    await fs.writeFile(snapshotsPath, JSON.stringify(validatedSnapshots, null, 2))
    
    return NextResponse.json({ 
      success: true, 
      message: `Snapshot captured at ${timestamp}`,
      snapshot
    })
  } catch (error) {
    console.error('Error capturing snapshot:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  return POST() // Allow GET requests too for easier testing
}