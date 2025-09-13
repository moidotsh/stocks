import { NextResponse } from 'next/server'
import { getPortfolioData } from '@/lib/data'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const asOfWeek = searchParams.get('asOfWeek') || undefined
    
    const portfolioData = await getPortfolioData(asOfWeek)
    
    return NextResponse.json(portfolioData)
  } catch (error) {
    console.error('Error fetching portfolio data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch portfolio data' },
      { status: 500 }
    )
  }
}