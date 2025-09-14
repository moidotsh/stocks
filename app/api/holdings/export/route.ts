import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

interface EquityEntry {
  week_start: string
  deposit_cad: number
  trades: Array<{
    action: 'buy' | 'sell'
    ticker: string
    qty: number
    price: number
    currency: 'CAD' | 'USD'
  }>
}

interface CryptoEntry {
  week_start: string
  deposit_cad: number
  trades: Array<{
    action: 'buy' | 'sell'
    ticker: string
    qty: number
    price: number
    currency: 'CAD'
  }>
}

interface EquityHolding {
  ticker: string
  shares: number
  avg_cost: number
  currency: 'CAD' | 'USD'
}

interface CryptoHolding {
  symbol: string
  amount: number
  avg_cost_cad: number
}

function calculateEquityHoldings(entries: EquityEntry[]): EquityHolding[] {
  const holdings = new Map<string, { totalShares: number, totalCost: number, currency: 'CAD' | 'USD' }>()

  for (const entry of entries) {
    for (const trade of entry.trades) {
      const key = trade.ticker
      const existing = holdings.get(key) || { totalShares: 0, totalCost: 0, currency: trade.currency }
      
      if (trade.action === 'buy') {
        existing.totalShares += trade.qty
        existing.totalCost += trade.qty * trade.price
      } else if (trade.action === 'sell') {
        existing.totalShares -= trade.qty
        // Don't adjust cost basis on sells for avg_cost calculation
      }
      
      holdings.set(key, existing)
    }
  }

  return Array.from(holdings.entries())
    .filter(([, data]) => data.totalShares > 0)
    .map(([ticker, data]) => ({
      ticker,
      shares: data.totalShares,
      avg_cost: data.totalCost / data.totalShares,
      currency: data.currency
    }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
}

function calculateCryptoHoldings(entries: CryptoEntry[]): CryptoHolding[] {
  const holdings = new Map<string, { totalAmount: number, totalCost: number }>()

  for (const entry of entries) {
    for (const trade of entry.trades) {
      const key = trade.ticker
      const existing = holdings.get(key) || { totalAmount: 0, totalCost: 0 }
      
      if (trade.action === 'buy') {
        existing.totalAmount += trade.qty
        existing.totalCost += trade.qty * trade.price
      } else if (trade.action === 'sell') {
        existing.totalAmount -= trade.qty
        // Don't adjust cost basis on sells for avg_cost calculation
      }
      
      holdings.set(key, existing)
    }
  }

  return Array.from(holdings.entries())
    .filter(([, data]) => data.totalAmount > 0)
    .map(([symbol, data]) => ({
      symbol,
      amount: data.totalAmount,
      avg_cost_cad: data.totalCost / data.totalAmount
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
}

export async function POST(request: NextRequest) {
  try {
    // Load entries
    const equityEntriesPath = path.join(process.cwd(), 'data', 'entries.json')
    const cryptoEntriesPath = path.join(process.cwd(), 'data', 'crypto_entries.json')

    const [equityEntriesData, cryptoEntriesData] = await Promise.all([
      fs.readFile(equityEntriesPath, 'utf-8'),
      fs.readFile(cryptoEntriesPath, 'utf-8')
    ])

    const equityEntries: EquityEntry[] = JSON.parse(equityEntriesData)
    const cryptoEntries: CryptoEntry[] = JSON.parse(cryptoEntriesData)

    // Calculate current holdings
    const equityHoldings = calculateEquityHoldings(equityEntries)
    const cryptoHoldings = calculateCryptoHoldings(cryptoEntries)

    // Generate CSV content
    const equityCSV = [
      'ticker,shares,avg_cost,currency',
      ...equityHoldings.map(h => `${h.ticker},${h.shares.toFixed(6)},${h.avg_cost.toFixed(4)},${h.currency}`)
    ].join('\n')

    const cryptoCSV = [
      'symbol,amount,avg_cost_cad',
      ...cryptoHoldings.map(h => `${h.symbol},${h.amount.toFixed(6)},${h.avg_cost_cad.toFixed(4)}`)
    ].join('\n')

    // Write CSV files
    const holdingsPath = path.join(process.cwd(), 'python', 'outputs', 'holdings.csv')
    const cryptoHoldingsPath = path.join(process.cwd(), 'python', 'outputs', 'crypto_holdings.csv')

    // Create backups first
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const existingHoldings = await fs.readFile(holdingsPath, 'utf-8')
      await fs.writeFile(`${holdingsPath}.bak-${timestamp}`, existingHoldings)
    } catch {
      // No existing file to backup
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const existingCryptoHoldings = await fs.readFile(cryptoHoldingsPath, 'utf-8')
      await fs.writeFile(`${cryptoHoldingsPath}.bak-${timestamp}`, existingCryptoHoldings)
    } catch {
      // No existing file to backup
    }

    // Write new files
    await Promise.all([
      fs.writeFile(holdingsPath, equityCSV),
      fs.writeFile(cryptoHoldingsPath, cryptoCSV)
    ])

    return NextResponse.json({
      success: true,
      message: 'Holdings CSV files generated successfully',
      equity_holdings: equityHoldings.length,
      crypto_holdings: cryptoHoldings.length
    })

  } catch (error) {
    console.error('Error exporting holdings:', error)
    return NextResponse.json(
      { error: 'Failed to export holdings' },
      { status: 500 }
    )
  }
}