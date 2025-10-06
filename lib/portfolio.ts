import { Decimal } from 'decimal.js'

// Precision settings matching Python implementation
const QTY_PRECISION = 6
const PRICE_PRECISION = 4

function roundQty(x: number | string | Decimal): Decimal {
  return new Decimal(x).toDecimalPlaces(QTY_PRECISION, Decimal.ROUND_HALF_UP)
}

function roundPrice(x: number | string | Decimal): Decimal {
  return new Decimal(x).toDecimalPlaces(PRICE_PRECISION, Decimal.ROUND_HALF_UP)
}

// Types for holdings and trades
export interface EquityHolding {
  ticker: string
  shares: number
  avg_cost: number
  currency: 'CAD' | 'USD'
}

export interface CryptoHolding {
  symbol: string
  amount: number
  avg_cost_cad: number
}

export interface EquityTrade {
  action: 'buy' | 'sell'
  ticker: string
  qty: number
  unit_price: number
  currency: 'CAD' | 'USD'
}

export interface CryptoTrade {
  action: 'buy' | 'sell'
  symbol: string
  qty: number
  unit_price: number
}

export interface TradeEntry {
  week_start: string
  deposit_cad: number
  trades: Array<{
    action: 'buy' | 'sell'
    ticker?: string
    symbol?: string
    qty: number
    price: number
    currency?: 'CAD' | 'USD'
  }>
  notes?: string
}

/**
 * Apply equity trades to holdings using weighted average cost calculation
 * Matches the logic from apply_trades.py apply_equity function
 */
export function applyEquityTrades(
  existingHoldings: EquityHolding[],
  trades: EquityTrade[]
): EquityHolding[] {
  // Create index of holdings by ticker
  const holdingsIndex: Record<string, EquityHolding> = {}
  existingHoldings.forEach(holding => {
    holdingsIndex[holding.ticker] = { ...holding }
  })

  for (const trade of trades) {
    const { action, ticker, qty, unit_price, currency } = trade
    const qtyDecimal = new Decimal(qty)
    const priceDecimal = new Decimal(unit_price)

    if (qtyDecimal.lte(0)) {
      throw new Error(`Non-positive quantity for ${ticker}`)
    }

    const existingHolding = holdingsIndex[ticker]

    if (action === 'buy') {
      if (existingHolding) {
        // Currency mismatch check
        if (existingHolding.currency !== currency) {
          throw new Error(`Currency mismatch for ${ticker}`)
        }

        // Weighted average calculation
        const existingShares = new Decimal(existingHolding.shares)
        const existingCost = new Decimal(existingHolding.avg_cost)
        
        const newShares = existingShares.plus(qtyDecimal)
        const newCost = existingShares
          .times(existingCost)
          .plus(qtyDecimal.times(priceDecimal))
          .div(newShares)

        holdingsIndex[ticker] = {
          ticker,
          shares: roundQty(newShares).toNumber(),
          avg_cost: roundPrice(newCost).toNumber(),
          currency
        }
      } else {
        // New holding
        holdingsIndex[ticker] = {
          ticker,
          shares: roundQty(qtyDecimal).toNumber(),
          avg_cost: roundPrice(priceDecimal).toNumber(),
          currency
        }
      }
    } else { // sell
      if (!existingHolding) {
        throw new Error(`Selling non-existent holding ${ticker}`)
      }

      const existingShares = new Decimal(existingHolding.shares)
      if (qtyDecimal.gt(existingShares)) {
        throw new Error(
          `Sell quantity ${qty} exceeds holding ${existingHolding.shares} for ${ticker}`
        )
      }

      const newShares = existingShares.minus(qtyDecimal)
      
      if (newShares.eq(0)) {
        // Remove holding if fully sold
        delete holdingsIndex[ticker]
      } else {
        // Keep same avg_cost for remaining shares
        holdingsIndex[ticker] = {
          ...existingHolding,
          shares: roundQty(newShares).toNumber()
        }
      }
    }
  }

  // Return as sorted array
  return Object.values(holdingsIndex).sort((a, b) => a.ticker.localeCompare(b.ticker))
}

/**
 * Apply crypto trades to holdings using weighted average cost calculation
 * Matches the logic from apply_trades.py apply_crypto function
 */
