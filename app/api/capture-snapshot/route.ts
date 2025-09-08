import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { DailySnapshotSchema, type DailySnapshot } from '@/lib/types'
import { getHoldingsData, getMarketPricesData } from '@/lib/data'

export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Get current portfolio values
    const [holdings, marketPrices] = await Promise.all([
      getHoldingsData(),
      getMarketPricesData()
    ])
    
    // Calculate current values
    const stockValue = holdings.positions.reduce((sum, pos) => sum + (pos.shares * pos.market_price), 0)
    const cryptoValue = (holdings.crypto_positions || []).reduce((sum, pos) => sum + (pos.qty * pos.current_price), 0)
    const cashValue = holdings.cash_cad
    const portfolioValue = stockValue + cryptoValue + cashValue
    
    // Create snapshot
    const snapshot: DailySnapshot = {
      date: today,
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
    
    // Check if snapshot for today already exists
    const existingIndex = snapshots.findIndex(s => s.date === today)
    
    if (existingIndex >= 0) {
      // Update existing snapshot
      snapshots[existingIndex] = snapshot
      console.log(`Updated snapshot for ${today}`)
    } else {
      // Add new snapshot and sort by date
      snapshots.push(snapshot)
      snapshots.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      console.log(`Added new snapshot for ${today}`)
    }
    
    // Validate all snapshots
    const validatedSnapshots = snapshots.map(s => DailySnapshotSchema.parse(s))
    
    // Write back to file
    await fs.writeFile(snapshotsPath, JSON.stringify(validatedSnapshots, null, 2))
    
    return NextResponse.json({ 
      success: true, 
      message: `Snapshot captured for ${today}`,
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