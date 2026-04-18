// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
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

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
