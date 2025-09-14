import { promises as fs } from 'fs'
import path from 'path'
import { Entry, Holdings, Benchmark, PortfolioData, MarketPrices, DailySnapshot } from './types'
import { EntrySchema, HoldingsSchema, BenchmarkSchema, MarketPricesSchema, DailySnapshotSchema } from './types'
import { calculateMetrics, generateChartData } from './math'
import { 
  calculateStockPositions, 
  calculateCryptoPositions, 
  applyMarketPrices, 
  calculateCashRemaining 
} from './holdings-calculator'

const DATA_DIR = path.join(process.cwd(), 'data')

interface StockCandidate {
  ticker: string
  market_price: number
  is_holding: boolean
  // Add other fields from your screener output as needed
}

interface CryptoCandidate {
  symbol: string
  market_price_cad: number
  effective_buy_price_cad: number
  effective_sell_price_cad: number
  fractional_allowed: boolean
  is_holding: boolean
  // Add other fields from your screener output as needed
}

interface CandidatesData {
  stocks: StockCandidate[]
  crypto: CryptoCandidate[]
  generated_at: string
  is_stale: boolean
  age_hours: number
}

export async function getEntriesData(): Promise<Entry[]> {
  const filePath = path.join(DATA_DIR, 'entries.json')
  const fileContent = await fs.readFile(filePath, 'utf8')
  const data = JSON.parse(fileContent)
  
  // Validate with Zod
  const entries = data.map((entry: unknown) => EntrySchema.parse(entry))
  return entries.sort((a: Entry, b: Entry) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime())
}

export async function getCryptoEntriesData(): Promise<Entry[]> {
  try {
    const filePath = path.join(DATA_DIR, 'crypto_entries.json')
    const fileContent = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(fileContent)
    
    // Validate with Zod - assume crypto_entries uses same format as entries
    const entries = data.map((entry: unknown) => EntrySchema.parse(entry))
    return entries.sort((a: Entry, b: Entry) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime())
  } catch {
    // Return empty array if file doesn't exist
    return []
  }
}

export async function getMarketPricesData(): Promise<MarketPrices> {
  const filePath = path.join(DATA_DIR, 'market-prices.json')
  
  try {
    const fileContent = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(fileContent)
    
    // Check if prices are from today
    const pricesDate = new Date(data.as_of)
    const today = new Date()
    const isToday = pricesDate.toDateString() === today.toDateString()
    
    if (!isToday) {
      console.log('Market prices are stale, attempting to update...')
      await updateMarketPricesIfNeeded()
    }
    
    return MarketPricesSchema.parse(data)
  } catch (error) {
    console.warn('Could not read market prices, using fallback data:', error)
    
    // Fallback to basic prices if file doesn't exist or API fails
    const fallbackData = {
      as_of: new Date().toISOString().split('T')[0],
      stocks: {
        "ABX": 39.50,
        "XIU.TO": 33.25,
        "VTI": 252.0,
        "TDB902": 10.18
      },
      crypto: {
        "BTC": 67000.0,
        "ETH": 3400.0,
        "DOGE": 0.32,
        "AVAX": 35.0,
        "DOT": 5.6,
        "ENA": 1.05,
        "WLD": 1.6
      }
    }
    
    return MarketPricesSchema.parse(fallbackData)
  }
}

async function updateMarketPricesIfNeeded() {
  try {
    // Only attempt to update in server-side environment
    if (typeof window === 'undefined') {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL?.startsWith('http') ? process.env.VERCEL_URL : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
      const response = await fetch(`${baseUrl}/api/update-prices`, {
        method: 'POST',
        headers: {
          'x-admin-token': process.env.ADMIN_TOKEN || '',
        },
      })
      
      if (!response.ok) {
        console.warn('Failed to update market prices via API')
      }
    }
  } catch (error) {
    console.warn('Could not update market prices:', error)
  }
}

