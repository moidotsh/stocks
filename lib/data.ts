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
  
  // Calculate remaining cash
  const cash_cad = calculateCashRemaining(entries, cryptoEntries)
  
  const holdings: Holdings = {
    as_of: marketPrices.as_of,
    positions,
    crypto_positions: crypto_positions.length > 0 ? crypto_positions : undefined,
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
  const chartData = generateChartData(allEntries, holdings, benchmarks, dailySnapshots)

  return {
    metrics,
    chartData,
    entries,
    holdings,
    benchmarks
  }
}