import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import {
  calculateTradeImpact,
  type EquityHolding,
  type CryptoHolding,
  type EquityTrade,
  type CryptoTrade
} from '@/lib/portfolio'

// Request schema
const TradePreviewRequestSchema = z.object({
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
  })).optional()
})

type TradePreviewRequest = z.infer<typeof TradePreviewRequestSchema>

// Helper functions for loading holdings (same as record route)
async function loadEquityHoldings(): Promise<EquityHolding[]> {
  try {
    const csvPath = path.join(process.cwd(), 'holdings.csv')
    const csvContent = await fs.readFile(csvPath, 'utf-8')
    
    const lines = csvContent.trim().split('\n')
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
    return []
  }
}

async function loadCryptoHoldings(): Promise<CryptoHolding[]> {
  try {
    const csvPath = path.join(process.cwd(), 'crypto_holdings.csv')
    const csvContent = await fs.readFile(csvPath, 'utf-8')
    
    const lines = csvContent.trim().split('\n')
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
    return []
  }
}

async function loadMarketPrices(): Promise<Record<string, number>> {
  try {
    const pricesPath = path.join(process.cwd(), 'data', 'market-prices.json')
    const content = await fs.readFile(pricesPath, 'utf-8')
    const data = JSON.parse(content)
    
    // Combine stocks and crypto prices
    return {
      ...data.stocks || {},
      ...data.crypto || {}
    }
  } catch (error) {
    return {}
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = TradePreviewRequestSchema.parse(body)

    const { equityTrades = [], cryptoTrades = [] } = data

    // Load current holdings and market prices
    const [currentEquityHoldings, currentCryptoHoldings, marketPrices] = await Promise.all([
      loadEquityHoldings(),
      loadCryptoHoldings(),
      loadMarketPrices()
    ])

    // Calculate impact
    const impact = calculateTradeImpact(
      currentEquityHoldings,
      currentCryptoHoldings,
      equityTrades,
      cryptoTrades,
      marketPrices
    )

    // Calculate current portfolio value for comparison
    let currentEquityValue = 0
    let currentCryptoValue = 0

    currentEquityHoldings.forEach(holding => {
      const price = marketPrices[holding.ticker] || holding.avg_cost
      currentEquityValue += holding.shares * price
    })

    currentCryptoHoldings.forEach(holding => {
      const price = marketPrices[holding.symbol] || holding.avg_cost_cad
      currentCryptoValue += holding.amount * price
    })

    // Calculate new portfolio value
    let newEquityValue = 0
    let newCryptoValue = 0

    impact.newEquityHoldings.forEach(holding => {
      const price = marketPrices[holding.ticker] || holding.avg_cost
      newEquityValue += holding.shares * price
    })

    impact.newCryptoHoldings.forEach(holding => {
      const price = marketPrices[holding.symbol] || holding.avg_cost_cad
      newCryptoValue += holding.amount * price
    })

    return NextResponse.json({
      success: true,
      impact: {
        ...impact,
        currentEquityValue,
        currentCryptoValue,
        newEquityValue,
        newCryptoValue,
        portfolioValueChange: (newEquityValue + newCryptoValue) - (currentEquityValue + currentCryptoValue)
      },
      marketPricesUsed: Object.keys(marketPrices).length > 0
    })

  } catch (error) {
    console.error('Trade preview error:', error)
    
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
      { error: 'Failed to preview trades' },
      { status: 500 }
    )
  }
}