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
  /** الجسم الخام — محتاجينه للصور (التقاط الوش بيرجّع JPEG جوّه multipart) */
  raw: Buffer
}

export interface RequestOptions {
  timeoutMs?: number
  /** لو مش متحدد: XML لو الجسم بيبدأ بـ < وإلا JSON */
  contentType?: string
}

const DEFAULT_TIMEOUT_MS = 10_000

function defaultContentType(body?: string | Buffer): string {
  if (typeof body === 'string' && body.trimStart().startsWith('<')) return 'application/xml'
  return 'application/json'
}

/** طلب واحد من غير أي منطق مصادقة. الجسم ممكن يبقى نص أو Buffer (multipart). */
function rawRequest(
  conn: GateConnection,
  method: string,
  path: string,
  body?: string | Buffer,
  authHeader?: string,
  opts: RequestOptions = {}
): Promise<RawResponse> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  return new Promise((resolve, reject) => {
    const mod = conn.useHttps ? https : http
    const hasBody = body !== undefined && body.length > 0
    const req = mod.request(
      {
        host: conn.host,
        port: conn.port,
        path,
        method,
        headers: {
          ...(hasBody ? { 'Content-Type': opts.contentType ?? defaultContentType(body) } : {}),
          // Buffer.byteLength بيحسب البايتات صح للنص العربي وللـ Buffer الاتنين
          ...(hasBody ? { 'Content-Length': Buffer.byteLength(body as string | Buffer) } : {}),
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        // شهادة ذاتية على الشبكة المحلية — مقصور على الطلب ده
        ...(conn.useHttps ? { rejectUnauthorized: false } : {}),
        timeout: timeoutMs,
      },
      res => {
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks)
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: raw.toString('utf8'),
            raw,
          })
        })
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

    if (hasBody) req.write(body)
    req.end()
  })
}

function challengeOf(res: RawResponse) {
  return parseChallenge((res.headers['www-authenticate'] as string | undefined) ?? null)
}

function authFor(conn: GateConnection, method: string, path: string, res: RawResponse): string {
  const challenge = challengeOf(res)
  if (!challenge) {
    throw new HikvisionError('الجهاز طلب مصادقة بصيغة مش مفهومة', 401, res.body, 'auth')
  }
  return buildAuthHeader({ username: conn.username, password: conn.password, method, uri: path, challenge })
}

/**
 * طلب بمصادقة Digest: بنجرّب، وعلى 401 بنحسب الرد ونعيد مرة واحدة.
 * الجهاز بيدّي nonce جديد في كل 401، فمفيش فايدة من أكتر من إعادة.
 *
 * الجسم الكبير (Buffer — صورة الوش): مابنبعتهوش من غير مصادقة الأول، لأن
 * الجهاز بيرد 401 وبيقفل الاتصال قبل ما يقرا الصورة (EPIPE/ECONNRESET).
 * بدل كده بناخد التحدي من GET خفيف، ونبعت الصورة مرة واحدة بالمصادقة —
 * ولو الـ nonce اتغيّر (401 تاني) بنعيد بالتحدي الجديد مرة واحدة.
 */
