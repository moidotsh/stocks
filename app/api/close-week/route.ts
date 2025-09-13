import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { DailySnapshot, Entry } from '@/lib/types'
import { getHoldingsData, getFreshCandidates } from '@/lib/data'

interface WeeklyHoldingSummary {
  ticker: string
  week_open_price: number
  week_close_price: number
  price_change_pct: number
  current_shares: number
  position_value: number
}

interface WeeklyPortfolioSummary {
  week_start: string
  week_end: string
  portfolio_performance: {
    week_open_value: number
    week_close_value: number
    total_change_pct: number
  }
  next_week_deposit: number
  current_week: number
  total_contributed_to_date: number
  cash_available: {
    stock_cash: number
    crypto_cash: number
  }
  holdings: WeeklyHoldingSummary[]
  crypto_holdings: Array<{
    symbol: string
    week_open_price: number
    week_close_price: number
    price_change_pct: number
    current_qty: number
    position_value: number
  }>
  stock_payload: any
  crypto_payload: any
  prompts: {
    stock_prompt: string
    crypto_prompt: string
  }
  candidates_info: {
    generated_at: string
    is_stale: boolean
    age_hours: number
  }
}

export async function POST(request: Request) {
  try {
    // Simple token auth (same as snapshot)
    const token = process.env.ADMIN_TOKEN
    if (token) {
      const header = request.headers.get('x-admin-token')
      if (header !== token) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Parse request body to get force replace flag
    const body = await request.json().catch(() => ({}))
    const forceReplace = body.forceReplace === true

    // Read daily snapshots
    const snapshotsPath = path.join(process.cwd(), 'data', 'daily-snapshots.json')
    let snapshots: DailySnapshot[] = []
    
    try {
      const data = await fs.readFile(snapshotsPath, 'utf8')
      snapshots = JSON.parse(data)
    } catch {
      return NextResponse.json({ 
        success: false, 
        error: 'No snapshots available. Please capture some snapshots first.'
      }, { status: 400 })
    }

    if (snapshots.length < 2) {
      return NextResponse.json({ 
        success: false, 
        error: 'Need at least 2 snapshots to generate weekly summary.'
      }, { status: 400 })
    }

    // Get current holdings and fresh candidates
    const [holdings, candidates] = await Promise.all([
      getHoldingsData(),
      getFreshCandidates()
    ])

    // Sort snapshots by timestamp
    snapshots.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Get the last 7 days of snapshots, or all if less than 7
    const now = new Date()
    const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))
    
    const weekSnapshots = snapshots.filter(s => new Date(s.timestamp) >= weekAgo)
    
    if (weekSnapshots.length === 0) {
      // If no snapshots in last 7 days, use the most recent ones available
      const recentSnapshots = snapshots.slice(-7) // Get last 7 snapshots
      weekSnapshots.push(...recentSnapshots)
    }

    const weekStart = weekSnapshots[0]
    const weekEnd = weekSnapshots[weekSnapshots.length - 1]

    // Calculate portfolio performance
    const portfolioPerformance = {
      week_open_value: weekStart.portfolio_value,
      week_close_value: weekEnd.portfolio_value,
      total_change_pct: ((weekEnd.portfolio_value - weekStart.portfolio_value) / weekStart.portfolio_value) * 100
    }

    // Process stock holdings
    const stockHoldings: WeeklyHoldingSummary[] = holdings.positions.map(pos => {
      const weekOpenPrice = weekStart.market_prices[pos.ticker] || pos.market_price
      const weekClosePrice = weekEnd.market_prices[pos.ticker] || pos.market_price
      const priceChangePct = weekOpenPrice > 0 ? ((weekClosePrice - weekOpenPrice) / weekOpenPrice) * 100 : 0

      return {
        ticker: pos.ticker,
        week_open_price: weekOpenPrice,
        week_close_price: weekClosePrice,
        price_change_pct: priceChangePct,
        current_shares: pos.shares,
        position_value: pos.shares * weekClosePrice
      }
    })

    // Process crypto holdings
    const cryptoHoldings = (holdings.crypto_positions || []).map(pos => {
      const weekOpenPrice = weekStart.market_prices[pos.symbol] || pos.current_price
      const weekClosePrice = weekEnd.market_prices[pos.symbol] || pos.current_price
      const priceChangePct = weekOpenPrice > 0 ? ((weekClosePrice - weekOpenPrice) / weekOpenPrice) * 100 : 0

      return {
        symbol: pos.symbol,
        week_open_price: weekOpenPrice,
        week_close_price: weekClosePrice,
        price_change_pct: priceChangePct,
        current_qty: pos.qty,
        position_value: pos.qty * weekClosePrice
      }
    })

    // Calculate current week based on actual entries data
    let currentWeek = 1
    let totalContributed = 0
    
    try {
      const entriesPath = path.join(process.cwd(), 'data', 'entries.json')
      const entriesData = await fs.readFile(entriesPath, 'utf8')
      const entries: Entry[] = JSON.parse(entriesData)
      
      // Count entries to determine current week
      currentWeek = entries.length + 1 // Next week after last entry
      
      // Calculate total contributed from actual entries
      totalContributed = entries.reduce((sum, entry) => sum + entry.deposit_cad, 0)
    } catch (error) {
      console.warn('Could not read entries.json, using fallback calculation')
      // Fallback to date-based calculation with reasonable start date
      const startDate = new Date('2024-09-01')
      const currentDate = new Date()
      const weeksDiff = Math.floor((currentDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
      currentWeek = Math.max(1, weeksDiff + 1)
      totalContributed = (currentWeek / 2) * (2 * 10 + (currentWeek - 1) * 1)
    }
    
    const nextWeekDeposit = 10 + (currentWeek - 1) // Linear ramp: week t deposit = 10 + (t-1)

    // Generate structured payloads
    // You allocate the full nextWeekDeposit to EACH portfolio, not split between them
    const stockCash = holdings.cash_cad * 0.5 + nextWeekDeposit // Current cash + full planned allocation
    const cryptoCash = holdings.cash_cad * 0.5 + nextWeekDeposit // Current cash + full planned allocation

    const stockPayload = generateStockPayload(stockHoldings, stockCash, weekEnd, candidates.stocks)
    const cryptoPayload = generateCryptoPayload(cryptoHoldings, cryptoCash, weekEnd, candidates.crypto)

    // Create the summary
    const summary: WeeklyPortfolioSummary = {
      week_start: new Date(weekStart.timestamp).toISOString().split('T')[0],
      week_end: new Date(weekEnd.timestamp).toISOString().split('T')[0],
      portfolio_performance: portfolioPerformance,
      next_week_deposit: nextWeekDeposit,
      current_week: currentWeek,
      total_contributed_to_date: totalContributed,
      cash_available: {
        stock_cash: stockCash,
        crypto_cash: cryptoCash
      },
      holdings: stockHoldings,
      crypto_holdings: cryptoHoldings,
      stock_payload: stockPayload,
      crypto_payload: cryptoPayload,
      prompts: {
        stock_prompt: getStockPrompt(),
        crypto_prompt: getCryptoPrompt()
      },
      candidates_info: {
        generated_at: candidates.generated_at,
        is_stale: candidates.is_stale,
        age_hours: candidates.age_hours
      }
    }

    // Save summary to a file for reference
    const summariesPath = path.join(process.cwd(), 'data', 'weekly-summaries.json')
    let summaries: WeeklyPortfolioSummary[] = []
    
    try {
      const existingData = await fs.readFile(summariesPath, 'utf8')
      summaries = JSON.parse(existingData)
    } catch {
      // File doesn't exist, start fresh
    }

    summaries.push(summary)
    
    // Keep only last 20 summaries
    if (summaries.length > 20) {
      summaries = summaries.slice(-20)
    }

    await fs.writeFile(summariesPath, JSON.stringify(summaries, null, 2))

    // Save a permanent week completion snapshot
    const weekCompletionSnapshot = {
      week_number: currentWeek,
      week_start: summary.week_start,
      week_end: summary.week_end,
      completed_at: new Date().toISOString(),
      portfolio_state: {
        total_value: portfolioPerformance.week_close_value,
        stock_value: weekEnd.stock_value,
        crypto_value: weekEnd.crypto_value,
        cash_value: weekEnd.cash_value,
        holdings: stockHoldings,
        crypto_holdings: cryptoHoldings,
        total_contributed: summary.total_contributed_to_date
      },
      performance: {
        week_change_pct: portfolioPerformance.total_change_pct,
        week_change_amount: portfolioPerformance.week_close_value - portfolioPerformance.week_open_value
      }
    }

    // Save week completion snapshots
    const weekSnapshotsPath = path.join(process.cwd(), 'data', 'week-completion-snapshots.json')
    let completionSnapshots: any[] = []
    
    try {
      const existingSnapshots = await fs.readFile(weekSnapshotsPath, 'utf8')
      completionSnapshots = JSON.parse(existingSnapshots)
    } catch {
      // File doesn't exist, start fresh
    }

    // Handle force replace or add new snapshot
    const existingWeekSnapshotIndex = completionSnapshots.findIndex(s => s.week_number === currentWeek)
    
    if (existingWeekSnapshotIndex >= 0) {
      if (forceReplace) {
        // Replace existing snapshot
        completionSnapshots[existingWeekSnapshotIndex] = weekCompletionSnapshot
        await fs.writeFile(weekSnapshotsPath, JSON.stringify(completionSnapshots, null, 2))
        console.log(`Force replaced week ${currentWeek} completion snapshot`)
      } else {
        console.log(`Week ${currentWeek} snapshot already exists, skipping (use force replace to override)`)
      }
    } else {
      // Add new snapshot
      completionSnapshots.push(weekCompletionSnapshot)
      await fs.writeFile(weekSnapshotsPath, JSON.stringify(completionSnapshots, null, 2))
      console.log(`Created new week ${currentWeek} completion snapshot`)
    }

    return NextResponse.json({ 
      success: true,
      summary,
      message: `Weekly summary generated for ${summary.week_start} to ${summary.week_end}`
    })

  } catch (error) {
    console.error('Error generating weekly summary:', error)
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function generateStockPayload(stockHoldings: WeeklyHoldingSummary[], cashAvailable: number, weekEnd: any, freshCandidates: any[]) {
  // Use fresh candidates from screener output
  const candidates = [
    // Add current holdings (marked as holdings)
    ...stockHoldings.map(h => ({
      ticker: h.ticker,
      market_price: h.week_close_price,
      is_holding: true
    })),
    // Add fresh screener candidates
    ...freshCandidates.filter(c => !stockHoldings.some(h => h.ticker === c.ticker))
  ]

  return {
    as_of: new Date(weekEnd.timestamp).toISOString().split('T')[0],
    cash_available_cad: cashAvailable,
    constraints: {
      max_positions: 15,
      max_weight_per_position: 0.15, // 15%
      min_trade_size_cad: 1.0,
      max_trades: 3
    },
    candidates: candidates,
    current_holdings: stockHoldings.map(h => ({
      ticker: h.ticker,
      qty: h.current_shares,
      avg_cost: h.week_close_price, // Use current price as placeholder for avg_cost
      market_price: h.week_close_price,
      unrealized_pnl_cad: (h.week_close_price - h.week_open_price) * h.current_shares
    }))
  }
}

function generateCryptoPayload(cryptoHoldings: any[], cashAvailable: number, weekEnd: any, freshCandidates: any[]) {
  // Use fresh candidates from screener output
  const candidates = [
    // Add current holdings (marked as holdings)
    ...cryptoHoldings.map(c => ({
      symbol: c.symbol,
      market_price_cad: c.week_close_price,
      effective_buy_price_cad: c.effective_buy_price_cad || c.week_close_price * 1.02,
      effective_sell_price_cad: c.effective_sell_price_cad || c.week_close_price * 0.98,
      fractional_allowed: true,
      is_holding: true
    })),
    // Add fresh screener candidates (already have effective prices from screener)
    ...freshCandidates.filter(c => !cryptoHoldings.some(h => h.symbol === c.symbol))
  ]

  return {
    as_of: new Date(weekEnd.timestamp).toISOString().split('T')[0],
    cash_available_cad: cashAvailable,
    constraints: {
      min_trade_size_cad: 1.0,
      max_trades: 2
    },
    candidates: candidates,
    current_holdings: cryptoHoldings.map(c => ({
      symbol: c.symbol,
      qty: c.current_qty,
      avg_cost: c.week_close_price, // Use current price as placeholder
      market_price: c.week_close_price,
      unrealized_pnl_cad: (c.week_close_price - c.week_open_price) * c.current_qty
    }))
  }
}

function getStockPrompt(): string {
  return `You are a portfolio rebalancer for a Canadian TFSA. Return ONLY valid JSON:
{
  "trades": [{ "action":"buy|sell", "ticker":"", "qty":0, "limit_price": null }],
  "rationale": "",
  "risk_notes": ""
}
Rules:
- Long-only stocks/ETFs. Respect cash_available_cad, max_positions, max_weight_per_position, min_trade_size_cad, max_trades.
- Prefer CAD listings when materially similar to USD.
- Holding cash and sell-only weeks are allowed. Do not auto-redeploy sale proceeds.
- Use limit_price only if you want a GTC limit; otherwise null (market). If it doesn't fill, nothing is recorded.
- Only use tickers present in "candidates" (holdings already appended).
- If no changes: {"trades":[],"rationale":"No change","risk_notes":""}. No text outside JSON.`
}

function getCryptoPrompt(): string {
  return `You are a crypto allocator. Return ONLY valid JSON:
{
  "trades": [{ "action":"buy|sell", "symbol":"", "qty":0, "limit_price": null }],
  "rationale": "",
  "risk_notes": ""
}
Rules:
- Long-only spot. Enforce fractional_allowed, min_trade_size_cad, max_trades.
- Fees baked in: buys use effective_buy_price_cad; sells use effective_sell_price_cad.
- Σ(buy_qty*effective_buy) − Σ(sell_qty*effective_sell) ≤ cash_available_cad.
- Holding cash and sell-only weeks are allowed. Market only (limit_price = null).
- Use only symbols in "candidates" (holdings appended). If no changes: return empty trades. No text outside JSON.`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  
  if (type === 'stocks' || type === 'crypto') {
    // Return a simplified response for individual type requests
    try {
      const [holdings, candidates] = await Promise.all([
        getHoldingsData(),
        getFreshCandidates()
      ])

      let warning = null
      if (candidates.is_stale) {
        if (candidates.generated_at === 'unknown') {
          warning = 'No fresh candidates found. Run the screeners first.'
        } else {
          warning = `Candidates are ${candidates.age_hours}h old. Run fresh screeners (stale after 36h).`
        }
      }

      // Calculate current week and deposit
      let currentWeek = 1
      let totalContributed = 0
      
      try {
        const entriesPath = path.join(process.cwd(), 'data', 'entries.json')
        const entriesData = await fs.readFile(entriesPath, 'utf8')
        const entries: Entry[] = JSON.parse(entriesData)
        currentWeek = entries.length + 1
        totalContributed = entries.reduce((sum, entry) => sum + entry.deposit_cad, 0)
      } catch {
        // Use fallback
        const startDate = new Date('2024-09-01')
        const currentDate = new Date()
        const weeksDiff = Math.floor((currentDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
        currentWeek = Math.max(1, weeksDiff + 1)
        totalContributed = (currentWeek / 2) * (2 * 10 + (currentWeek - 1) * 1)
      }
      
      const nextWeekDeposit = 10 + (currentWeek - 1)
      const cashAmount = holdings.cash_cad * 0.5 + nextWeekDeposit

      let payload
      if (type === 'stocks') {
        const stockHoldings = holdings.positions.map(pos => ({
          ticker: pos.ticker,
          week_open_price: pos.market_price,
          week_close_price: pos.market_price,
          price_change_pct: 0,
          current_shares: pos.shares,
          position_value: pos.shares * pos.market_price
        }))
        payload = generateStockPayload(stockHoldings, cashAmount, { timestamp: new Date().toISOString() }, candidates.stocks)
      } else {
        const cryptoHoldings = (holdings.crypto_positions || []).map(pos => ({
          symbol: pos.symbol,
          week_open_price: pos.current_price,
          week_close_price: pos.current_price,
          price_change_pct: 0,
          current_qty: pos.qty,
          position_value: pos.qty * pos.current_price
        }))
        payload = generateCryptoPayload(cryptoHoldings, cashAmount, { timestamp: new Date().toISOString() }, candidates.crypto)
      }

      return NextResponse.json({
        summary: {
          current_week: currentWeek,
          next_week_deposit: nextWeekDeposit,
          total_contributed_to_date: totalContributed,
          cash_available: {
            stock_cash: type === 'stocks' ? cashAmount : holdings.cash_cad * 0.5 + nextWeekDeposit,
            crypto_cash: type === 'crypto' ? cashAmount : holdings.cash_cad * 0.5 + nextWeekDeposit
          },
          [type === 'stocks' ? 'stock_payload' : 'crypto_payload']: payload,
          prompts: {
            stock_prompt: getStockPrompt(),
            crypto_prompt: getCryptoPrompt()
          },
          candidates_info: {
            generated_at: candidates.generated_at,
            is_stale: candidates.is_stale,
            age_hours: candidates.age_hours
          }
        },
        warning
      })
    } catch (error) {
      console.error('Error generating summary:', error)
      return NextResponse.json({ 
        summary: null,
        warning: 'Error loading data. Please try again.'
      }, { status: 500 })
    }
  }
  
  return POST(request) // Allow GET requests for full summary
}