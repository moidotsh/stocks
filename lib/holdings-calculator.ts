import { Entry, Position, CryptoPosition, Trade, CryptoTrade } from './types'

export interface CalculatedPosition extends Omit<Position, 'market_price'> {
  market_price?: number
}

export interface CalculatedCryptoPosition extends Omit<CryptoPosition, 'current_price'> {
  current_price?: number
}

export interface MarketPrices {
  stocks: Record<string, number>
  crypto: Record<string, number>
}

/**
 * Calculate stock positions from trade history
 */
export function calculateStockPositions(entries: Entry[]): CalculatedPosition[] {
  const positionMap = new Map<string, { shares: number, totalCost: number, currency: string }>()
  
  // Process all trades chronologically
  for (const entry of entries) {
    for (const trade of entry.trades || []) {
      const key = trade.ticker
      const existing = positionMap.get(key) || { shares: 0, totalCost: 0, currency: trade.currency }
      
      if (trade.action === 'buy') {
        existing.shares += trade.qty
        existing.totalCost += trade.qty * trade.price
      } else if (trade.action === 'sell') {
        const costBasis = (existing.totalCost / existing.shares) * trade.qty
        existing.shares -= trade.qty
        existing.totalCost -= costBasis
      }
      
      if (existing.shares > 0.001) { // Keep positions with meaningful amounts
        positionMap.set(key, existing)
      } else {
        positionMap.delete(key) // Remove positions that are essentially zero
      }
    }
  }
  
  // Convert to Position objects
  return Array.from(positionMap.entries()).map(([ticker, data]) => ({
    ticker,
    shares: data.shares,
    avg_cost: data.totalCost / data.shares,
    currency: data.currency as 'CAD' | 'USD'
  }))
}

/**
 * Calculate crypto positions from crypto trade history
 */
export function calculateCryptoPositions(
  entries: Entry[], 
  cryptoEntries?: Entry[]
): CalculatedCryptoPosition[] {
  const positionMap = new Map<string, { qty: number, totalCost: number, platform?: string }>()
  
  // Process regular entries with crypto trades
  for (const entry of entries) {
    if (entry.crypto_trades) {
      for (const trade of entry.crypto_trades) {
        processCryptoTrade(trade, positionMap)
      }
    }
  }
  
  // Process separate crypto entries if provided
  if (cryptoEntries) {
    for (const entry of cryptoEntries) {
      for (const trade of entry.trades || []) {
        // Assume trades in crypto_entries.json are crypto trades with ticker field
        processCryptoTradeFromGeneric(trade, positionMap)
      }
    }
  }
  
  // Convert to CryptoPosition objects
  return Array.from(positionMap.entries()).map(([symbol, data]) => ({
    symbol,
    qty: data.qty,
    avg_cost: data.totalCost / data.qty,
    platform: data.platform
  }))
}

function processCryptoTradeFromGeneric(
  trade: Trade, // Generic trade from entries.json format
  positionMap: Map<string, { qty: number, totalCost: number, platform?: string }>
) {
  const key = trade.ticker // Use ticker as symbol for crypto
  const existing = positionMap.get(key) || { qty: 0, totalCost: 0, platform: undefined }
  
  if (trade.action === 'buy') {
    existing.qty += trade.qty
    existing.totalCost += trade.qty * trade.price
  } else if (trade.action === 'sell') {
    const costBasis = (existing.totalCost / existing.qty) * trade.qty
    existing.qty -= trade.qty
    existing.totalCost -= costBasis
  }
  
  if (existing.qty > 0.00000001) { // Keep positions with meaningful amounts (crypto precision)
    positionMap.set(key, existing)
  } else {
    positionMap.delete(key)
  }
}

function processCryptoTrade(
  trade: CryptoTrade, 
  positionMap: Map<string, { qty: number, totalCost: number, platform?: string }>
) {
  const key = trade.symbol
  const existing = positionMap.get(key) || { qty: 0, totalCost: 0, platform: trade.platform }
  
  if (trade.action === 'buy') {
    existing.qty += trade.qty
    existing.totalCost += trade.qty * trade.price
  } else if (trade.action === 'sell') {
    const costBasis = (existing.totalCost / existing.qty) * trade.qty
    existing.qty -= trade.qty
    existing.totalCost -= costBasis
  }
  
  if (existing.qty > 0.00000001) { // Keep positions with meaningful amounts (crypto precision)
    positionMap.set(key, existing)
  } else {
    positionMap.delete(key)
  }
}

/**
 * Apply market prices to calculated positions
 */
export function applyMarketPrices(
  stockPositions: CalculatedPosition[],
  cryptoPositions: CalculatedCryptoPosition[],
  marketPrices: MarketPrices
): { positions: Position[], crypto_positions: CryptoPosition[] } {
  const positions = stockPositions.map(pos => ({
    ...pos,
    market_price: marketPrices.stocks[pos.ticker] || pos.avg_cost
  }))
  
  const crypto_positions = cryptoPositions.map(pos => ({
    ...pos,
    current_price: marketPrices.crypto[pos.symbol] || pos.avg_cost
  }))
  
  return { positions, crypto_positions }
}

/**
 * Calculate total cash deposited minus spent on trades
 */
export function calculateCashRemaining(entries: Entry[], cryptoEntries?: Entry[]): number {
  let totalDeposited = 0
  let totalSpent = 0
  
  // Regular entries
  for (const entry of entries) {
    totalDeposited += entry.deposit_cad
    
    // Stock trades
    for (const trade of entry.trades || []) {
      totalSpent += trade.qty * trade.price
    }
    
    // Crypto trades
    for (const trade of entry.crypto_trades || []) {
      if (trade.action === 'buy') {
        totalSpent += trade.qty * trade.price
      } else {
        totalSpent -= trade.qty * trade.price // selling adds back to cash
      }
    }
  }
  
  // Crypto entries
  if (cryptoEntries) {
    for (const entry of cryptoEntries) {
      totalDeposited += entry.deposit_cad
      
      for (const trade of entry.trades || []) {
        if (trade.action === 'buy') {
          totalSpent += trade.qty * trade.price
        } else {
          totalSpent -= trade.qty * trade.price
        }
      }
    }
  }
  
  return Math.max(0, totalDeposited - totalSpent)
}