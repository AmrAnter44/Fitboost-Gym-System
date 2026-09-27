// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 🚪 مزامنة العضو مع أجهزة البوابات بعد أي تعديل عليه.
//
//    بنعلّقها هنا مش في مسارات الـ API لأن في ~٢٢ مكان بيعدّلوا الـ Member،
//    وتلاتة منهم مخفيين تمامًا: كنس الانتهاء جوّه GET /api/members، وخصم
//    رصيد الدخول في member-checkin، وإلغاء الإيصال. نقطة واحدة هنا بتمسكهم
//    كلهم بدل ما نلاحق كل مسار.
//
//    ده مسار السرعة بس — المُصالِح في instrumentation.ts هو ضمان الصحة،
//    وبيمسك كمان اللي بيعدّي من raw SQL (اللي مابيعدّيش من هنا أصلاً).
async function fireGateSync(memberId: string | undefined) {
  if (!memberId) return
  try {
    const { syncMemberInBackground } = await import('./gates/sync')
    syncMemberInBackground(memberId)
  } catch (err: any) {
    console.error('[gates] sync enqueue failed:', err?.message || err)
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

  // مزامنة العضو مع أجهزة البوابات بعد أي create/update/upsert.
  client.$use(async (params, next) => {
    const result = await next(params)

    if (params.model === 'Member') {
      // updateMany/deleteMany مابيرجّعوش صفوف، فبيتسابوا للمُصالِح
      if (params.action === 'create' || params.action === 'update' || params.action === 'upsert') {
        void fireGateSync(result?.id)
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
