#!/usr/bin/env tsx

import { promises as fs } from 'fs'
import path from 'path'
import { z } from 'zod'
import { EntrySchema, HoldingsSchema, BenchmarkSchema, Entry, Holdings } from '../lib/types'

const DATA_DIR = path.join(process.cwd(), 'data')

// Overloaded function signatures for proper typing
async function validateFile<T>(
  filename: string,
  schema: z.ZodSchema<T>,
  isArray: true
): Promise<{ valid: boolean; data?: T[]; errors?: string[] }>

async function validateFile<T>(
  filename: string,
  schema: z.ZodSchema<T>,
  isArray?: false
): Promise<{ valid: boolean; data?: T; errors?: string[] }>

async function validateFile<T>(
  filename: string,
  schema: z.ZodSchema<T>,
  isArray: boolean = false
): Promise<{ valid: boolean; data?: T | T[]; errors?: string[] }> {
  try {
    const filePath = path.join(DATA_DIR, filename)
    const fileContent = await fs.readFile(filePath, 'utf8')
    const rawData = JSON.parse(fileContent)
    
    if (isArray) {
      const validatedData = rawData.map((item: unknown, index: number) => {
        try {
          return schema.parse(item)
        } catch (error) {
          throw new Error(`Item ${index}: ${error instanceof z.ZodError ? error.errors.map(e => e.message).join(', ') : error}`)
        }
      })
      return { valid: true, data: validatedData }
    } else {
      const validatedData = schema.parse(rawData)
      return { valid: true, data: validatedData }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return { valid: false, errors: [errorMessage] }
  }
}

async function validateDataIntegrity() {
  console.log('🔍 Validating TFSA data files...\n')
  
  let hasErrors = false
  
  // Validate entries.json
  console.log('📊 Validating entries.json...')
  const entriesResult = await validateFile('entries.json', EntrySchema, true)
  if (!entriesResult.valid) {
    console.error('❌ entries.json validation failed:')
    entriesResult.errors?.forEach(error => console.error(`   ${error}`))
    hasErrors = true
  } else {
    console.log('✅ entries.json is valid')
  }
  
  // Validate holdings.json
  console.log('\n💼 Validating holdings.json...')
  const holdingsResult = await validateFile('holdings.json', HoldingsSchema, false)
  if (!holdingsResult.valid) {
    console.error('❌ holdings.json validation failed:')
    holdingsResult.errors?.forEach(error => console.error(`   ${error}`))
    hasErrors = true
  } else {
    console.log('✅ holdings.json is valid')
  }
  
  // Validate benchmarks.json
  console.log('\n📈 Validating benchmarks.json...')
  const benchmarksResult = await validateFile('benchmarks.json', BenchmarkSchema, false)
  if (!benchmarksResult.valid) {
    console.error('❌ benchmarks.json validation failed:')
    benchmarksResult.errors?.forEach(error => console.error(`   ${error}`))
    hasErrors = true
  } else {
    console.log('✅ benchmarks.json is valid')
  }
  
  // Cross-validation checks
  if (entriesResult.valid && holdingsResult.valid) {
    console.log('\n🔗 Running cross-validation checks...')
    
    // TypeScript now knows these are the correct types
    const entries = entriesResult.data // Type: Entry[] | undefined
    const holdings = holdingsResult.data // Type: Holdings | undefined
    
    if (entries && entries.length > 0 && holdings) {
      const latestEntryDate = Math.max(...entries.map(e => new Date(e.week_start).getTime()))
      const holdingsDate = new Date(holdings.as_of).getTime()
      
      if (holdingsDate < latestEntryDate) {
        console.warn('⚠️  Holdings date is older than latest entry date')
      }
    }
    
    console.log('✅ Cross-validation complete')
  }
  
  if (hasErrors) {
    console.error('\n❌ Data validation failed! Build will be aborted.')
    process.exit(1)
  } else {
    console.log('\n🎉 All data files are valid!')
  }
}

// Run validation
validateDataIntegrity().catch(error => {
  console.error('💥 Validation script failed:', error)
  process.exit(1)
})