/**
 * Calculate time-weighted prices that show zero gain for same-day trades only
 */
function adjustForSameDayTrades(
  entries: Entry[],
  cryptoEntries: Entry[],
  positions: any[],
  crypto_positions: any[],
  asOfDate: string
): { adjustedPositions: any[], adjustedCryptoPositions: any[] } {
  const today = asOfDate
  
  // Calculate weighted average prices for each position, respecting trade timing
  const stockWeightedPrices = new Map<string, number>()
  const cryptoWeightedPrices = new Map<string, number>()
  
  // For each position, calculate time-weighted current price
  for (const pos of positions) {
    let totalValue = 0
    let totalQty = 0
    
    // Check all stock trades for this ticker
    const allEntries = [...entries, ...cryptoEntries]
    for (const entry of allEntries) {
      for (const trade of entry.trades || []) {
        if (trade.ticker === pos.ticker && trade.action === 'buy') {
          const isCrypto = ['DOGE', 'AVAX', 'DOT', 'ENA', 'WLD', 'MOODENG'].includes(trade.ticker)
          if (!isCrypto) {
            // Stock trade - use market price unless traded today
            const priceToUse = entry.week_start === today ? trade.price : pos.market_price
            totalValue += trade.qty * priceToUse
            totalQty += trade.qty
          }
        }
      }
    }
    
    if (totalQty > 0) {
      stockWeightedPrices.set(pos.ticker, totalValue / totalQty)
    }
  }
  
  // For crypto positions, calculate time-weighted current price
  for (const pos of crypto_positions) {
    let totalValue = 0
    let totalQty = 0
    
    // Check all crypto trades for this symbol
    const allEntries = [...entries, ...cryptoEntries]
    for (const entry of allEntries) {
      // Check trades in ticker field (from crypto_entries)
      for (const trade of entry.trades || []) {
        if (trade.ticker === pos.symbol && trade.action === 'buy') {
          // Use purchase price for today's trades, market price for older trades
          const priceToUse = entry.week_start === today ? trade.price : pos.current_price
          totalValue += trade.qty * priceToUse
          totalQty += trade.qty
        }
      }
      
      // Check crypto_trades field
      for (const trade of entry.crypto_trades || []) {
        if (trade.symbol === pos.symbol && trade.action === 'buy') {
          const priceToUse = entry.week_start === today ? trade.price : pos.current_price
          totalValue += trade.qty * priceToUse
          totalQty += trade.qty
        }
      }
    }
    
    if (totalQty > 0) {
      cryptoWeightedPrices.set(pos.symbol, totalValue / totalQty)
    }
  }
  
  // Apply the weighted prices
  const adjustedPositions = positions.map(pos => ({
    ...pos,
    market_price: stockWeightedPrices.get(pos.ticker) || pos.market_price
  }))
  
  const adjustedCryptoPositions = crypto_positions.map(pos => ({
    ...pos,
    current_price: cryptoWeightedPrices.get(pos.symbol) || pos.current_price
  }))
  
  return { adjustedPositions, adjustedCryptoPositions }
}

export async function getHoldingsData(): Promise<Holdings> {
  // Calculate holdings from transaction history
  const entries = await getEntriesData()
  const cryptoEntries = await getCryptoEntriesData()
  const marketPrices = await getMarketPricesData()
  
  // Calculate positions from trade history
  const stockPositions = calculateStockPositions(entries)
  const cryptoPositions = calculateCryptoPositions(entries, cryptoEntries)
  
  // Apply current market prices
  const { positions, crypto_positions } = applyMarketPrices(
    stockPositions, 
    cryptoPositions, 
    marketPrices
  )
  
  // Adjust for same-day trades (zero gain until tomorrow)
  const { adjustedPositions, adjustedCryptoPositions } = adjustForSameDayTrades(
    entries,
    cryptoEntries, 
    positions,
    crypto_positions,
    marketPrices.as_of
  )
  
  // Calculate remaining cash
  const cash_cad = calculateCashRemaining(entries, cryptoEntries)
  
  const holdings: Holdings = {
    as_of: marketPrices.as_of,
    positions: adjustedPositions,
    crypto_positions: adjustedCryptoPositions.length > 0 ? adjustedCryptoPositions : undefined,
    cash_cad
  }
  
  return HoldingsSchema.parse(holdings)
}