export function applyCryptoTrades(
  existingHoldings: CryptoHolding[],
  trades: CryptoTrade[]
): CryptoHolding[] {
  // Create index of holdings by symbol
  const holdingsIndex: Record<string, CryptoHolding> = {}
  existingHoldings.forEach(holding => {
    holdingsIndex[holding.symbol] = { ...holding }
  })

  for (const trade of trades) {
    const { action, symbol, qty, unit_price } = trade
    const qtyDecimal = new Decimal(qty)
    const priceDecimal = new Decimal(unit_price)

    if (qtyDecimal.lte(0)) {
      throw new Error(`Non-positive amount for ${symbol}`)
    }

    const existingHolding = holdingsIndex[symbol]

    if (action === 'buy') {
      if (existingHolding) {
        // Weighted average calculation
        const existingAmount = new Decimal(existingHolding.amount)
        const existingCost = new Decimal(existingHolding.avg_cost_cad)
        
        const newAmount = existingAmount.plus(qtyDecimal)
        const newCost = existingAmount
          .times(existingCost)
          .plus(qtyDecimal.times(priceDecimal))
          .div(newAmount)

        holdingsIndex[symbol] = {
          symbol,
          amount: roundQty(newAmount).toNumber(),
          avg_cost_cad: roundPrice(newCost).toNumber()
        }
      } else {
        // New holding
        holdingsIndex[symbol] = {
          symbol,
          amount: roundQty(qtyDecimal).toNumber(),
          avg_cost_cad: roundPrice(priceDecimal).toNumber()
        }
      }
    } else { // sell
      if (!existingHolding) {
        throw new Error(`Selling non-existent holding ${symbol}`)
      }

      const existingAmount = new Decimal(existingHolding.amount)
      if (qtyDecimal.gt(existingAmount)) {
        throw new Error(
          `Sell amount ${qty} exceeds holding ${existingHolding.amount} for ${symbol}`
        )
      }

      const newAmount = existingAmount.minus(qtyDecimal)
      
      if (newAmount.eq(0)) {
        // Remove holding if fully sold
        delete holdingsIndex[symbol]
      } else {
        // Keep same avg_cost for remaining amount
        holdingsIndex[symbol] = {
          ...existingHolding,
          amount: roundQty(newAmount).toNumber()
        }
      }
    }
  }

  // Return as sorted array
  return Object.values(holdingsIndex).sort((a, b) => a.symbol.localeCompare(b.symbol))
}

/**
 * Convert trades to entry format for JSON storage
 * Matches the fills_to_entry_trades function from record_week.py
 */
export function tradesToEntryFormat(
  equityTrades: EquityTrade[],
  cryptoTrades: CryptoTrade[]
): TradeEntry['trades'] {
  const entryTrades: TradeEntry['trades'] = []

  // Add equity trades
  equityTrades.forEach(trade => {
    entryTrades.push({
      action: trade.action,
      ticker: trade.ticker,
      qty: trade.qty,
      price: trade.unit_price,
      currency: trade.currency
    })
  })

  // Add crypto trades
  cryptoTrades.forEach(trade => {
    entryTrades.push({
      action: trade.action,
      ticker: trade.symbol, // Use "ticker" field for consistency with holdings calculator
      qty: trade.qty,
      price: trade.unit_price,
      currency: 'CAD' // Crypto trades are always in CAD
    })
  })

  return entryTrades
}

/**
 * Calculate portfolio impact preview for a set of trades
 */
export function calculateTradeImpact(
  currentEquityHoldings: EquityHolding[],
  currentCryptoHoldings: CryptoHolding[],
  equityTrades: EquityTrade[],
  cryptoTrades: CryptoTrade[]
): {
  newEquityHoldings: EquityHolding[]
  newCryptoHoldings: CryptoHolding[]
  totalCost: number
  netCashFlow: number
} {
  const newEquityHoldings = applyEquityTrades(currentEquityHoldings, equityTrades)
  const newCryptoHoldings = applyCryptoTrades(currentCryptoHoldings, cryptoTrades)

  // Calculate total cost and net cash flow
  let totalCost = 0
  let netCashFlow = 0

  equityTrades.forEach(trade => {
    const cost = trade.qty * trade.unit_price
    totalCost += cost
    netCashFlow += trade.action === 'buy' ? -cost : cost
  })

  cryptoTrades.forEach(trade => {
    const cost = trade.qty * trade.unit_price
    totalCost += cost
    netCashFlow += trade.action === 'buy' ? -cost : cost
  })

  return {
    newEquityHoldings,
    newCryptoHoldings,
    totalCost: Math.abs(totalCost),
    netCashFlow
  }
}