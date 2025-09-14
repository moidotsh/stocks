import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET() {
  try {
    const latestPath = path.join(process.cwd(), 'data', 'candidates', 'latest.json')
    
    try {
      const content = await fs.readFile(latestPath, 'utf-8')
      const latest = JSON.parse(content)
      
      if (!latest.latest) {
        throw new Error('Invalid latest.json format')
      }
      
      return NextResponse.json({ date: latest.latest })
    } catch (error) {
      return NextResponse.json(
        { error: 'No latest candidates found. Run screeners first.' },
        { status: 404 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load latest candidates' },
      { status: 500 }
    )
  }
}