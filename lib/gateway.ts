// lib/gateway.ts
// كل تواصل السيستم مع سحابة فيت بوست بيعدّي من هنا — عن طريق Control (FITBOOST_GATEWAY_URL)
// بتوكن خاص بالفرع ده بس. مفيش أي مفتاح Supabase على جهاز الجيم.

import os from 'os'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { resolveDbDir } from './dbPath'
import { prisma } from './prisma'
import pkg from '../package.json'

export class GatewayError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function gatewayUrl(): string | null {
  const u = (process.env.FITBOOST_GATEWAY_URL || '').trim().replace(/\/$/, '')
  return u || null
}

export const APP_VERSION: string = (pkg as { version?: string }).version || 'unknown'

export function deviceLabel(): string {
  try {
    return `${os.hostname()}`.slice(0, 60)
  } catch {
    return 'gym-device'
  }
}

export async function getLicenseRow() {
  return prisma.supabaseLicense.findFirst({ orderBy: { lastChecked: 'desc' } })
}

export async function getDeviceToken(): Promise<string | null> {
  const row = await getLicenseRow()
  return (row as { gatewayToken?: string | null } | null)?.gatewayToken || null
}

type CallOpts = {
  method?: string
  body?: unknown
  timeoutMs?: number
  /** من غير توكن (activate / claim) */
  anonymous?: boolean
}

/** نداء للـ gateway. بيرمي GatewayError (status 0 = مفيش نت/مفيش إعداد). */
export async function gw<T = any>(path: string, opts: CallOpts = {}): Promise<T> {
  const base = gatewayUrl()
  if (!base) throw new GatewayError('FITBOOST_GATEWAY_URL مش متظبط', 0, 'NO_GATEWAY')

  const headers: Record<string, string> = { 'x-app-version': APP_VERSION }
  if (!opts.anonymous) {
    const token = await getDeviceToken()
    if (!token) throw new GatewayError('الجهاز مش مربوط — فعّله بكود التفعيل من الإعدادات ← الترخيص', 401, 'NO_TOKEN')
    headers.Authorization = `Bearer ${token}`
  }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000)
  let res: Response
  try {
    res = await fetch(`${base}/api/gym/v1/${path.replace(/^\//, '')}`, {
      method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    })
  } catch (e: any) {
    throw new GatewayError(e?.name === 'AbortError' ? 'timeout' : `network: ${e?.message || e}`, 0, 'NETWORK')
  } finally {
    clearTimeout(timer)
  }

  const data: any = await res.json().catch(() => ({}))
  if (!res.ok) throw new GatewayError(data?.error || `HTTP ${res.status}`, res.status, data?.code)
  return data as T
}

export type LinkResult = {
  token: string
  gymId: string
  gymName: string
  branchId: string
  branchName: string
  systemLicense: string
  offlineModeEnabled: boolean
}

/** يحفظ ربط الجهاز (بعد activate / claim) مكان الرخصة القديمة */
export async function saveLink(link: LinkResult) {
  await prisma.supabaseLicense.deleteMany({})
  return prisma.supabaseLicense.create({
    data: {
      gymId: link.gymId,
      gymName: link.gymName,
      branchId: link.branchId,
      branchName: link.branchName,
      systemLicense: String(link.systemLicense ?? 'false'),
      offlineModeEnabled: link.offlineModeEnabled === true,
      gatewayToken: link.token,
      lastChecked: new Date(),
    } as any,
  })
}

export async function activateWithCode(code: string) {
  const link = await gw<LinkResult>('activate', {
    anonymous: true,
    body: { code, label: deviceLabel(), appVersion: APP_VERSION },
  })
  const saved = await saveLink(link)
  import('./cloudBackup').then((m) => m.reportCloudBackupState()).catch(() => {})
  return saved
}

// ---- هوية التسطيب ----
// كل تسطيب ليه رقم + سر ثابتين (ملف 0600 في مجلد الأسرار، مش في الداتابيز عشان
// ميتنسخش مع الباك أب لجهاز تاني). بيهم الجهاز بيظهر في Control ويستنى الربط.

type Install = { id: string; secret: string }
let installCache: Install | null = null

function secretDir(): string {
  return process.env.FITBOOST_SECRET_DIR || resolveDbDir()
}

