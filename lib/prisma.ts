// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Lazy-imported to avoid circular import (offline-sync imports prisma)
async function fireReceiptSync(result: any, operation: 'upsert' | 'delete') {
  if (!result?.id) return
  try {
    const { queueReceiptSync } = await import('./offline-sync')
    await queueReceiptSync(result, operation)
  } catch (err: any) {
    console.error('[OfflineSync] receipt enqueue failed:', err?.message || err)
  }
}

async function fireExpenseSync(result: any, operation: 'upsert' | 'delete') {
  if (!result?.id) return
  try {
    const { queueExpenseSync } = await import('./offline-sync')
    await queueExpenseSync(result, operation)
  } catch (err: any) {
    console.error('[OfflineSync] expense enqueue failed:', err?.message || err)
  }
}

async function setupPragmas(client: PrismaClient) {
  try {
    await client.$executeRaw`PRAGMA busy_timeout = 10000`     // 10s wait on lock instead of immediate fail
    await client.$executeRaw`PRAGMA synchronous = NORMAL`
    await client.$executeRaw`PRAGMA cache_size = -65536`      // 64MB cache
    await client.$executeRaw`PRAGMA temp_store = MEMORY`
    await client.$executeRaw`PRAGMA mmap_size = 268435456`    // 256MB mmap
    await client.$executeRaw`PRAGMA journal_mode = WAL`
    await client.$executeRaw`PRAGMA wal_autocheckpoint = 100` // checkpoint every 100 pages (was 200)
  } catch {
    // PRAGMAs are non-fatal performance optimizations
  }
}

async function gracefulShutdown(client: PrismaClient) {
  try {
    // Force WAL checkpoint before disconnect - prevents corruption on next startup
    await client.$executeRaw`PRAGMA wal_checkpoint(FULL)`
  } catch { /* ignore */ }
  try {
    await client.$disconnect()
  } catch { /* ignore */ }
}

function createPrismaClient() {
  const client = new PrismaClient()

  client.$connect().then(() => setupPragmas(client)).catch(() => {})

  // Checkpoint WAL on process exit to prevent corruption
  const shutdown = () => gracefulShutdown(client).finally(() => process.exit(0))
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  process.once('beforeExit', () => gracefulShutdown(client))

  // Hook receipt/expense mutations into the offline-sync queue.
  // Runs after each successful query; queueXxxSync() is a no-op when offline mode is off.
  client.$use(async (params, next) => {
    const result = await next(params)

    if (params.model === 'Receipt') {
      if (params.action === 'create' || params.action === 'update' || params.action === 'upsert') {
        void fireReceiptSync(result, 'upsert')
      } else if (params.action === 'delete') {
        void fireReceiptSync(result, 'delete')
      }
    } else if (params.model === 'Expense') {
      if (params.action === 'create' || params.action === 'update' || params.action === 'upsert') {
        void fireExpenseSync(result, 'upsert')
      } else if (params.action === 'delete') {
        void fireExpenseSync(result, 'delete')
      }
    }

    return result
  })

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
