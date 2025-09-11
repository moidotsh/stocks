import { promises as fs } from 'fs'
import path from 'path'

// Simple in-process mutex keyed by file path
const fileMutexQueue: Map<string, Promise<unknown>> = new Map()

export async function withFileMutex<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const previous = fileMutexQueue.get(filePath) || Promise.resolve()

  let resolveNext: (value: unknown) => void
  let rejectNext: (reason?: unknown) => void
  const next = new Promise((resolve, reject) => {
    resolveNext = resolve
    rejectNext = reject
  })

  fileMutexQueue.set(filePath, previous.then(() => next))

  try {
    const result = await task()
    resolveNext!(undefined)
    // Clean up if this promise is the tail
    const tail = fileMutexQueue.get(filePath)
    if (tail === next) {
      fileMutexQueue.delete(filePath)
    }
    return result
  } catch (err) {
    rejectNext!(err)
    const tail = fileMutexQueue.get(filePath)
    if (tail === next) {
      fileMutexQueue.delete(filePath)
    }
    throw err
  }
}

export async function writeJsonAtomic(targetPath: string, data: unknown): Promise<void> {
  const dir = path.dirname(targetPath)
  const base = path.basename(targetPath)
  const tempPath = path.join(dir, `${base}.tmp-${process.pid}-${Date.now()}`)

  // Ensure directory exists (should already, but safe)
  await fs.mkdir(dir, { recursive: true })

  const serialized = JSON.stringify(data, null, 2)
  await fs.writeFile(tempPath, serialized, { encoding: 'utf8' })
  // Atomic replace
  await fs.rename(tempPath, targetPath)
}


