/**
 * 🖥️ الدعم الفني عن بُعد (RustDesk على سيرفر FitBoost)
 *
 * - بيتسطّب ويتظبط بزرار في الإعدادات، أو لوحده لما Control يطلب (مع فحص الرخصة).
 * - التسطيب محتاج صلاحية أدمن → ويندوز بيسأل «Yes» مرة واحدة على الجهاز.
 * - الباسورد الثابت بيتولّد هنا عشوائي، بيتحط في RustDesk، وبيتبعت لـ Control (بيتخزن متشفّر)
 *   — مش بيتحفظ على الجهاز ولا بيظهر لحد في الفرع.
 * - ويندوز بس (الأجهزة اللي على لينكس/سيرفر بتتجاهله).
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs'
import { randomBytes } from 'crypto'
import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import { resolveDbPath } from './dbPath'
import { gw, getDeviceToken } from './gateway'

const RUSTDESK_VERSION = '1.5.0'
// بصمة ملف التسطيب الرسمي من GitHub — لو الملف اتغيّر في السكة، التسطيب بيترفض
const RUSTDESK_SHA256 = '8555777215510D83D2D61C9DC984E4FCC838BD7E79F9D18A42585431F5E8BB47'
// سيرفر FitBoost (الـ VPS) + مفتاحه العام — بصيغة "config string" بتاعة RustDesk
const SERVER_CONFIG =
  '=0nI9kEaIdUOtJGTOZVdphWc0c2aJVTQ6tUdPFlczh0dzRma5VnWYplMyhnaPpmI6ISeltmIsIiI6ISawFmIsIyM54iNwEjL1MjLyYTMiojI5FGblJnIsIyM54iNwEjL1MjLyYTMiojI0N3boJye'
const SERVER_HOST = '162.35.106.93'
const AUTO_RETRY_MS = 6 * 3600_000 // لو اترفض/فشل، منسألش تاني قبل ٦ ساعات (عشان ميزعجش الفرع)

type State = { id?: string; configuredAt?: string; host?: string; lastAttemptAt?: string; lastError?: string | null }

export function remoteSupported() {
  return process.platform === 'win32'
}

function statePath() {
  return path.join(path.dirname(resolveDbPath()), 'remote-support.json')
}
function loadState(): State {
  try {
    return JSON.parse(readFileSync(statePath(), 'utf8'))
  } catch {
    return {}
  }
}
function saveState(patch: State) {
  const s = { ...loadState(), ...patch }
  try {
    writeFileSync(statePath(), JSON.stringify(s, null, 2))
  } catch {
    /* ignore */
  }
  return s
}

function rustdeskExe() {
  return path.join(process.env.ProgramFiles || 'C:\\Program Files', 'RustDesk', 'rustdesk.exe')
}

export function getRemoteStatus() {
  const s = loadState()
  return {
    supported: remoteSupported(),
    installed: remoteSupported() && existsSync(rustdeskExe()),
    configured: Boolean(s.id && s.host === SERVER_HOST),
    id: s.id ?? null,
    configuredAt: s.configuredAt ?? null,
    lastError: s.lastError ?? null,
    lastAttemptAt: s.lastAttemptAt ?? null,
  }
}

function newPassword() {
  // ١٦ حرف من غير الحروف اللي بتتلخبط (0/O, 1/l/I)
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const b = randomBytes(16)
  return Array.from(b, (x) => abc[x % abc.length]).join('')
}

