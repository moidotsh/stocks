import { promises as fs } from 'fs'
import path from 'path'
import { Entry, Holdings, Benchmark, PortfolioData } from './types'
import { EntrySchema, HoldingsSchema, BenchmarkSchema } from './types'
import { calculateMetrics, generateChartData } from './math'

const DATA_DIR = path.join(process.cwd(), 'data')

export async function getEntriesData(): Promise<Entry[]> {
  const filePath = path.join(DATA_DIR, 'entries.json')
  const fileContent = await fs.readFile(filePath, 'utf8')
  const data = JSON.parse(fileContent)
  
  // Validate with Zod
  const entries = data.map((entry: unknown) => EntrySchema.parse(entry))
  return entries.sort((a: Entry, b: Entry) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime())
}

export async function getHoldingsData(): Promise<Holdings> {
  const filePath = path.join(DATA_DIR, 'holdings.json')
  const fileContent = await fs.readFile(filePath, 'utf8')
  const data = JSON.parse(fileContent)
  
  return HoldingsSchema.parse(data)
}

export async function getBenchmarkData(): Promise<Benchmark> {
  const filePath = path.join(DATA_DIR, 'benchmarks.json')
  const fileContent = await fs.readFile(filePath, 'utf8')
  const data = JSON.parse(fileContent)
  
  return BenchmarkSchema.parse(data)
}

export async function getPortfolioData(): Promise<PortfolioData> {
  const [entries, holdings, benchmarks] = await Promise.all([
    getEntriesData(),
    getHoldingsData(),
    getBenchmarkData()
  ])

  const metrics = calculateMetrics(entries, holdings, benchmarks)
  const chartData = generateChartData(entries, holdings, benchmarks)

  return {
    metrics,
    chartData,
    entries,
    holdings,
    benchmarks
  }
}