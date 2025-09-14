import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import {
  applyEquityTrades,
  applyCryptoTrades,
  tradesToEntryFormat,
  type EquityHolding,
  type CryptoHolding,
  type EquityTrade,
  type CryptoTrade,
  type TradeEntry
} from '@/lib/portfolio'

// Request schema
const TradeRecordRequestSchema = z.object({
  asset: z.enum(['equity', 'crypto']),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  depositCad: z.number().min(0),
  equityTrades: z.array(z.object({
    action: z.enum(['buy', 'sell']),
    ticker: z.string(),
    qty: z.number().positive(),
    unit_price: z.number().positive(),
    currency: z.enum(['CAD', 'USD'])
  })).optional(),
  cryptoTrades: z.array(z.object({
    action: z.enum(['buy', 'sell']),
    symbol: z.string(),
    qty: z.number().positive(),
    unit_price: z.number().positive()
  })).optional(),
  notes: z.string().optional()
})

type TradeRecordRequest = z.infer<typeof TradeRecordRequestSchema>

// Helper functions for file operations
async function loadEquityHoldings(): Promise<EquityHolding[]> {
  try {
    const csvPath = path.join(process.cwd(), 'holdings.csv')
    const csvContent = await fs.readFile(csvPath, 'utf-8')
    
    const lines = csvContent.trim().split('\n')
    const headers = lines[0].split(',')
    const holdings: EquityHolding[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',')
      holdings.push({
        ticker: values[0].trim(),
        shares: parseFloat(values[1]),
        avg_cost: parseFloat(values[2]),
        currency: values[3].trim() as 'CAD' | 'USD'
      })
    }

    return holdings
  } catch (error) {
    // File doesn't exist or is empty, return empty array
    return []
  }
}

async function loadCryptoHoldings(): Promise<CryptoHolding[]> {
  try {
    const csvPath = path.join(process.cwd(), 'crypto_holdings.csv')
    const csvContent = await fs.readFile(csvPath, 'utf-8')
    
    const lines = csvContent.trim().split('\n')
    const headers = lines[0].split(',')
    const holdings: CryptoHolding[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',')
      holdings.push({
        symbol: values[0].trim(),
        amount: parseFloat(values[1]),
        avg_cost_cad: parseFloat(values[2])
      })
    }

    return holdings
  } catch (error) {
    // File doesn't exist or is empty, return empty array
    return []
  }
}

async function saveEquityHoldings(holdings: EquityHolding[]): Promise<void> {
  const csvPath = path.join(process.cwd(), 'holdings.csv')
  
  // Create backup
  try {
    const existing = await fs.readFile(csvPath, 'utf-8')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `${csvPath}.bak-${timestamp}`
    await fs.writeFile(backupPath, existing)
  } catch (error) {
    // No existing file to backup
  }

  // Write new holdings
  const csvContent = [
    'ticker,shares,avg_cost,currency',
    ...holdings
      .sort((a, b) => a.ticker.localeCompare(b.ticker))
      .map(h => `${h.ticker},${h.shares},${h.avg_cost},${h.currency}`)
  ].join('\n')

  await fs.writeFile(csvPath, csvContent)
}

async function saveCryptoHoldings(holdings: CryptoHolding[]): Promise<void> {
  const csvPath = path.join(process.cwd(), 'crypto_holdings.csv')
  
  // Create backup
  try {
    const existing = await fs.readFile(csvPath, 'utf-8')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = `${csvPath}.bak-${timestamp}`
    await fs.writeFile(backupPath, existing)
  } catch (error) {
    // No existing file to backup
  }

  // Write new holdings
  const csvContent = [
    'symbol,amount,avg_cost_cad',
    ...holdings
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .map(h => `${h.symbol},${h.amount},${h.avg_cost_cad}`)
  ].join('\n')

  await fs.writeFile(csvPath, csvContent)
}

async function appendEntry(entry: TradeEntry, asset: 'equity' | 'crypto'): Promise<void> {
  const entriesPath = asset === 'equity' 
    ? path.join(process.cwd(), 'data', 'entries.json')
    : path.join(process.cwd(), 'data', 'crypto_entries.json')

  // Ensure directory exists
  await fs.mkdir(path.dirname(entriesPath), { recursive: true })

  // Load existing entries
  let entries: TradeEntry[] = []
  try {
    const content = await fs.readFile(entriesPath, 'utf-8')
    entries = JSON.parse(content)
  } catch (error) {
    // File doesn't exist, start with empty array
  }

  // Append new entry
  entries.push(entry)

  // Save updated entries
  await fs.writeFile(entriesPath, JSON.stringify(entries, null, 2))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = TradeRecordRequestSchema.parse(body)

    const { asset, weekStart, depositCad, equityTrades = [], cryptoTrades = [], notes } = data

    // Additional server-side validation: require meaningful changes
    const validEquityTrades = equityTrades.filter(t => t.ticker?.trim() && t.qty > 0 && t.unit_price > 0)
    const validCryptoTrades = cryptoTrades.filter(t => t.symbol?.trim() && t.qty > 0 && t.unit_price > 0)
    const hasChanges = depositCad > 0 || validEquityTrades.length > 0 || validCryptoTrades.length > 0

    if (!hasChanges) {
      return NextResponse.json(
        { error: 'No meaningful changes detected. Please add a deposit or valid trades.' },
        { status: 400 }
      )
    }

    // Load current holdings
    const currentEquityHoldings = await loadEquityHoldings()
    const currentCryptoHoldings = await loadCryptoHoldings()

    let updatedEquityHoldings = currentEquityHoldings
    let updatedCryptoHoldings = currentCryptoHoldings

    // Apply trades
    if (validEquityTrades.length > 0) {
      updatedEquityHoldings = applyEquityTrades(currentEquityHoldings, validEquityTrades)
    }

    if (validCryptoTrades.length > 0) {
      updatedCryptoHoldings = applyCryptoTrades(currentCryptoHoldings, validCryptoTrades)
    }

    // Save updated holdings
    if (asset === 'equity' || validEquityTrades.length > 0) {
      await saveEquityHoldings(updatedEquityHoldings)
    }

    if (asset === 'crypto' || validCryptoTrades.length > 0) {
      await saveCryptoHoldings(updatedCryptoHoldings)
    }

    // Create entry for site
    const entryTrades = tradesToEntryFormat(validEquityTrades, validCryptoTrades)
    const entry: TradeEntry = {
      week_start: weekStart,
      deposit_cad: Math.round(depositCad * 100) / 100, // Round to 2 decimal places
      trades: entryTrades
    }

    if (notes) {
      entry.notes = notes
    }

    // Append to entries file
    await appendEntry(entry, asset)

    return NextResponse.json({
      success: true,
      updatedEquityHoldings,
      updatedCryptoHoldings,
      entry
    })

  } catch (error) {
    console.error('Trade recording error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to record trades' },
      { status: 500 }
    )
  }
}