async function request(
  conn: GateConnection,
  method: string,
  path: string,
  body?: string | Buffer,
  timeoutOrOpts?: number | RequestOptions
): Promise<RawResponse> {
  const opts: RequestOptions =
    typeof timeoutOrOpts === 'number' ? { timeoutMs: timeoutOrOpts } : timeoutOrOpts ?? {}

  let first: RawResponse
  if (Buffer.isBuffer(body)) {
    const probe = await rawRequest(conn, 'GET', '/ISAPI/System/deviceInfo', undefined, undefined, { timeoutMs: 6000 })
    const preAuth = probe.status === 401 ? authFor(conn, method, path, probe) : undefined
    first = await rawRequest(conn, method, path, body, preAuth, opts)
  } else {
    first = await rawRequest(conn, method, path, body, undefined, opts)
  }
  if (first.status !== 401) return first

  const second = await rawRequest(conn, method, path, body, authFor(conn, method, path, first), opts)

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

// ═══════════════════════════════════════════════════ صور الوش (FDLib)
//
//  الصيغة متجرّبة على الجهاز من Postman:
//    POST /ISAPI/Intelligent/FDLib/FaceDataRecord?format=json   (multipart/form-data)
//      FaceDataRecord = {"faceLibType":"blackFD","FDID":"1","FPID":"<employeeNo>"}
//      FaceImage      = الصورة JPEG
//  FPID = رقم العضوية (نفس employeeNo بتاع المستخدم) — كده الجهاز بيربط الوش بالعضو.
//  لازم المستخدم يكون متضاف الأول (addUser) وإلا الجهاز بيرفض.

export const DEFAULT_FDID = '1'
const FACE_LIB_TYPE = 'blackFD'
/** حدود Hikvision لصورة الوش */
export const FACE_MAX_BYTES = 200 * 1024

const CRLF = '\r\n'

/** بيبني جسم multipart/form-data بالإيد — مفيش FormData في Node 18 بيدّينا Buffer نقدر نوقّعه بالـ Digest. */
export function buildFaceMultipart(
  employeeNo: string,
  jpeg: Buffer,
  fdid: string = DEFAULT_FDID,
  boundary: string = '----FitBoostFace' + Date.now().toString(16) + Math.random().toString(16).slice(2, 10)
): { body: Buffer; contentType: string; boundary: string } {
  const record = JSON.stringify({ faceLibType: FACE_LIB_TYPE, FDID: String(fdid), FPID: String(employeeNo) })
  const head =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="FaceDataRecord"${CRLF}` +
    `Content-Type: text/plain${CRLF}${CRLF}` +
    record + CRLF +
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="FaceImage"; filename="face.jpg"${CRLF}` +
    `Content-Type: image/jpeg${CRLF}${CRLF}`
  const tail = `${CRLF}--${boundary}--${CRLF}`
  return {
    body: Buffer.concat([Buffer.from(head, 'utf8'), jpeg, Buffer.from(tail, 'utf8')]),
    contentType: `multipart/form-data; boundary=${boundary}`,
    boundary,
  }
}

export function isJpeg(buf: Buffer | null | undefined): boolean {
  return !!buf && buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
}

/** كود الخطأ الخام من رد الجهاز (subStatusCode / statusString / errorMsg) — للمطابقة. */
function rawFailure(res: RawResponse): string {
  const b = res.body ?? ''
  try {
    const j = JSON.parse(b)
    return [j.subStatusCode, j.statusString, j.errorMsg].filter(Boolean).join(' ')
  } catch {
    return [/<subStatusCode>([^<]+)</i.exec(b)?.[1], /<statusString>([^<]+)</i.exec(b)?.[1], /<errorMsg>([^<]+)</i.exec(b)?.[1]]
      .filter(Boolean).join(' ')
  }
}

function isFailure(res: RawResponse): boolean {
  if (res.status < 200 || res.status >= 300) return true
  return /"statusCode"\s*:\s*(?!1\b)\d+/.test(res.body) || /<statusCode>(?!1<)\d+<\/statusCode>/.test(res.body)
}

/** ترجمة أخطاء مكتبة الوشوش لرسالة فيها الحل. */
export function faceHint(detail: string): string {
  const d = detail || ''
  if (/AlreadyExist/i.test(d)) return 'الوش متسجّل قبل كده على الجهاز'
  if (/model|noFace|faceNotDetect|detect/i.test(d))
    return 'الجهاز مالقاش وش واضح في الصورة — صوّر تاني والوش في النص بإضاءة كويسة ومن غير نضارة شمس'
  if (/employeeNo|userNotExist|personNotExist|NotExist/i.test(d))
    return 'العضو نفسه مش متسجّل على الجهاز — اعمل «إعادة مزامنة» الأول'
  if (/full|capacity|exceed.*num|maxNum/i.test(d)) return 'ذاكرة الوشوش على الجهاز مليانة'
  if (/size|large|resolution|pic|image|format/i.test(d))
    return 'الجهاز رفض الصورة (الحجم أو المقاس) — لازم JPEG أصغر من 200KB'
  if (/FDID|faceLib|FDLib/i.test(d)) return 'مكتبة الوشوش على الجهاز (FDID) مش موجودة'
  if (/notSupport|invalidOperation|methodNotAllowed/i.test(d)) return 'الجهاز مابيدعمش العملية دي بالصيغة دي'
  return 'الجهاز رفض صورة الوش'
}

function faceError(what: string, res: RawResponse): HikvisionError {
  const raw = rawFailure(res) || `HTTP ${res.status}`
  return new HikvisionError(`${what}: ${faceHint(raw)} (${describeFailure(res)})`, res.status, res.body, 'device')
}

async function postFace(conn: GateConnection, method: 'POST' | 'PUT', path: string, employeeNo: string, jpeg: Buffer, fdid: string) {
  const mp = buildFaceMultipart(employeeNo, jpeg, fdid)
  return request(conn, method, path, mp.body, { contentType: mp.contentType, timeoutMs: 20_000 })
}

/** بيمسح وش العضو من مكتبة الوشوش. وش مش موجود أصلاً = نجاح. */
export async function deleteFace(conn: GateConnection, employeeNo: string, fdid: string = DEFAULT_FDID): Promise<void> {
  const res = await request(
    conn,
    'PUT',
    `/ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json&FDID=${encodeURIComponent(fdid)}&faceLibType=${FACE_LIB_TYPE}`,
    JSON.stringify({ FPID: [{ value: String(employeeNo) }] })
  )
  if (isFailure(res) && !/NotExist|noData|notFound/i.test(rawFailure(res))) {
    throw faceError(`مسح وش العضو ${employeeNo}`, res)
  }
}

/**
 * رفع وش العضو (إضافة أو استبدال).
 *   ١) POST FaceDataRecord — الطريقة اللي اتجرّبت في Postman
 *   ٢) لو الوش موجود: PUT FDSetUp (إضافة-أو-استبدال) بنفس الـ multipart
 *   ٣) لو FDSetUp مش مدعوم/فشل: نمسح الوش القديم ونعيد الـ POST
 */
export async function uploadFace(
  conn: GateConnection,
  employeeNo: string,
  jpeg: Buffer,
  fdid: string = DEFAULT_FDID
): Promise<void> {
  if (!isJpeg(jpeg)) throw new HikvisionError('صورة الوش لازم تبقى JPEG', undefined, undefined, 'device')
  if (jpeg.length > FACE_MAX_BYTES) {
    throw new HikvisionError(
      `صورة الوش ${Math.round(jpeg.length / 1024)}KB — الجهاز بياخد لحد 200KB. صوّر العضو تاني من السيستم`,
      undefined, undefined, 'device'
    )
  }
  const what = `رفع وش العضو ${employeeNo}`

  const res = await postFace(conn, 'POST', '/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json', employeeNo, jpeg, fdid)
  if (!isFailure(res)) return
  if (!/AlreadyExist|exist/i.test(rawFailure(res)) || /NotExist/i.test(rawFailure(res))) throw faceError(what, res)

  //  الوش موجود → استبدال
  const setup = await postFace(conn, 'PUT', '/ISAPI/Intelligent/FDLib/FDSetUp?format=json', employeeNo, jpeg, fdid)
  if (!isFailure(setup)) return

  await deleteFace(conn, employeeNo, fdid)
  const again = await postFace(conn, 'POST', '/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json', employeeNo, jpeg, fdid)
  if (isFailure(again)) throw faceError(what, again)
}

// ─────────────────────────────── التقاط وش من كاميرا الجهاز

export interface MultipartPart {
  headers: Record<string, string>
  body: Buffer
}

/** بيفك multipart/mixed أو form-data من Buffer (الرد بتاع CaptureFaceData). */
export function parseMultipart(raw: Buffer, contentType: string | undefined): MultipartPart[] {
  const m = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType ?? '')
  let boundary = m ? (m[1] ?? m[2]) : ''
  if (!boundary) {
    //  بعض الأجهزة مابتبعتش الـ boundary في الهيدر — ناخده من أول سطر
    const firstLine = /^\s*--([^\r\n]+)\r?\n/.exec(raw.subarray(0, 200).toString('latin1'))
    if (!firstLine) return []
    boundary = firstLine[1]
  }
  const delim = Buffer.from('--' + boundary, 'latin1')
  const parts: MultipartPart[] = []
  let pos = raw.indexOf(delim)
  while (pos !== -1) {
    let start = pos + delim.length
    if (raw[start] === 0x2d && raw[start + 1] === 0x2d) break // --boundary-- النهاية
    if (raw[start] === 0x0d) start++
    if (raw[start] === 0x0a) start++
    const next = raw.indexOf(delim, start)
    let chunk = raw.subarray(start, next === -1 ? raw.length : next)
    //  CRLF اللي قبل الـ boundary اللي بعده تبع الفاصل مش الجسم
    if (chunk.length >= 2 && chunk[chunk.length - 2] === 0x0d && chunk[chunk.length - 1] === 0x0a) chunk = chunk.subarray(0, chunk.length - 2)
    else if (chunk.length >= 1 && chunk[chunk.length - 1] === 0x0a) chunk = chunk.subarray(0, chunk.length - 1)
    let sep = chunk.indexOf('\r\n\r\n')
    let sepLen = 4
    if (sep === -1) { sep = chunk.indexOf('\n\n'); sepLen = 2 }
    const headers: Record<string, string> = {}
    let body = chunk
    if (sep !== -1) {
      for (const line of chunk.subarray(0, sep).toString('latin1').split(/\r?\n/)) {
        const i = line.indexOf(':')
        if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim()
      }
      body = chunk.subarray(sep + sepLen)
    }
    parts.push({ headers, body })
    pos = next
  }
  return parts
}

