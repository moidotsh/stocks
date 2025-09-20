import fs from 'fs/promises'
import path from 'path'

// Utility to get the last update timestamp from data files
export const getLastDataUpdate = async (): Promise<Date> => {
  const dataDir = path.join(process.cwd(), 'data')

  try {
    const files = await fs.readdir(dataDir)
    const jsonFiles = files.filter(file => file.endsWith('.json'))

    let latestTime = new Date(0)

    for (const file of jsonFiles) {
      const filePath = path.join(dataDir, file)
      const stats = await fs.stat(filePath)
      if (stats.mtime > latestTime) {
        latestTime = stats.mtime
      }
    }

    return latestTime
  } catch (error) {
    console.error('Error getting last data update:', error)
    return new Date(0)
  }
}

export const formatDataAge = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}