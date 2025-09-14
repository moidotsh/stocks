import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { asset } = await request.json()
    
    if (!asset || !['equity', 'crypto'].includes(asset)) {
      return NextResponse.json(
        { error: 'Asset type required: equity or crypto' },
        { status: 400 }
      )
    }

    // Find most recent backup files
    const holdingsFile = asset === 'equity' ? 'holdings.csv' : 'crypto_holdings.csv'
    const entriesFile = asset === 'equity' ? 'data/entries.json' : 'data/crypto_entries.json'
    
    // Find backup files
    const cwd = process.cwd()
    const files = await fs.readdir(cwd)
    const backupFiles = files.filter(f => f.startsWith(`${holdingsFile}.bak-`))
    
    if (backupFiles.length === 0) {
      return NextResponse.json(
        { error: 'No backup files found' },
        { status: 404 }
      )
    }

    // Get most recent backup (sorted by timestamp in filename)
    const mostRecentBackup = backupFiles.sort().pop()!
    const backupPath = path.join(cwd, mostRecentBackup)
    const holdingsPath = path.join(cwd, holdingsFile)

    // Restore holdings from backup
    const backupContent = await fs.readFile(backupPath, 'utf-8')
    await fs.writeFile(holdingsPath, backupContent)

    // Remove the last entry from entries file
    const entriesPath = path.join(cwd, entriesFile)
    try {
      const entriesContent = await fs.readFile(entriesPath, 'utf-8')
      const entries = JSON.parse(entriesContent)
      
      if (entries.length > 0) {
        entries.pop() // Remove last entry
        await fs.writeFile(entriesPath, JSON.stringify(entries, null, 2))
      }
    } catch (error) {
      console.error('Failed to update entries file:', error)
      // Don't fail the whole operation if entries can't be updated
    }

    return NextResponse.json({ 
      success: true, 
      message: `Restored ${asset} holdings from ${mostRecentBackup}`,
      backupUsed: mostRecentBackup
    })

  } catch (error) {
    console.error('Undo error:', error)
    return NextResponse.json(
      { error: 'Failed to undo last operation' },
      { status: 500 }
    )
  }
}