/** بيطلّع الـ JPEG من رد الالتقاط مهما كان شكله، أو faceDataUrl لو الجهاز رجّع لينك. */
export function extractCapturedFace(raw: Buffer, contentType: string | undefined): { jpeg?: Buffer; url?: string; text: string } {
  if (isJpeg(raw)) return { jpeg: raw, text: '' }
  let text = ''
  if (/multipart/i.test(contentType ?? '') || /^\s*--/.test(raw.subarray(0, 4).toString('latin1'))) {
    const parts = parseMultipart(raw, contentType)
    for (const p of parts) {
      if (/image\//i.test(p.headers['content-type'] ?? '') || isJpeg(p.body)) {
        if (isJpeg(p.body)) return { jpeg: p.body, text }
      } else {
        text += p.body.toString('utf8')
      }
    }
  } else {
    text = raw.toString('utf8')
  }
  const url = /<faceDataUrl>\s*([^<\s]+)\s*</i.exec(text)?.[1] ?? /"faceDataUrl"\s*:\s*"([^"]+)"/i.exec(text)?.[1]
  return { url, text }
}

/** المسار بس من faceDataUrl (ممكن ييجي لينك كامل بـ IP داخلي) — بنطلبه من نفس الاتصال. */
function urlPath(u: string): string {
  try {
    const parsed = new URL(u, 'http://device.local')
    return parsed.pathname + parsed.search
  } catch {
    return u.startsWith('/') ? u : '/' + u
  }
}

