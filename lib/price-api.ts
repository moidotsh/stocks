// Free APIs for live market data
// Alpha Vantage: 25 requests/day free tier
// CoinGecko: 50 requests/minute free tier

interface StockPrice {
  symbol: string
  price: number
  change?: number
  changePercent?: number
}

interface CryptoPrice {
  symbol: string
  price: number
  change24h?: number
  changePercent24h?: number
}

// Ticker symbol mapping for Canadian stocks
const TICKER_MAPPING: Record<string, string> = {
  'ABX': 'ABX.TO',
  'XIU': 'XIU.TO', 
  'TDB902': 'TDB902.TO',
  // Add more mappings as needed
}

// Get mapped ticker for API lookup
function getMappedTicker(ticker: string): string {
  return TICKER_MAPPING[ticker] || ticker
}

// Try multiple stock APIs - Alpha Vantage first, then Yahoo Finance fallback
export async function fetchStockPrice(ticker: string): Promise<StockPrice | null> {
  try {
    const mappedTicker = getMappedTicker(ticker)
    
    // Try Alpha Vantage first if API key is available
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY
    if (apiKey && apiKey !== 'demo') {
      const alphaResult = await fetchFromAlphaVantage(mappedTicker, ticker, apiKey)
      if (alphaResult) return alphaResult
    }
    
    // Fallback to Yahoo Finance API (free, no key required)
    return await fetchFromYahooFinance(mappedTicker, ticker)
  } catch (error) {
    console.error(`Error fetching stock price for ${ticker}:`, error)
    return null
  }
}

async function fetchFromAlphaVantage(mappedTicker: string, originalTicker: string, apiKey: string): Promise<StockPrice | null> {
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${mappedTicker}&apikey=${apiKey}`
    )
    
    if (!response.ok) return null
    
    const data = await response.json()
    const quote = data['Global Quote']
    
    if (!quote) return null
    
    return {
      symbol: originalTicker,
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent'].replace('%', ''))
    }
  } catch (error) {
    console.error(`Alpha Vantage API error for ${originalTicker}:`, error)
    return null
  }
}

async function fetchFromYahooFinance(mappedTicker: string, originalTicker: string): Promise<StockPrice | null> {
  try {
    // Use Yahoo Finance API v1 (free, no key required)
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${mappedTicker}`
    )
    
    if (!response.ok) return null
    
    const data = await response.json()
    const result = data.chart?.result?.[0]
    
    if (!result || !result.meta) return null
    
    const currentPrice = result.meta.regularMarketPrice
    const previousClose = result.meta.previousClose
    
    if (currentPrice === undefined || previousClose === undefined) return null
    
    const change = currentPrice - previousClose
    const changePercent = (change / previousClose) * 100
    
    return {
      symbol: originalTicker,
      price: currentPrice,
      change,
      changePercent
    }
  } catch (error) {
    console.error(`Yahoo Finance API error for ${originalTicker}:`, error)
    return null
  }
}

