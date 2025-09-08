import { z } from 'zod'

// Trade schema
export const TradeSchema = z.object({
  action: z.enum(['buy', 'sell']),
  ticker: z.string(),
  qty: z.number().positive(),
  price: z.number().positive(),
  currency: z.enum(['CAD', 'USD']),
})

export type Trade = z.infer<typeof TradeSchema>

// Weekly entry schema
export const EntrySchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deposit_cad: z.number().min(0),
  trades: z.array(TradeSchema),
  notes: z.string().optional(),
})

export type Entry = z.infer<typeof EntrySchema>

// Portfolio position schema
export const PositionSchema = z.object({
  ticker: z.string(),
  shares: z.number(),
  avg_cost: z.number().positive(),
  currency: z.enum(['CAD', 'USD']),
  market_price: z.number().positive(),
})

export type Position = z.infer<typeof PositionSchema>

// Holdings snapshot schema
export const HoldingsSchema = z.object({
  as_of: z.string(),
  positions: z.array(PositionSchema),
  cash_cad: z.number().min(0),
})

export type Holdings = z.infer<typeof HoldingsSchema>

// Benchmark data schema
export const BenchmarkPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  level: z.number().positive(),
})

export const BenchmarkSchema = z.object({
  sp500: z.array(BenchmarkPointSchema),
  hisa_rate_apy: z.number().min(0).max(1),
})

export type Benchmark = z.infer<typeof BenchmarkSchema>
export type BenchmarkPoint = z.infer<typeof BenchmarkPointSchema>

// Computed data types
export interface PerformanceMetrics {
  totalContributed: number
  currentValue: number
  unrealizedPL: number
  twr: number
  irr: number
  deltaVsHisa: number
  deltaVsSP500: number
}

export interface ChartDataPoint {
  date: string
  portfolio: number
  hisa: number
  sp500: number
}

export interface PortfolioData {
  metrics: PerformanceMetrics
  chartData: ChartDataPoint[]
  entries: Entry[]
  holdings: Holdings
  benchmarks: Benchmark
}