import { z } from "zod"

const TradeStock = z.object({
  action: z.enum(["buy","sell"]),
  ticker: z.string().min(1),
  qty: z.number().positive(),
  limit_price: z.number().nullable()
})

const TradeCrypto = z.object({
  action: z.enum(["buy","sell"]),
  symbol: z.string().min(1),
  qty: z.number().positive(),
  limit_price: z.number().nullable()
})

const OutputStock = z.object({
  trades: z.array(TradeStock),
  rationale: z.string(),
  risk_notes: z.string()
})

const OutputCrypto = z.object({
  trades: z.array(TradeCrypto),
  rationale: z.string(),
  risk_notes: z.string()
})

export function validateLLMOutput(
  outputJson: unknown,
  {
    isCrypto,
    cashAvailable,
    minTrade,
    maxTrades,
    priceBySymbol,       // { TICKER/SYMBOL: effective_* price }
    allowedSet           // Set<string> of candidates
  }: {
    isCrypto: boolean
    cashAvailable: number
    minTrade: number
    maxTrades: number
    priceBySymbol: Record<string, number>
    allowedSet: Set<string>
  }
) {
  try {
    const schema = isCrypto ? OutputCrypto : OutputStock
    const o = schema.parse(outputJson)
    
    if (o.trades.length > maxTrades) {
      throw new Error(`Too many trades: ${o.trades.length} > ${maxTrades}`)
    }

    let spend = 0, proceeds = 0
    
    for (const t of o.trades) {
      const key = ("ticker" in t) ? t.ticker : t.symbol
      
      if (!allowedSet.has(key)) {
        throw new Error(`Not in candidates: ${key}`)
      }
      
      const p = priceBySymbol[key]
      if (!p) {
        throw new Error(`No price for ${key}`)
      }
      
      const notional = t.qty * p
      
      if (t.action === "buy") {
        if (notional < minTrade) {
          throw new Error(`Trade below min: ${key} ($${notional.toFixed(2)} < $${minTrade})`)
        }
        spend += notional
      } else {
        proceeds += notional
      }
    }
    
    const netSpend = spend - proceeds
    if (netSpend > cashAvailable + 1e-6) {
      throw new Error(`Spends more than available cash: $${netSpend.toFixed(2)} > $${cashAvailable.toFixed(2)}`)
    }
    
    return { valid: true, output: o, spend, proceeds, netSpend }
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown validation error',
      spend: 0,
      proceeds: 0,
      netSpend: 0
    }
  }
}