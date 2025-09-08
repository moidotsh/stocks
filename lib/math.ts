import { Entry, Holdings, Benchmark, PerformanceMetrics, ChartDataPoint } from './types'

/**
 * Calculate HISA value with daily compounding
 * Formula: value = principal * (1 + daily_rate)^days
 * where daily_rate = (1 + annual_rate)^(1/365) - 1
 */
export function calculateHisaValue(
  flows: Array<{ date: string; amount: number }>,
  apy: number,
  asOfDate: Date = new Date()
): number {
  const dailyRate = Math.pow(1 + apy, 1 / 365) - 1
  
  return flows.reduce((total, flow) => {
    const flowDate = new Date(flow.date)
    const daysDiff = Math.floor((asOfDate.getTime() - flowDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (daysDiff < 0) return total
    
    const compoundedValue = flow.amount * Math.pow(1 + dailyRate, daysDiff)
    return total + compoundedValue
  }, 0)
}

/**
 * Calculate S&P 500 DCA value
 */
export function calculateSP500DCA(
  flows: Array<{ date: string; amount: number }>,
  sp500Levels: Array<{ date: string; level: number }>
): number {
  let totalUnits = 0
  const currentLevel = sp500Levels[sp500Levels.length - 1]?.level || 0
  
  for (const flow of flows) {
    // Find the S&P 500 level for this week (or closest)
    const level = findClosestLevel(flow.date, sp500Levels)
    if (level > 0) {
      totalUnits += flow.amount / level
    }
  }
  
  return totalUnits * currentLevel
}

function findClosestLevel(date: string, levels: Array<{ date: string; level: number }>): number {
  const targetDate = new Date(date)
  let closest = levels[0]
  let minDiff = Math.abs(new Date(closest.date).getTime() - targetDate.getTime())
  
  for (const level of levels) {
    const diff = Math.abs(new Date(level.date).getTime() - targetDate.getTime())
    if (diff < minDiff) {
      minDiff = diff
      closest = level
    }
  }
  
  return closest?.level || 0
}

/**
 * Calculate IRR using Newton-Raphson with bisection fallback
 */
export function calculateIRR(
  cashflows: Array<{ date: string; amount: number }>,
  maxIterations = 50,
  tolerance = 1e-6
): number {
  if (cashflows.length < 2) return 0
  
  // Convert to time periods (years from first cashflow)
  const firstDate = new Date(cashflows[0].date)
  const flows = cashflows.map(cf => ({
    time: (new Date(cf.date).getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
    amount: cf.amount
  }))
  
  // Try Newton-Raphson first
  let rate = 0.1 // Initial guess: 10%
  
  for (let i = 0; i < maxIterations; i++) {
    const npv = flows.reduce((sum, flow) => sum + flow.amount / Math.pow(1 + rate, flow.time), 0)
    const derivative = flows.reduce((sum, flow) => sum - flow.time * flow.amount / Math.pow(1 + rate, flow.time + 1), 0)
    
    if (Math.abs(npv) < tolerance) return rate
    if (Math.abs(derivative) < 1e-12) break // Avoid division by zero
    
    const newRate = rate - npv / derivative
    if (Math.abs(newRate - rate) < tolerance) return newRate
    rate = newRate
  }
  
  // Fallback to bisection method
  let low = -0.99, high = 2.0
  
  for (let i = 0; i < maxIterations; i++) {
    rate = (low + high) / 2
    const npv = flows.reduce((sum, flow) => sum + flow.amount / Math.pow(1 + rate, flow.time), 0)
    
    if (Math.abs(npv) < tolerance) return rate
    
    if (npv > 0) low = rate
    else high = rate
  }
  
  return rate
}

/**
 * Rebuild portfolio holdings from entries to verify data integrity
 */
export function rebuildHoldings(entries: Entry[]): {
  positions: Map<string, { shares: number; totalCost: number }>
  cash: number
} {
  const positions = new Map<string, { shares: number; totalCost: number }>()
  let cash = 0
  
  for (const entry of entries) {
    // Add weekly deposit
    cash += entry.deposit_cad
    
    // Process trades
    for (const trade of entry.trades) {
      const tradeValue = trade.qty * trade.price
      
      if (!positions.has(trade.ticker)) {
        positions.set(trade.ticker, { shares: 0, totalCost: 0 })
      }
      
      const position = positions.get(trade.ticker)!
      
      if (trade.action === 'buy') {
        position.shares += trade.qty
        position.totalCost += tradeValue
        cash -= tradeValue
      } else {
        // Sell: reduce shares proportionally
        const sellRatio = trade.qty / position.shares
        position.totalCost -= position.totalCost * sellRatio
        position.shares -= trade.qty
        cash += tradeValue
        
        // Clean up zero positions
        if (position.shares <= 0.001) {
          positions.delete(trade.ticker)
        }
      }
    }
  }
  
  return { positions, cash }
}

/**
 * Calculate all performance metrics
 */
export function calculateMetrics(
  entries: Entry[],
  holdings: Holdings,
  benchmarks: Benchmark
): PerformanceMetrics {
  // Calculate total contributions
  const totalContributed = entries.reduce((sum, entry) => sum + entry.deposit_cad, 0)
  
  // Current portfolio value
  const currentValue = holdings.positions.reduce((sum, pos) => 
    sum + (pos.shares * pos.market_price), 0) + holdings.cash_cad
  
  const unrealizedPL = currentValue - totalContributed
  
  // Create cashflow series for IRR calculation
  const cashflows = [
    ...entries.map(entry => ({ date: entry.week_start, amount: -entry.deposit_cad })),
    { date: holdings.as_of, amount: currentValue }
  ]
  
  const irr = calculateIRR(cashflows)
  
  // Calculate benchmarks
  const depositFlows = entries.map(entry => ({ date: entry.week_start, amount: entry.deposit_cad }))
  const hisaValue = calculateHisaValue(depositFlows, benchmarks.hisa_rate_apy, new Date(holdings.as_of))
  const sp500Value = calculateSP500DCA(depositFlows, benchmarks.sp500)
  
  // For TWR, we'll use a simplified calculation
  // In a real implementation, this would be more complex with period-by-period returns
  const twr = totalContributed > 0 ? (currentValue / totalContributed) - 1 : 0
  
  return {
    totalContributed,
    currentValue,
    unrealizedPL,
    twr,
    irr,
    deltaVsHisa: currentValue - hisaValue,
    deltaVsSP500: currentValue - sp500Value
  }
}

/**
 * Generate chart data for performance comparison
 */
export function generateChartData(
  entries: Entry[],
  holdings: Holdings,
  benchmarks: Benchmark
): ChartDataPoint[] {
  const data: ChartDataPoint[] = []
  
  let portfolioValue = 0
  
  for (const entry of entries) {
    
    // Simplified portfolio value calculation
    // In reality, this would need historical prices
    portfolioValue += entry.deposit_cad
    
    const depositFlows = entries
      .filter(e => new Date(e.week_start) <= new Date(entry.week_start))
      .map(e => ({ date: e.week_start, amount: e.deposit_cad }))
    
    const hisaValue = calculateHisaValue(depositFlows, benchmarks.hisa_rate_apy, new Date(entry.week_start))
    const sp500Value = calculateSP500DCA(depositFlows, benchmarks.sp500)
    
    data.push({
      date: entry.week_start,
      portfolio: portfolioValue,
      hisa: hisaValue,
      sp500: sp500Value
    })
  }
  
  return data
}