export async function getBenchmarkData(): Promise<Benchmark> {
  const filePath = path.join(DATA_DIR, 'benchmarks.json')
  const fileContent = await fs.readFile(filePath, 'utf8')
  const data = JSON.parse(fileContent)
  
  return BenchmarkSchema.parse(data)
}

export async function getDailySnapshotsData(): Promise<DailySnapshot[]> {
  try {
    const filePath = path.join(DATA_DIR, 'daily-snapshots.json')
    const fileContent = await fs.readFile(filePath, 'utf8')
    const data = JSON.parse(fileContent)
    
    // Validate with Zod
    const snapshots = data.map((snapshot: unknown) => DailySnapshotSchema.parse(snapshot))
    return snapshots.sort((a: DailySnapshot, b: DailySnapshot) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  } catch (error) {
    console.warn('Could not read daily snapshots:', error)
    return []
  }
}

export async function getFreshCandidates(): Promise<CandidatesData> {
  try {
    // Read latest.json to get the current date folder
    const latestPath = path.join(DATA_DIR, 'candidates', 'latest.json')
    const latestContent = await fs.readFile(latestPath, 'utf8')
    const { latest } = JSON.parse(latestContent)
    
    if (!latest) {
      throw new Error('No latest date found in candidates/latest.json')
    }
    
    // Read the candidate files for that date
    const candidatesDir = path.join(DATA_DIR, 'candidates', latest)
    const stocksPath = path.join(candidatesDir, 'stocks.json')
    const cryptoPath = path.join(candidatesDir, 'crypto.json')
    
    const [stocksContent, cryptoContent] = await Promise.all([
      fs.readFile(stocksPath, 'utf8'),
      fs.readFile(cryptoPath, 'utf8')
    ])
    
    const stocks: StockCandidate[] = JSON.parse(stocksContent)
    const crypto: CryptoCandidate[] = JSON.parse(cryptoContent)
    
    // Check staleness (36 hours = 129600000 ms)
    const generatedAt = new Date(latest + 'T00:00:00Z') // Assume generated at start of day
    const now = new Date()
    const ageMs = now.getTime() - generatedAt.getTime()
    const ageHours = ageMs / (1000 * 60 * 60)
    const isStale = ageHours > 36
    
    return {
      stocks,
      crypto,
      generated_at: latest,
      is_stale: isStale,
      age_hours: Math.round(ageHours * 10) / 10 // Round to 1 decimal
    }
  } catch (error) {
    console.error('Error reading fresh candidates:', error)
    // Return empty data with stale flag
    return {
      stocks: [],
      crypto: [],
      generated_at: 'unknown',
      is_stale: true,
      age_hours: 9999
    }
  }
}

export async function getPortfolioData(): Promise<PortfolioData> {
  const [entries, cryptoEntries, holdings, benchmarks, dailySnapshots] = await Promise.all([
    getEntriesData(),
    getCryptoEntriesData(),
    getHoldingsData(),
    getBenchmarkData(),
    getDailySnapshotsData()
  ])

  // Combine all entries for metrics and chart calculations
  const allEntries = [...entries, ...cryptoEntries].sort((a, b) => 
    new Date(a.week_start).getTime() - new Date(b.week_start).getTime()
  )

  const metrics = calculateMetrics(allEntries, holdings, benchmarks)
  const chartData = generateChartData(entries, cryptoEntries, holdings, benchmarks, dailySnapshots)

  return {
    metrics,
    chartData,
    entries,
    holdings,
    benchmarks
  }
}