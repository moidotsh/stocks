import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

interface Params {
  date: string
  type: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { date, type } = params
    
    if (!['stocks', 'crypto'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be stocks or crypto.' },
        { status: 400 }
      )
    }
    
    const fileName = type === 'stocks' ? 'stocks.json' : 'crypto.json'
    const candidatesPath = path.join(
      process.cwd(),
      'data',
      'candidates',
      date,
      fileName
    )
    
    try {
      const content = await fs.readFile(candidatesPath, 'utf-8')
      const data = JSON.parse(content)
      
      return NextResponse.json(data)
    } catch (error) {
      return NextResponse.json(
        { error: `No ${type} candidates found for ${date}` },
        { status: 404 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load candidates' },
      { status: 500 }
    )
  }
}