// CoinGecko API for crypto (free tier: 50 requests/minute)
const CRYPTO_ID_MAPPING: Record<string, string> = {
  // Current holdings
  'BTC': 'bitcoin',
  'ETH': 'ethereum', 
  'DOGE': 'dogecoin',
  'AVAX': 'avalanche-2',
  'DOT': 'polkadot',
  'ENA': 'ethena',
  'WLD': 'worldcoin-wld',
  'MOODENG': 'moo-deng',
  
  // High-priority candidates from lists
  'SOL': 'solana',
  'ONDO': 'ondo-finance',
  'WIF': 'dogwifcoin',
  'YGG': 'yield-guild-games',
  'FARTCOIN': 'fartcoin',
  'EIGEN': 'eigenlayer',
  'SEI': 'sei-network',
  'ETHFI': 'ether-fi',
  'PNUT': 'peanut-the-squirrel',
  'RENDER': 'render-token',
  'IMX': 'immutable-x',
  'W': 'wormhole',
  'SPX': 'spx6900',
  'POPCAT': 'popcat',
  'GRASS': 'grass',
  'HNT': 'helium',
  'USDC': 'usd-coin',
  'WLFI': 'world-liberty-financial',
  'LTC': 'litecoin',
  'UNI': 'uniswap',
  'BCH': 'bitcoin-cash',
  'POL': 'polygon-ecosystem-token',
  'S': 'sonic-3',
  'TON': 'the-open-network',
  'PYTH': 'pyth-network',
  'API3': 'api3',
  'APE': 'apecoin',
  'SYRUP': 'syrup',
  'ZRX': '0x',
  'LPT': 'livepeer',
  'UMA': 'uma',
  'BAT': 'basic-attention-token',
  'LRC': 'loopring',
  'QNT': 'quant-network',
  'BAND': 'band-protocol',
  
  // Additional Wealthsimple supported coins
  'VIRTUAL': 'virtuals-protocol',
  'BLUR': 'blur',
  'CELO': 'celo',
  'HBAR': 'hedera-hashgraph',
  'OP': 'optimism',
  'NEAR': 'near',
  'GRT': 'the-graph',
  'COTI': 'coti',
  'SUSHI': 'sushi',
  'SUI': 'sui',
  'PENDLE': 'pendle',
  'INJ': 'injective-protocol',
  'RUNE': 'thorchain',
  'LINK': 'chainlink',
  'JTO': 'jito-governance-token',
  'TIA': 'celestia',
  'XLM': 'stellar',
  'RAY': 'raydium',
  'XTZ': 'tezos',
  'JUP': 'jupiter-exchange-solana',
  'DYDX': 'dydx-chain',
  'SAND': 'the-sandbox',
  'MANA': 'decentraland',
  '1INCH': '1inch',
  'ENS': 'ethereum-name-service',
  'CHZ': 'chiliz',
  'COMP': 'compound-governance-token',
  'MASK': 'mask-network',
  'XRP': 'ripple',
  'FIL': 'filecoin',
  'BNB': 'binancecoin',
  'YFI': 'yearn-finance',
  'CAKE': 'pancakeswap-token',
  'ALGO': 'algorand',
  'FET': 'fetch-ai',
  'ARB': 'arbitrum',
  'SNX': 'synthetix-network-token',
  'LDO': 'lido-dao',
  'ATOM': 'cosmos',
  'MORPHO': 'morpho',
  'CRV': 'curve-dao-token',
  'ETC': 'ethereum-classic',
  'AXS': 'axie-infinity',
  'SUPER': 'superfarm',
  'AAVE': 'aave',
  'TRUMP': 'official-trump',
  'ANKR': 'ankr',
  'BNT': 'bancor',
  'BONK': 'bonk',
  'CTSI': 'cartesi',
  'CHR': 'chromia',
  'FLOKI': 'floki',
  'GALA': 'gala',
  'GOAT': 'goatseus-maximus',
  'JASMY': 'jasmy',
  'CHILLGUY': 'just-a-chill-guy',
  'KNC': 'kyber-network-crystal',
  'MKR': 'maker',
  'ALICE': 'my-neighbor-alice',
  'PEPE': 'pepe',
  'PENGU': 'pudgy-penguins',
  'PUMP': 'pump-fun',
  'SHIB': 'shiba-inu',
  'SKL': 'skale',
  'STORJ': 'storj',
  'TURBO': 'turbo'
}

export async function fetchCryptoPrice(symbol: string): Promise<CryptoPrice | null> {
  try {
    const coinId = CRYPTO_ID_MAPPING[symbol.toUpperCase()]
    if (!coinId) return null
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=cad&include_24hr_change=true`
    )
    
    if (!response.ok) return null
    
    const data = await response.json()
    const coinData = data[coinId]
    
    if (!coinData) return null
    
    return {
      symbol,
      price: coinData.cad,
      change24h: coinData.cad_24h_change || 0,
      changePercent24h: coinData.cad_24h_change || 0
    }
  } catch (error) {
    console.error(`Error fetching crypto price for ${symbol}:`, error)
    return null
  }
}

// Batch fetch multiple stock prices
export async function fetchStockPrices(tickers: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {}
  
  // Use Promise.allSettled to handle individual failures gracefully
  const results = await Promise.allSettled(
    tickers.map(ticker => fetchStockPrice(ticker))
  )
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) {
      prices[tickers[index]] = result.value.price
    }
  })
  
  return prices
}

// Batch fetch multiple crypto prices
export async function fetchCryptoPrices(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {}
  
  try {
    // CoinGecko allows batch requests
    const coinIds = symbols
      .map(symbol => CRYPTO_ID_MAPPING[symbol.toUpperCase()])
      .filter(Boolean)
    
    if (coinIds.length === 0) return prices
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=cad`
    )
    
    if (!response.ok) return prices
    
    const data = await response.json()
    
    symbols.forEach(symbol => {
      const coinId = CRYPTO_ID_MAPPING[symbol.toUpperCase()]
      if (coinId && data[coinId]) {
        prices[symbol] = data[coinId].cad
      }
    })
  } catch (error) {
    console.error('Error fetching crypto prices:', error)
  }
  
  return prices
}

// Fetch all market prices and update the data file
export async function updateMarketPrices(
  stockTickers: string[], 
  cryptoSymbols: string[]
): Promise<{ stocks: Record<string, number>; crypto: Record<string, number> }> {
  const [stockPrices, cryptoPrices] = await Promise.all([
    fetchStockPrices(stockTickers),
    fetchCryptoPrices(cryptoSymbols)
  ])
  
  return {
    stocks: stockPrices,
    crypto: cryptoPrices
  }
}