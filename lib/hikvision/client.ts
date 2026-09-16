/**
 * عميل ISAPI لأجهزة Hikvision للتحكم في الدخول.
 *
 * الجهاز بيتكلم JSON لإدارة المستخدمين و XML للتحكم في الباب — الاتنين
 * في نفس الـ API. وبيطلب مصادقة Digest (شوف ./digest).
 *
 * ⚠️ TLS: الجهاز على الشبكة المحلية بشهادة ذاتية، فالتحقق بيتعطّل — **لكن
 * للطلبات دي بس**. ممنوع منعاً باتاً NODE_TLS_REJECT_UNAUTHORIZED=0 العام
 * لأنه هيعطّل التحقق للتحديث التلقائي من GitHub وللتانل كمان.
 */

import http from 'http'
import https from 'https'
import { parseChallenge, buildAuthHeader } from './digest'

export interface GateConnection {
  host: string
  port: number
  useHttps: boolean
  username: string
  password: string
  doorNo: number
  planTemplateNo: string
}

export type HikvisionErrorCode = 'auth' | 'offline' | 'timeout' | 'device' | 'unknown'

export class HikvisionError extends Error {
  status?: number
  body?: string
  /** كود مختصر للواجهة تترجمه لرسالة عربية مفيدة */
  code: HikvisionErrorCode

  constructor(message: string, status?: number, body?: string, code: HikvisionErrorCode = 'unknown') {
    super(message)
    this.name = 'HikvisionError'
    this.status = status
    this.body = body
    this.code = code
  }
}

interface RawResponse {
  status: number
  headers: http.IncomingHttpHeaders
  body: string
}

const DEFAULT_TIMEOUT_MS = 10_000

/** طلب واحد من غير أي منطق مصادقة. */
function rawRequest(
  conn: GateConnection,
  method: string,
  path: string,
  body?: string,
  authHeader?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const mod = conn.useHttps ? https : http
    const req = mod.request(
      {
        host: conn.host,
        port: conn.port,
        path,
        method,
        headers: {
          'Content-Type': body?.trimStart().startsWith('<') ? 'application/xml' : 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        // شهادة ذاتية على الشبكة المحلية — مقصور على الطلب ده
        ...(conn.useHttps ? { rejectUnauthorized: false } : {}),
        timeout: timeoutMs,
      },
      res => {
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        )
      }
    )

    req.on('timeout', () => {
      req.destroy()
      reject(new HikvisionError(`الجهاز ما ردّش خلال ${timeoutMs / 1000} ثانية`, undefined, undefined, 'timeout'))
    })
    req.on('error', (e: NodeJS.ErrnoException) => {
      const offline = ['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT', 'ENOTFOUND'].includes(e.code ?? '')
      reject(new HikvisionError(e.message, undefined, undefined, offline ? 'offline' : 'unknown'))
    })

    if (body) req.write(body)
    req.end()
  })
}

/**
 * طلب بمصادقة Digest: بنجرّب، وعلى 401 بنحسب الرد ونعيد مرة واحدة.
 * الجهاز بيدّي nonce جديد في كل 401، فمفيش فايدة من أكتر من إعادة.
 */
async function request(
  conn: GateConnection,
  method: string,
  path: string,
  body?: string,
  timeoutMs?: number
): Promise<RawResponse> {
  const first = await rawRequest(conn, method, path, body, undefined, timeoutMs)
  if (first.status !== 401) return first

  const challenge = parseChallenge(
    (first.headers['www-authenticate'] as string | undefined) ?? null
  )
  if (!challenge) {
    throw new HikvisionError('الجهاز طلب مصادقة بصيغة مش مفهومة', 401, first.body, 'auth')
  }

  const auth = buildAuthHeader({
    username: conn.username,
    password: conn.password,
    method,
    uri: path,
    challenge,
  })
  const second = await rawRequest(conn, method, path, body, auth, timeoutMs)

  if (second.status === 401) {
    throw new HikvisionError('اسم المستخدم أو كلمة السر غلط', 401, second.body, 'auth')
  }
  return second
}