/** سكربت PowerShell بيتشغّل بصلاحية أدمن: تسطيب + ظبط السيرفر + الباسورد + يكتب الـ ID */
function elevatedScript(pw: string, outFile: string) {
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`
  return `
$ErrorActionPreference = 'Stop'
$out = ${q(outFile)}
try {
  $exe = Join-Path $env:ProgramFiles 'RustDesk\\rustdesk.exe'
  if (-not (Test-Path $exe)) {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $tmp = Join-Path $env:TEMP 'rustdesk-${RUSTDESK_VERSION}.exe'
    Invoke-WebRequest -Uri 'https://github.com/rustdesk/rustdesk/releases/download/${RUSTDESK_VERSION}/rustdesk-${RUSTDESK_VERSION}-x86_64.exe' -OutFile $tmp -UseBasicParsing
    if ((Get-FileHash -Algorithm SHA256 -Path $tmp).Hash -ne '${RUSTDESK_SHA256}') { Remove-Item $tmp -Force; throw 'ملف التسطيب مش مطابق للنسخة الرسمية — اترفض' }
    Start-Process -FilePath $tmp -ArgumentList '--silent-install' -Wait
    $t = 0; while (-not (Test-Path $exe) -and $t -lt 90) { Start-Sleep 2; $t += 2 }
    if (-not (Test-Path $exe)) { throw 'التسطيب مخلصش' }
    Start-Sleep 6
  }
  & $exe --config ${q(SERVER_CONFIG)} | Out-Null
  Start-Sleep 2
  & $exe --password ${q(pw)} | Out-Null
  Start-Sleep 2
  & $exe --option verification-method use-permanent-password | Out-Null
  Start-Sleep 3
  $id = ''
  for ($i = 0; $i -lt 10 -and -not $id; $i++) { $id = (& $exe --get-id | Out-String).Trim(); if (-not $id) { Start-Sleep 2 } }
  if (-not $id) { throw 'مقدرتش أقرا رقم الجهاز' }
  Set-Content -Path $out -Value ('OK:' + $id) -Encoding UTF8
} catch {
  Set-Content -Path $out -Value ('ERR:' + $_.Exception.Message) -Encoding UTF8
}
`
}

function runElevated(scriptPath: string): Promise<{ declined: boolean; error?: string }> {
  return new Promise((resolve) => {
    const cmd =
      `try { Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden ` +
      `-ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"'; exit 0 } catch { exit 5 }`
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', cmd], {
      windowsHide: true,
    })
    const timer = setTimeout(() => {
      try { child.kill() } catch {}
      resolve({ declined: false, error: 'التسطيب خد وقت أكتر من اللازم' })
    }, 8 * 60_000)
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ declined: false, error: e.message })
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      resolve(code === 5 ? { declined: true } : { declined: false })
    })
  })
}

async function report(r: { ok: boolean; id?: string; password?: string; error?: string }) {
  try {
    if (await getDeviceToken()) await gw('remote-report', { body: r, timeoutMs: 15_000 })
  } catch (e: any) {
    console.error('remote-report:', e?.message || e)
  }
}

let running: Promise<ReturnType<typeof getRemoteStatus> & { ok: boolean; message: string }> | null = null

/** تسطيب/ظبط الدعم عن بُعد. لو شغال بالفعل بيرجّع نفس العملية. */
export function setupRemoteSupport(reason: 'manual' | 'control' = 'manual') {
  if (running) return running
  running = (async () => {
    if (!remoteSupported()) {
      return { ...getRemoteStatus(), ok: false, message: 'الدعم عن بُعد على أجهزة ويندوز بس' }
    }
    saveState({ lastAttemptAt: new Date().toISOString() })
    const dir = path.join(os.tmpdir(), 'fitboost-remote')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const stamp = `${process.pid}-${Date.now()}`
    const script = path.join(dir, `setup-${stamp}.ps1`)
    const out = path.join(dir, `result-${stamp}.txt`)
    const pw = newPassword()
    try {
      // BOM عشان PowerShell 5 يقرا العربي صح
      writeFileSync(script, '\ufeff' + elevatedScript(pw, out), 'utf8')
      console.log(`🖥️ تفعيل الدعم عن بُعد (${reason}) — هيظهر سؤال ويندوز`)
      const r = await runElevated(script)
      if (r.declined) {
        const msg = 'طلب صلاحية الأدمن اترفض أو اتقفل — دوس Yes في رسالة ويندوز'
        saveState({ lastError: msg })
        await report({ ok: false, error: msg })
        return { ...getRemoteStatus(), ok: false, message: msg }
      }
      const res = existsSync(out) ? readFileSync(out, 'utf8').replace(/^\ufeff/, '').trim() : ''
      if (res.startsWith('OK:')) {
        const id = res.slice(3).trim()
        saveState({ id, host: SERVER_HOST, configuredAt: new Date().toISOString(), lastError: null })
        await report({ ok: true, id, password: pw })
        return { ...getRemoteStatus(), ok: true, message: `الدعم عن بُعد اتفعّل — رقم الجهاز ${id}` }
      }
      const msg = res.startsWith('ERR:') ? res.slice(4).trim() : r.error || 'التسطيب فشل'
      saveState({ lastError: msg })
      await report({ ok: false, error: msg })
      return { ...getRemoteStatus(), ok: false, message: msg }
    } finally {
      for (const f of [script, out]) {
        try { unlinkSync(f) } catch {}
      }
    }
  })().finally(() => {
    running = null
  })
  return running
}

/**
 * من فحص الرخصة: Control طالب الدعم عن بُعد.
 * بيبدأ التسطيب لو مش متظبط — ومش أكتر من مرة كل ٦ ساعات لو اترفض/فشل.
 */
export function applyRemoteSupportRequest(want: boolean) {
  if (!want || !remoteSupported()) return
  const st = getRemoteStatus()
  if (st.configured && st.installed) return
  const last = st.lastAttemptAt ? new Date(st.lastAttemptAt).getTime() : 0
  if (Date.now() - last < AUTO_RETRY_MS) return
  setupRemoteSupport('control').catch(() => {})
}
