import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    
    // Source paths (where Python screeners output files)
    const sourcePythonDir = path.join(process.cwd(), 'python', 'outputs')
    const stocksSourcePath = path.join(sourcePythonDir, 'llm_candidates.json')
    const cryptoSourcePath = path.join(sourcePythonDir, 'llm_candidates_crypto.json')
    
    // Destination paths (where web app expects them)
    const candidatesDir = path.join(process.cwd(), 'data', 'candidates')
    const todayDir = path.join(candidatesDir, today)
    const stocksDestPath = path.join(todayDir, 'stocks.json')
    const cryptoDestPath = path.join(todayDir, 'crypto.json')
    const latestPath = path.join(candidatesDir, 'latest.json')
    
    let stocksImported = false
    let cryptoImported = false
    
    // Create today's directory if it doesn't exist
    try {
      await fs.mkdir(todayDir, { recursive: true })
    } catch (error) {
      // Directory might already exist, ignore
    }
    
    // Try to import stocks candidates
    try {
      const stocksContent = await fs.readFile(stocksSourcePath, 'utf-8')
      // Validate it's valid JSON
      const stocksData = JSON.parse(stocksContent)
      
      // Enrich holdings with market prices
      const marketPricesPath = path.join(process.cwd(), 'data', 'market-prices.json')
      try {
        const marketPricesContent = await fs.readFile(marketPricesPath, 'utf-8')
        const marketPrices = JSON.parse(marketPricesContent)
        
        // Populate market prices for holdings
        if (stocksData.holdings && Array.isArray(stocksData.holdings)) {
          stocksData.holdings = stocksData.holdings.map((holding: any) => {
            const price = marketPrices.stocks[holding.ticker]
            return {
              ...holding,
              market_price: price || null,
              market_price_cad: price || null
            }
          })
        }
      } catch (priceError) {
        console.log('Could not load market prices, keeping null values:', priceError)
      }
      
      await fs.writeFile(stocksDestPath, JSON.stringify(stocksData, null, 2))
      stocksImported = true
    } catch (error) {
      console.log('No stocks candidates file found or invalid JSON:', error)
    }
    
    // Try to import crypto candidates
    try {
      const cryptoContent = await fs.readFile(cryptoSourcePath, 'utf-8')
      // Validate it's valid JSON
      JSON.parse(cryptoContent)
      await fs.writeFile(cryptoDestPath, cryptoContent)
      cryptoImported = true
    } catch (error) {
      console.log('No crypto candidates file found or invalid JSON:', error)
    }
    
    // Update latest.json if we imported anything
    if (stocksImported || cryptoImported) {
      await fs.writeFile(latestPath, JSON.stringify({ latest: today }, null, 2))
    }
    
    if (!stocksImported && !cryptoImported) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No candidate files found. Run Python screeners first to generate llm_candidates.json and/or llm_candidates_crypto.json in python/outputs/' 
        },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Candidate files imported successfully',
      date: today,
      stocks_imported: stocksImported,
      crypto_imported: cryptoImported
    })
    
  } catch (error) {
    console.error('Error importing candidates:', error)
    return NextResponse.json(
      { error: 'Failed to import candidate files' },
      { status: 500 }
    )
  }
}