/** الجهاز بيرجّع أخطاءه في JSON أو XML — بنطلّع منها رسالة مفيدة. */
function describeFailure(res: RawResponse): string {
  const b = res.body ?? ''
  try {
    const j = JSON.parse(b)
    const sub = j.subStatusCode || j.statusString
    if (sub) return `${sub}${j.errorMsg ? ` — ${j.errorMsg}` : ''}`
  } catch {
    const sub = /<subStatusCode>([^<]+)</i.exec(b)?.[1]
    const str = /<statusString>([^<]+)</i.exec(b)?.[1]
    if (sub || str) return [str, sub].filter(Boolean).join(' — ')
  }
  return `HTTP ${res.status}`
}

/** بيعتبر الرد ناجح لو 2xx **و** الجسم مش فيه فشل معلن. */
function assertOk(res: RawResponse, what: string): void {
  if (res.status < 200 || res.status >= 300) {
    throw new HikvisionError(`${what}: ${describeFailure(res)}`, res.status, res.body, 'device')
  }
  // Hikvision بيرجّع 200 مع statusCode != 1 في بعض الأخطاء
  const failed =
    /"statusCode"\s*:\s*(?!1\b)\d+/.test(res.body) ||
    /<statusCode>(?!1<)\d+<\/statusCode>/.test(res.body)
  if (failed) {
    throw new HikvisionError(`${what}: ${describeFailure(res)}`, res.status, res.body, 'device')
  }
}

// ═══════════════════════════════════════════════════ العمليات

/** حمولة مستخدم — نفس الشكل للإضافة والتعديل. */
function userPayload(conn: GateConnection, u: {
  employeeNo: string
  name: string
  beginTime: string
  endTime: string
  enabled: boolean
}) {
  return JSON.stringify({
    UserInfo: {
      employeeNo: u.employeeNo,
      name: u.name,
      userType: 'normal',
      Valid: {
        enable: u.enabled,
        beginTime: u.beginTime,
        endTime: u.endTime,
      },
      doorRight: String(conn.doorNo),
      RightPlan: [{ doorNo: conn.doorNo, planTemplateNo: conn.planTemplateNo }],
    },
  })
}

/** فحص اتصال — بيرجّع اسم الموديل لو رد. */
export async function ping(conn: GateConnection): Promise<{ model?: string; firmware?: string }> {
  const res = await request(conn, 'GET', '/ISAPI/System/deviceInfo', undefined, 6000)
  assertOk(res, 'فحص الجهاز')
  return {
    model: /<model>([^<]+)</i.exec(res.body)?.[1],
    firmware: /<firmwareVersion>([^<]+)</i.exec(res.body)?.[1],
  }
}

export async function addUser(conn: GateConnection, u: Parameters<typeof userPayload>[1]): Promise<void> {
  const res = await request(conn, 'POST', '/ISAPI/AccessControl/UserInfo/Record?format=json', userPayload(conn, u))
  assertOk(res, `إضافة العضو ${u.employeeNo}`)
}

export async function modifyUser(conn: GateConnection, u: Parameters<typeof userPayload>[1]): Promise<void> {
  const res = await request(conn, 'PUT', '/ISAPI/AccessControl/UserInfo/Modify?format=json', userPayload(conn, u))
  assertOk(res, `تعديل العضو ${u.employeeNo}`)
}

export async function deleteUser(conn: GateConnection, employeeNo: string): Promise<void> {
  const res = await request(
    conn,
    'PUT',
    '/ISAPI/AccessControl/UserInfoDetail/Delete?format=json',
    JSON.stringify({
      UserInfoDetail: {
        mode: 'byEmployeeNo',
        EmployeeNoList: [{ employeeNo }],
      },
    })
  )
  assertOk(res, `مسح العضو ${employeeNo}`)
}

async function doorCommand(conn: GateConnection, cmd: 'open' | 'close'): Promise<void> {
  const xml =
    `<RemoteControlDoor version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">` +
    `<cmd>${cmd}</cmd></RemoteControlDoor>`
  const res = await request(conn, 'PUT', `/ISAPI/AccessControl/RemoteControl/door/${conn.doorNo}`, xml)
  assertOk(res, cmd === 'open' ? 'فتح الباب' : 'قفل الباب')
}

export const openDoor = (conn: GateConnection) => doorCommand(conn, 'open')
export const closeDoor = (conn: GateConnection) => doorCommand(conn, 'close')
