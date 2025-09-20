import { PortfolioData } from './types'
import { CONTRIBUTION_FORMULA } from './contribution-utils'

interface WeeklyTrade {
  symbol: string
  qty: number
  purchasePrice: number
  currentPrice: number
  currentValue: number
  purchaseValue: number
  profit: number
}

interface WeeklyPerformance {
  week: number
  date: string
  weeklyContribution: number
  trades: WeeklyTrade[]
  totalCurrentValue: number
  totalPurchaseValue: number
  totalProfit: number
  totalReturn: number
}

export function calculateWeeklyPerformance(data: PortfolioData, cryptoEntries: any[] = []): WeeklyPerformance[] {
  const performances: WeeklyPerformance[] = []

  // Get current holdings data
  const { holdings } = data

  // Create a price lookup map for both stocks and crypto
  const priceMap = new Map()

  // Add stock prices
  holdings.positions.forEach(p => {
    priceMap.set(p.ticker, p.market_price)
  })

  // Add crypto prices
  holdings.crypto_positions?.forEach(p => {
    priceMap.set(p.symbol, p.current_price)
  })

  // Process stock and crypto entries
  const stockEntries = data.entries || []

  for (let weekIndex = 0; weekIndex < Math.max(stockEntries.length, cryptoEntries.length); weekIndex++) {
    const stockEntry = stockEntries[weekIndex]
    const cryptoEntry = cryptoEntries[weekIndex]
    const weekNumber = weekIndex + 1

    if (!stockEntry && !cryptoEntry) continue

    const weeklyTrades: WeeklyTrade[] = []
    let totalPurchaseValue = 0
    let totalCurrentValue = 0

    // Process stock trades for this week
    if (stockEntry?.trades) {
      stockEntry.trades.forEach(trade => {
        if (trade.action === 'buy') {
          const currentPrice = priceMap.get(trade.ticker) || trade.price
          const purchaseValue = trade.qty * trade.price
          const currentValue = trade.qty * currentPrice
          const profit = currentValue - purchaseValue

          weeklyTrades.push({
            symbol: trade.ticker,
            qty: trade.qty,
            purchasePrice: trade.price,
            currentPrice,
            currentValue,
            purchaseValue,
            profit
          })

          totalPurchaseValue += purchaseValue
          totalCurrentValue += currentValue
        }
      })
    }

    // Process crypto trades for this week
    if (cryptoEntry?.trades) {
      cryptoEntry.trades.forEach((trade: any) => {
        if (trade.action === 'buy') {
          const symbol = trade.symbol || trade.ticker // Handle both formats
          const currentPrice = priceMap.get(symbol) || trade.price
          const purchaseValue = trade.qty * trade.price
          const currentValue = trade.qty * currentPrice
          const profit = currentValue - purchaseValue

          weeklyTrades.push({
            symbol,
            qty: trade.qty,
            purchasePrice: trade.price,
            currentPrice,
            currentValue,
            purchaseValue,
            profit
          })

          totalPurchaseValue += purchaseValue
          totalCurrentValue += currentValue
        }
      })
    }

    const totalProfit = totalCurrentValue - totalPurchaseValue
    const totalReturn = totalPurchaseValue > 0 ? (totalProfit / totalPurchaseValue) * 100 : 0

    performances.push({
      week: weekNumber,
      date: CONTRIBUTION_FORMULA.getWeekDateRange(weekNumber),
      weeklyContribution: CONTRIBUTION_FORMULA.getTotalContribution(weekNumber),
      trades: weeklyTrades,
      totalCurrentValue,
      totalPurchaseValue,
      totalProfit,
      totalReturn
    })
  }

  return performances
}