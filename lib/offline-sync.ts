import { prisma } from './prisma'
import { supabaseAdmin } from './supabase'

type ReceiptSnapshot = {
  id: string
  receiptNumber: number
  type: string
  amount: number
  paymentMethod: string | null
  isCancelled: boolean
  cancelledAt: Date | null
  createdAt: Date
}

type ExpenseSnapshot = {
  id: string
  type: string
  amount: number
  description: string | null
  isPaid: boolean
  createdAt: Date
}

async function getActiveLicense() {
  return prisma.supabaseLicense.findFirst({
    orderBy: { lastChecked: 'desc' }
  })
}

// Cached state to avoid hitting the DB on every write
type CachedState = {
  enabled: boolean
  gymId: string | null
  branchId: string | null
  fetchedAt: number
}
let cached: CachedState | null = null
const CACHE_TTL_MS = 30_000

async function refreshCache(): Promise<CachedState> {
  const license = await getActiveLicense()
  cached = {
    enabled: Boolean(license?.offlineModeEnabled && license?.gymId && license?.branchId),
    gymId: license?.gymId ?? null,
    branchId: license?.branchId ?? null,
    fetchedAt: Date.now()
  }
  return cached
}

async function getCachedState(): Promise<CachedState> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached
  return refreshCache()
}

export function invalidateOfflineSyncCache() {
  cached = null
}

export async function isOfflineSyncEnabled(): Promise<boolean> {
  return (await getCachedState()).enabled
}

async function enqueue(
  resource: 'receipt' | 'expense',
  operation: 'upsert' | 'delete',
  resourceId: string,
  payload: Record<string, unknown>
) {
  await prisma.syncQueueItem.create({
    data: {
      resource,
      operation,
      resourceId,
      payload: JSON.stringify(payload)
    }
  })
}

export async function queueReceiptSync(
  receipt: ReceiptSnapshot,
  operation: 'upsert' | 'delete' = 'upsert'
) {
  const state = await getCachedState()
  if (!state.enabled || !state.gymId || !state.branchId) return

  const payload = {
    local_id: receipt.id,
    branch_id: state.branchId,
    gym_id: state.gymId,
    receipt_number: receipt.receiptNumber,
    type: receipt.type,
    amount: Number(receipt.amount),
    payment_method: receipt.paymentMethod,
    is_cancelled: receipt.isCancelled,
    cancelled_at: receipt.cancelledAt ? new Date(receipt.cancelledAt).toISOString() : null,
    local_created_at: new Date(receipt.createdAt).toISOString(),
    updated_at: new Date().toISOString()
  }

  await enqueue('receipt', operation, receipt.id, payload)
  void processSyncQueue().catch(() => {})
}

export async function queueExpenseSync(
  expense: ExpenseSnapshot,
  operation: 'upsert' | 'delete' = 'upsert'
) {
  const state = await getCachedState()
  if (!state.enabled || !state.gymId || !state.branchId) return

  const payload = {
    local_id: expense.id,
    branch_id: state.branchId,
    gym_id: state.gymId,
    type: expense.type,
    amount: Number(expense.amount),
    description: expense.description,
    is_paid: expense.isPaid,
    local_created_at: new Date(expense.createdAt).toISOString(),
    updated_at: new Date().toISOString()
  }

  await enqueue('expense', operation, expense.id, payload)
  void processSyncQueue().catch(() => {})
}

let isProcessing = false

export async function processSyncQueue(limit = 50): Promise<{ sent: number; failed: number }> {
  if (isProcessing) return { sent: 0, failed: 0 }
  isProcessing = true

  let sent = 0
  let failed = 0

  try {
    // لو المزامنة السحابية مقفولة مفيش داعي نسأل الـ DB كل دقيقة
    // (getCachedState متكيّشة في الذاكرة فالفحص شبه مجاني)
    const state = await getCachedState()
    if (!state.enabled) return { sent: 0, failed: 0 }

    const items = await prisma.syncQueueItem.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit
    })

    for (const item of items) {
      try {
        const payload = JSON.parse(item.payload)
        const tableName = item.resource === 'receipt' ? 'gym_receipts' : 'gym_expenses'

        if (item.operation === 'delete') {
          const { error } = await supabaseAdmin
            .from(tableName)
            .delete()
            .eq('local_id', item.resourceId)
            .eq('branch_id', payload.branch_id)
          if (error) throw error
        } else {
          const { error } = await supabaseAdmin
            .from(tableName)
            .upsert(payload, { onConflict: 'branch_id,local_id' })
          if (error) throw error
        }

        await prisma.syncQueueItem.update({
          where: { id: item.id },
          data: { status: 'sent', sentAt: new Date() }
        })
        sent++
      } catch (err: any) {
        const attempts = item.attempts + 1
        const message = err?.message || String(err)
        await prisma.syncQueueItem.update({
          where: { id: item.id },
          data: {
            attempts,
            lastError: message.slice(0, 500),
            // After 10 attempts, mark as failed so we stop retrying it forever
            status: attempts >= 10 ? 'failed' : 'pending'
          }
        })
        failed++
      }
    }
  } finally {
    isProcessing = false
  }

  return { sent, failed }
}

export async function getSyncQueueStats() {
  const [pending, failed, sent] = await Promise.all([
    prisma.syncQueueItem.count({ where: { status: 'pending' } }),
    prisma.syncQueueItem.count({ where: { status: 'failed' } }),
    prisma.syncQueueItem.count({ where: { status: 'sent' } })
  ])

  const lastSent = await prisma.syncQueueItem.findFirst({
    where: { status: 'sent' },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true }
  })

  // Surface the most recent error from any non-sent item so the user
  // can see WHY items are stuck (table missing, RLS, network, etc.)
  const stuck = await prisma.syncQueueItem.findFirst({
    where: { status: { in: ['pending', 'failed'] }, lastError: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { lastError: true, attempts: true, resource: true, createdAt: true }
  })

  return {
    pending,
    failed,
    sent,
    lastSentAt: lastSent?.sentAt || null,
    lastError: stuck?.lastError || null,
    lastErrorResource: stuck?.resource || null,
    lastErrorAttempts: stuck?.attempts || 0
  }
}