export function getInstall(): Install {
  if (installCache) return installCache
  const file = path.join(secretDir(), '.gateway-install')
  try {
    const j = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (typeof j?.id === 'string' && typeof j?.secret === 'string' && j.secret.length >= 32) {
      installCache = j
      return j
    }
  } catch {
    // مش موجود — هنعمله
  }
  const created: Install = { id: crypto.randomUUID(), secret: crypto.randomBytes(32).toString('base64url') }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(created), { mode: 0o600 })
  installCache = created
  return created
}

/** الرقم اللي بيظهر في Control جنب الجهاز (أول ٨ حروف) */
export function installShortId(): string {
  try {
    return getInstall().id.slice(0, 8).toUpperCase()
  } catch {
    return '—'
  }
}

export type LinkStatus = 'linked' | 'pending' | 'rejected' | 'offline' | 'unknown'
let lastStatus: { status: LinkStatus; at: number } = { status: 'unknown', at: 0 }
export const getLinkStatus = () => lastStatus

let lastHello = 0
let helloInFlight: Promise<boolean> | null = null
const HELLO_EVERY_MS = 2 * 60 * 1000

/**
 * لو الجهاز مش مربوط: بيعرّف نفسه لـ Control (بيظهر هناك "مستني")،
 * ولو اتوافق عليه بياخد التوكن ويحفظه. بيرجّع true لو الجهاز مربوط.
 */
export async function ensureLinked(force = false): Promise<boolean> {
  const row = await getLicenseRow()
  if ((row as { gatewayToken?: string | null } | null)?.gatewayToken) {
    lastStatus = { status: 'linked', at: Date.now() }
    return true
  }
  if (!gatewayUrl()) return false
  if (!force && Date.now() - lastHello < HELLO_EVERY_MS) return false
  if (helloInFlight) return helloInFlight

  helloInFlight = (async () => {
    lastHello = Date.now()
    try {
      const inst = getInstall()
      const res = await gw<{ status: LinkStatus; link?: LinkResult }>('hello', {
        anonymous: true,
        timeoutMs: 8000,
        body: {
          installId: inst.id,
          installSecret: inst.secret,
          label: deviceLabel(),
          appVersion: APP_VERSION,
          gymId: row?.gymId,
          branchId: row?.branchId,
          gymName: row?.gymName,
          branchName: row?.branchName,
        },
      })
      if (res.status === 'linked' && res.link?.token) {
        await saveLink(res.link)
        lastStatus = { status: 'linked', at: Date.now() }
        // Control يعرف آخر باك أب اتعمل قبل الربط
        import('./cloudBackup').then((m) => m.reportCloudBackupState()).catch(() => {})
        console.log('[gateway] الجهاز اتربط من Control')
        return true
      }
      lastStatus = { status: res.status === 'rejected' ? 'rejected' : 'pending', at: Date.now() }
      return false
    } catch (e) {
      lastStatus = { status: e instanceof GatewayError && e.status === 0 ? 'offline' : 'unknown', at: Date.now() }
      return false
    } finally {
      helloInFlight = null
    }
  })()
  return helloInFlight
}

/** بيبلّغ Control بنتيجة الباك أب السحابي — مبيوقفش أي حاجة لو فشل */
export function reportBackup(r: { kind: 'db' | 'photos'; ok?: boolean; size?: number; error?: string; disabled?: boolean; at?: string }) {
  getDeviceToken()
    .then((t) => (t ? gw('backup-report', { body: r, timeoutMs: 8000 }) : null))
    .catch(() => {})
}

/** يحوّل خطأ الـ gateway لرد مفهوم لواجهة السيستم */
export function gatewayErrorResponse(e: unknown) {
  const { NextResponse } = require('next/server') as typeof import('next/server')
  if (e instanceof GatewayError) {
    if (e.status === 0) {
      return NextResponse.json({ error: 'مفيش اتصال بسحابة فيت بوست — اتأكد من النت', code: 'OFFLINE' }, { status: 503 })
    }
    if (e.status === 401) {
      return NextResponse.json({ error: e.message, code: e.code || 'NOT_LINKED' }, { status: 409 })
    }
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status >= 500 ? 502 : e.status })
  }
  return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
}
