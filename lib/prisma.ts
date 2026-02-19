// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const client = new PrismaClient()

  // Set SQLite PRAGMAs after connection for better concurrent performance
  // These run once per process and survive hot reloads in dev
  client.$connect().then(async () => {
    try {
      // 5-second busy wait instead of immediate "database is locked" error
      await client.$executeRaw`PRAGMA busy_timeout = 5000`
      // Faster writes: fsync after every N pages instead of every write
      await client.$executeRaw`PRAGMA synchronous = NORMAL`
      // 64MB page cache in memory (reduces disk I/O significantly)
      await client.$executeRaw`PRAGMA cache_size = -65536`
      // Store temp tables and indices in memory
      await client.$executeRaw`PRAGMA temp_store = MEMORY`
      // 256MB memory-mapped I/O for faster sequential reads
      await client.$executeRaw`PRAGMA mmap_size = 268435456`
      // WAL mode: readers don't block writers and vice versa
      await client.$executeRaw`PRAGMA journal_mode = WAL`
      // WAL checkpoint: accumulate 200 pages before checkpointing
      await client.$executeRaw`PRAGMA wal_autocheckpoint = 200`
    } catch {
      // PRAGMAs are non-fatal performance optimizations — app works without them
    }
  }).catch(() => {
    // Connection errors are handled by the consuming routes
  })

  return client
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