/**
 * يشغّل كاميرا الجهاز ويستنى العضو يبص لها ويرجّع صورة الوش JPEG.
 * الجهاز بيرجّع يا multipart (XML + JPEG) يا XML فيه faceDataUrl — بنتعامل مع الاتنين،
 * ولو رجّع إن الالتقاط لسه شغّال بنسأل Progress لحد ٣٠ ثانية.
 */
export async function captureFace(conn: GateConnection, timeoutMs = 30_000): Promise<Buffer> {
  const deadline = Date.now() + timeoutMs
  const xml =
    `<CaptureFaceDataCond version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">` +
    `<captureInfrared>false</captureInfrared><dataType>binary</dataType></CaptureFaceDataCond>`
  const res = await request(conn, 'POST', '/ISAPI/AccessControl/CaptureFaceData', xml, {
    timeoutMs: timeoutMs + 5000,
    contentType: 'application/xml',
  })
  if (res.status < 200 || res.status >= 300) {
    throw new HikvisionError(`التقاط الوش: ${faceHint(rawFailure(res))} (${describeFailure(res)})`, res.status, res.body, 'device')
  }

  const fetchUrl = async (u: string): Promise<Buffer> => {
    const img = await request(conn, 'GET', urlPath(u), undefined, 15_000)
    if (img.status >= 200 && img.status < 300) {
      const got = extractCapturedFace(img.raw, img.headers['content-type'] as string | undefined)
      if (got.jpeg) return got.jpeg
    }
    throw new HikvisionError('الجهاز صوّر بس مقدرتش أنزّل الصورة منه', img.status, img.body.slice(0, 500), 'device')
  }

  let got = extractCapturedFace(res.raw, res.headers['content-type'] as string | undefined)
  if (got.jpeg) return got.jpeg
  if (got.url) return fetchUrl(got.url)

  //  بعض الفيرموير بيرجّع captureProgress < 100 فورًا — نسأل عن التقدّم
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000))
    const p = await request(conn, 'GET', '/ISAPI/AccessControl/CaptureFaceData/Progress', undefined, 8000).catch(() => null)
    if (!p || p.status === 404) break
    got = extractCapturedFace(p.raw, p.headers['content-type'] as string | undefined)
    if (got.jpeg) return got.jpeg
    if (got.url) return fetchUrl(got.url)
  }

  const detail = (got.text || res.body || '').replace(/\s+/g, ' ').slice(0, 300)
  throw new HikvisionError(
    'الجهاز ما صوّرش وش — اتأكد إن العضو واقف قدام الكاميرا وبيبص لها، وجرّب تاني' + (detail ? ` (${detail})` : ''),
    res.status, res.body.slice(0, 1000), 'timeout'
  )
}
