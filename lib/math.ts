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
 * Calculate S&P 500 DCA value at a specific date
 */
export function calculateSP500DCA(
  flows: Array<{ date: string; amount: number }>,
  sp500Levels: Array<{ date: string; level: number }>,
  asOfDate?: Date
): number {
  let totalUnits = 0
  
  // Use provided date or latest available date
  const targetDate = asOfDate || new Date(sp500Levels[sp500Levels.length - 1].date)
  const currentLevel = findClosestLevel(targetDate.toISOString().split('T')[0], sp500Levels)
  
  for (const flow of flows) {
    // Only process flows up to the target date
    if (new Date(flow.date) <= targetDate) {
      // Find the S&P 500 level for this week (or closest)
      const level = findClosestLevel(flow.date, sp500Levels)
      if (level > 0) {
        totalUnits += flow.amount / level
      }
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
  
  // Calculate individual portfolio components
  const stockValue = holdings.positions.reduce((sum, pos) => 
    sum + (pos.shares * pos.market_price), 0)
  
  const cryptoValue = (holdings.crypto_positions || []).reduce((sum, pos) => 
    sum + (pos.qty * pos.current_price), 0)
  
  const cashValue = holdings.cash_cad
  
  // Current portfolio value (total of all components)
  const currentValue = stockValue + cryptoValue + cashValue
  
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
  const sp500Value = calculateSP500DCA(depositFlows, benchmarks.sp500, new Date(holdings.as_of))
  
  // For TWR, we'll use a simplified calculation
  // In a real implementation, this would be more complex with period-by-period returns
  const twr = totalContributed > 0 ? (currentValue / totalContributed) - 1 : 0
  
  return {
    totalContributed,
    currentValue,
    stockValue,
    cryptoValue,
    cashValue,
    unrealizedPL,
    twr,
    irr,
    deltaVsHisa: currentValue - hisaValue,
    deltaVsSP500: currentValue - sp500Value,
    hisaValue,
    sp500Value
  }
}

/**
 * Generate chart data for performance comparison
 */
export function generateChartData(
  entries: Entry[],
  holdings: Holdings,
  benchmarks: Benchmark,
  dailySnapshots?: Array<{ timestamp: string; portfolio_value: number; stock_value: number; crypto_value: number }>
): ChartDataPoint[] {
  const data: ChartDataPoint[] = []
  
  // Separate stock and crypto entries
  const stockEntries = entries.filter(e => 
    e.trades.some(t => !['BTC', 'ETH', 'DOGE', 'AVAX', 'DOT', 'ENA', 'WLD'].includes(t.ticker))
  )
  const cryptoEntries = entries.filter(e => 
    e.trades.some(t => ['BTC', 'ETH', 'DOGE', 'AVAX', 'DOT', 'ENA', 'WLD'].includes(t.ticker))
  )
  
  // Get all entries sorted by date
  const allEntries = entries.sort((a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime())
  
  // Get unique dates to avoid duplicates when both stock and crypto entries have same date
  const uniqueDates = Array.from(new Set(allEntries.map(e => e.week_start))).sort()
  
  for (const dateStr of uniqueDates) {
    // Calculate separate deposits for stock and crypto up to this date
    const stockDeposits = stockEntries
      .filter(e => new Date(e.week_start) <= new Date(dateStr))
      .reduce((sum, e) => sum + e.deposit_cad, 0)
    
    const cryptoDeposits = cryptoEntries
      .filter(e => new Date(e.week_start) <= new Date(dateStr))
      .reduce((sum, e) => sum + e.deposit_cad, 0)
    
    const totalDeposits = stockDeposits + cryptoDeposits
    
    // Create separate deposit flows for benchmarking
    const stockDepositFlows = stockEntries
      .filter(e => new Date(e.week_start) <= new Date(dateStr))
      .map(e => ({ date: e.week_start, amount: e.deposit_cad }))
    
    const cryptoDepositFlows = cryptoEntries
      .filter(e => new Date(e.week_start) <= new Date(dateStr))
      .map(e => ({ date: e.week_start, amount: e.deposit_cad }))
    
    const allDepositFlows = allEntries
      .filter(e => new Date(e.week_start) <= new Date(dateStr))
      .map(e => ({ date: e.week_start, amount: e.deposit_cad }))
    
    // Calculate benchmark values
    const hisaValue = calculateHisaValue(allDepositFlows, benchmarks.hisa_rate_apy, new Date(dateStr))
    const sp500Value = calculateSP500DCA(allDepositFlows, benchmarks.sp500, new Date(dateStr))
    
    const stockHisaValue = calculateHisaValue(stockDepositFlows, benchmarks.hisa_rate_apy, new Date(dateStr))
    const stockSP500Value = calculateSP500DCA(stockDepositFlows, benchmarks.sp500, new Date(dateStr))
    
    const cryptoHisaValue = calculateHisaValue(cryptoDepositFlows, benchmarks.hisa_rate_apy, new Date(dateStr))
    const cryptoSP500Value = calculateSP500DCA(cryptoDepositFlows, benchmarks.sp500, new Date(dateStr))
    
    data.push({
      date: dateStr,
      portfolio: totalDeposits,
      hisa: hisaValue,
      sp500: sp500Value,
      stockPortfolio: stockDeposits,
      cryptoPortfolio: cryptoDeposits,
      stockHisa: stockHisaValue,
      stockSP500: stockSP500Value,
      cryptoHisa: cryptoHisaValue,
      cryptoSP500: cryptoSP500Value
    })
  }
  
  // Add today's data point with current market values if different from last entry date
  const lastEntryDate = uniqueDates[uniqueDates.length - 1]
  const todayDate = holdings.as_of
  
  if (todayDate !== lastEntryDate) {
    const stockDepositFlows = stockEntries.map(e => ({ date: e.week_start, amount: e.deposit_cad }))
    const cryptoDepositFlows = cryptoEntries.map(e => ({ date: e.week_start, amount: e.deposit_cad }))
    const allDepositFlows = allEntries.map(e => ({ date: e.week_start, amount: e.deposit_cad }))
    
    const currentStockValue = holdings.positions.reduce((sum, pos) => sum + (pos.shares * pos.market_price), 0)
    const currentCryptoValue = (holdings.crypto_positions || []).reduce((sum, pos) => sum + (pos.qty * pos.current_price), 0)
    const currentPortfolioValue = currentStockValue + currentCryptoValue + holdings.cash_cad
    
    const hisaValue = calculateHisaValue(allDepositFlows, benchmarks.hisa_rate_apy, new Date(todayDate))
    const sp500Value = calculateSP500DCA(allDepositFlows, benchmarks.sp500, new Date(todayDate))
    
    const stockHisaValue = calculateHisaValue(stockDepositFlows, benchmarks.hisa_rate_apy, new Date(todayDate))
    const stockSP500Value = calculateSP500DCA(stockDepositFlows, benchmarks.sp500, new Date(todayDate))
    
    const cryptoHisaValue = calculateHisaValue(cryptoDepositFlows, benchmarks.hisa_rate_apy, new Date(todayDate))
    const cryptoSP500Value = calculateSP500DCA(cryptoDepositFlows, benchmarks.sp500, new Date(todayDate))
    
    data.push({
      date: todayDate,
      portfolio: currentPortfolioValue,
      hisa: hisaValue,
      sp500: sp500Value,
      stockPortfolio: currentStockValue,
      cryptoPortfolio: currentCryptoValue,
      stockHisa: stockHisaValue,
      stockSP500: stockSP500Value,
      cryptoHisa: cryptoHisaValue,
      cryptoSP500: cryptoSP500Value
    })
  } else {
    // If today is the same as last entry date, update the last data point with current market values
    const lastIndex = data.length - 1
    if (lastIndex >= 0) {
      const currentStockValue = holdings.positions.reduce((sum, pos) => sum + (pos.shares * pos.market_price), 0)
      const currentCryptoValue = (holdings.crypto_positions || []).reduce((sum, pos) => sum + (pos.qty * pos.current_price), 0)
      const currentPortfolioValue = currentStockValue + currentCryptoValue + holdings.cash_cad
      
      data[lastIndex].portfolio = currentPortfolioValue
      data[lastIndex].stockPortfolio = currentStockValue
      data[lastIndex].cryptoPortfolio = currentCryptoValue
    }
  }
  
  // If we have daily snapshots, add them as separate data points
  if (dailySnapshots && dailySnapshots.length > 0) {
    // Check if we have snapshots for today - if so, don't add the separate "current value" point
    const todaySnapshots = dailySnapshots.filter(s => s.timestamp.startsWith(todayDate))
    const hasSnapshotsForToday = todaySnapshots.length > 0
    
    // If we added a current value point for today but we have snapshots, remove it
    if (hasSnapshotsForToday && data.length > 0 && data[data.length - 1].date === todayDate) {
      data.pop() // Remove the duplicate current value point
      console.log('Removed duplicate current value point since we have snapshots for today')
    }
    
    for (const snapshot of dailySnapshots) {
      const snapshotDateTime = new Date(snapshot.timestamp)
      const snapshotDateStr = snapshot.timestamp.split('T')[0]
      const timeStr = snapshotDateTime.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      })
      
      // Use full timestamp for accurate sorting, but create display date  
      const displayDate = `${snapshot.timestamp}|${timeStr}` // Store both for sorting
      
      // Calculate benchmark values for this date
      const allDepositFlows = allEntries
        .filter(e => new Date(e.week_start) <= new Date(snapshotDateStr))
        .map(e => ({ date: e.week_start, amount: e.deposit_cad }))
      
      const stockDepositFlows = stockEntries
        .filter(e => new Date(e.week_start) <= new Date(snapshotDateStr))
        .map(e => ({ date: e.week_start, amount: e.deposit_cad }))
      
      const cryptoDepositFlows = cryptoEntries
        .filter(e => new Date(e.week_start) <= new Date(snapshotDateStr))
        .map(e => ({ date: e.week_start, amount: e.deposit_cad }))
      
      const hisaValue = calculateHisaValue(allDepositFlows, benchmarks.hisa_rate_apy, snapshotDateTime)
      const sp500Value = calculateSP500DCA(allDepositFlows, benchmarks.sp500, snapshotDateTime)
      
      const stockHisaValue = calculateHisaValue(stockDepositFlows, benchmarks.hisa_rate_apy, snapshotDateTime)
      const stockSP500Value = calculateSP500DCA(stockDepositFlows, benchmarks.sp500, snapshotDateTime)
      
      const cryptoHisaValue = calculateHisaValue(cryptoDepositFlows, benchmarks.hisa_rate_apy, snapshotDateTime)
      const cryptoSP500Value = calculateSP500DCA(cryptoDepositFlows, benchmarks.sp500, snapshotDateTime)
      
      // Always add as new data point (don't update existing entries)
      data.push({
        date: displayDate,
        portfolio: snapshot.portfolio_value,
        hisa: hisaValue,
        sp500: sp500Value,
        stockPortfolio: snapshot.stock_value,
        cryptoPortfolio: snapshot.crypto_value,
        stockHisa: stockHisaValue,
        stockSP500: stockSP500Value,
        cryptoHisa: cryptoHisaValue,
        cryptoSP500: cryptoSP500Value
      })
    }
    
    // Sort all data by date
    data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }
  
  return data
}