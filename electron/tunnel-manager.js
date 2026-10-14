// ==========================================================================
// Cloudflare Tunnel manager — integrated into the main FitBoost app.
//
// Ported from the standalone "Fit Boost Server Management" portable app so the
// owner can run/manage the 24/7 Cloudflare tunnel from inside Settings → تانل
// instead of a separate app. Runs entirely in the Electron main process:
//   - spawns/keeps cloudflared alive (auto-restart with backoff)
//   - in-app login + tunnel creation (create + DNS route + config)
//   - keep-awake (powerSaveBlocker) and auto-launch with Windows
//   - pings the local Next server (port 4001) for health
//
// Config lives in userData (writable): userData/tunnel-config.json.
// State is pushed to the renderer via a `sender(channel, payload)` callback.
// ==========================================================================

const { app, powerSaveBlocker, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const http = require('http')
const crypto = require('crypto')
const { spawn } = require('child_process')

// ---------------------------------------------------------------- TunnelManager
// Owns the long-lived cloudflared child process + auto-restart.
const CONN_RE = /(?:^|[^a-z])registered tunnel connection|\bconnection\b[^\n]*?(?:^|[^a-z])registered\b/i
const TOKEN_ERR_RE = /(unauthorized|invalid.*(token|tunnel secret)|failed to (parse|unmarshal|read).*token|token is (invalid|empty)|error parsing tunnel id)/i
const CREDS_ERR_RE = /(credentials file .*(doesn't exist|not a file)|couldn't read|error reading config|error parsing (the )?config|tunnel .* not found)/i

class TunnelProcess {
  constructor(opts) {
    this.opts = opts
    this.child = null
    this.manualStop = false
    this.connections = 0
    this.restartTimer = null
    this.backoff = 2000
    this._stableTimer = null
  }
  isRunning() {
    return !!this.child
  }
  start() {
    this.manualStop = false
    this.connections = 0
    this._spawn()
  }
  _spawn() {
    const o = this.opts
    const env = { ...process.env }
    let args
    if (o.mode === 'demo') {
      args = ['--no-autoupdate', 'tunnel', '--url', 'http://localhost:' + (o.localPort || 4001)]
    } else if (o.mode === 'local') {
      args = ['--no-autoupdate', '--config', o.configPath, 'tunnel', 'run']
    } else {
      args = ['--no-autoupdate', 'tunnel', 'run']
      env.TUNNEL_TOKEN = o.token
    }

    let child
    try {
      child = spawn(o.binPath, args, { env, windowsHide: true })
    } catch (e) {
      this._emitError('Cannot launch cloudflared: ' + e.message)
      this._scheduleRestart()
      return
    }
    this.child = child
    if (o.onConnecting) o.onConnecting()

    const handle = (buf) => {
      buf
        .toString()
        .split(/\r?\n/)
        .forEach((line) => {
          if (!line.trim()) return
          if (o.onLog) o.onLog(line)
          const url = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)
          if (url && o.onUrl) o.onUrl(url[0])
          if (CONN_RE.test(line)) {
            this.connections = Math.min(4, this.connections + 1)
            if (o.onConnection) o.onConnection(this.connections)
          } else if (TOKEN_ERR_RE.test(line)) {
            this._emitError('Cloudflare رفض الاتصال — راجع الـ token.')
          } else if (CREDS_ERR_RE.test(line)) {
            this._emitError('مشكلة في ملف credentials أو الإعدادات — راجع tunnelId و credentialsFile.')
          }
        })
    }
    if (child.stdout) child.stdout.on('data', handle)
    if (child.stderr) child.stderr.on('data', handle)
    child.on('error', (e) => this._emitError('cloudflared error: ' + e.message))
    child.on('exit', (code, signal) => {
      this.child = null
      if (this._stableTimer) clearTimeout(this._stableTimer)
      const exitInfo = code == null ? signal : code
      if (this.manualStop) {
        this.backoff = 2000
        if (o.onExit) o.onExit(exitInfo, false)
      } else {
        if (o.onExit) o.onExit(exitInfo, true)
        this._scheduleRestart()
      }
    })
    this._stableTimer = setTimeout(() => {
      if (this.child === child) this.backoff = 2000
    }, 30000)
  }
  _scheduleRestart() {
    this.restartTimer = setTimeout(() => {
      this.connections = 0
      this._spawn()
    }, this.backoff)
    this.backoff = Math.min(Math.round(this.backoff * 1.5), 30000)
  }
  _emitError(msg) {
    if (this.opts.onError) this.opts.onError(msg)
  }
  stop() {
    this.manualStop = true
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null }
    if (this._stableTimer) { clearTimeout(this._stableTimer); this._stableTimer = null }
    if (this.child) { try { this.child.kill() } catch (e) { /* ignore */ } }
  }
}

// ---------------------------------------------------------------- module state
let manager = null
let config = null
let powerBlockerId = null
let healthTimer = null
let sender = null // (channel, payload) => void  — set by main.js
let loginRunning = false
let createRunning = false
// quick tunnel (trycloudflare) مؤقت — مش بيتحفظ في الإعدادات، وبيتلغي مع «إيقاف»
let quickMode = false
// الوضع اللي الـ cloudflared الحالي شغّال بيه (عشان التقارير ورابط الـ publicUrl)
let activeMode = 'none'

const state = {
  status: 'idle', // idle | starting | connecting | connected | error | stopped
  connections: 0,
  serverUp: false,
  publicUrl: '',
  message: '',
  restarts: 0,
  keepAwake: false,
  autoLaunch: false,
}

// ---------------------------------------------------------------- paths
function configPath() {
  return path.join(app.getPath('userData'), 'tunnel-config.json')
}
function tunnelDir() {
  const d = path.join(app.getPath('userData'), 'tunnel')
  try { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) } catch (e) { /* ignore */ }
  return d
}
function cloudflaredPath() {
  const bin = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
  if (app.isPackaged) return path.join(process.resourcesPath, bin)
  const candidates = [
    path.join(app.getAppPath(), 'resources', bin),
    path.join(process.cwd(), 'resources', bin),
    path.join(process.cwd(), 'tunell electron', 'resources', bin),
  ]
  for (const c of candidates) { if (fs.existsSync(c)) return c }
  return candidates[0]
}
function cfHome() {
  return path.join(os.homedir(), '.cloudflared')
}
function certPath() {
  return path.join(cfHome(), 'cert.pem')
}
function isLoggedIn() {
  return fs.existsSync(certPath())
}

// ---------------------------------------------------------------- config
function loadConfig() {
  const defaults = { token: '', tunnelId: '', credentialsFile: '', localPort: 4001, hostname: '', keepAwake: true, autoLaunch: false }
  let cfg = { ...defaults }
  try {
    cfg = { ...cfg, ...JSON.parse(fs.readFileSync(configPath(), 'utf8')) }
  } catch (e) { /* missing/invalid → defaults */ }
  if (process.env.TUNNEL_TOKEN) cfg.token = process.env.TUNNEL_TOKEN
  return cfg
}
function saveConfig(patch) {
  config = { ...(config || loadConfig()), ...patch }
  try {
    fs.writeFileSync(configPath(), JSON.stringify(config, null, 2) + '\n')
  } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------- mode / config.yml
function resolveCredsPath(p) {
  if (!p) return ''
  return path.isAbsolute(p) ? p : path.join(tunnelDir(), p)
}
function resolveMode() {
  if (!config) return 'none'
  if (config.token) return 'token'
  if (config.tunnelId && config.credentialsFile) return 'local'
  if (config.demo === true) return 'demo'
  return 'none'
}
function writeLocalConfigYml() {
  const creds = resolveCredsPath(config.credentialsFile)
  if (!fs.existsSync(creds)) throw new Error('ملف الـ credentials مش موجود: ' + creds)
  const port = config.localPort || 4001
  const yml = [
    'tunnel: ' + JSON.stringify(config.tunnelId),
    'credentials-file: ' + JSON.stringify(creds),
    'ingress:',
    '  - hostname: ' + JSON.stringify(config.hostname),
    '    service: ' + JSON.stringify('http://localhost:' + port),
    '    originRequest:',
    '      noTLSVerify: true',
    '      connectTimeout: 30s',
    '  - service: http_status:404',
    '',
  ].join('\n')
  const out = path.join(tunnelDir(), 'generated-config.yml')
  fs.writeFileSync(out, yml)
  return out
}

// ---------------------------------------------------------------- state push
function publicState() {
  return {
    ...state,
    hostname: config ? config.hostname : '',
    localPort: config ? config.localPort : 0,
    mode: quickMode ? 'demo' : resolveMode(),
    configured: resolveMode() !== 'none',
    loggedIn: isLoggedIn(),
    // مصدر الإعداد: fitboost (من Control) | login | manual | '' (قديم/مش معروف)
    source: config ? (config.source || '') : '',
    quick: quickMode,
  }
}
function pushStatus() {
  if (sender) sender('tunnel:status', publicState())
}
function pushLog(line) {
  if (sender) sender('tunnel:log', line)
}
function pushSetup(line) {
  if (sender) sender('tunnel:setup-progress', line)
}
function setState(patch) {
  Object.assign(state, patch)
  pushStatus()
}

// ---------------------------------------------------------------- tunnel control
function start() {
  const mode = quickMode ? 'demo' : resolveMode()
  if (mode === 'none') {
    setState({ status: 'error', message: 'الإعدادات ناقصة — أنشئ تونل من فوق (subdomain + domain) أو حط token.' })
    return
  }
  if (manager && manager.isRunning()) return

  let cfgYmlPath = ''
  if (mode === 'local') {
    try { cfgYmlPath = writeLocalConfigYml() }
    catch (e) { setState({ status: 'error', message: e.message }); return }
  }

  const startMsg = mode === 'demo'
    ? 'وضع تجربة (quick tunnel) — بدون token…'
    : mode === 'local'
    ? 'جاري تشغيل cloudflared (config محلي)…'
    : 'جاري تشغيل cloudflared (token)…'
  setState({ status: 'starting', connections: 0, message: startMsg })
  activeMode = mode
  clearNotConnectedCheck()

  manager = new TunnelProcess({
    binPath: cloudflaredPath(),
    mode,
    token: config.token,
    configPath: cfgYmlPath,
    localPort: config.localPort,
    onLog: (line) => pushLog(line),
    onUrl: (url) => setState({ publicUrl: url }),
    onConnecting: () => { if (state.status === 'starting') setState({ status: 'connecting' }) },
    onConnection: (n) => {
      setState({
        status: n > 0 ? 'connected' : 'connecting',
        connections: n,
        message: n >= 4 ? 'كل الاتصالات شغّالة ✓' : 'اتصال ' + n + '/4',
        publicUrl: mode !== 'demo' && config.hostname ? 'https://' + config.hostname : state.publicUrl,
      })
      if (n > 0) { clearNotConnectedCheck(); reportCloud(true) }
    },
    onError: (msg) => {
      setState({ status: 'error', message: msg })
      reportCloud(false, msg)
    },
    onExit: (code, willRestart) => {
      if (willRestart) {
        setState({ status: 'connecting', connections: 0, message: 'cloudflared قفل (code ' + code + ') — جاري إعادة التشغيل…', restarts: state.restarts + 1 })
        // لو فضل مش متصل دقيقة بعد القفلة → نبلّغ FitBoost إنه واقع
        scheduleNotConnectedCheck('cloudflared قفل (code ' + code + ') ومش راجع يتصل')
      } else {
        setState({ status: 'stopped', connections: 0, publicUrl: '', message: 'الـ tunnel متوقف.' })
      }
    },
  })
  manager.start()
}
function stop() {
  if (manager) manager.stop()
  const wasQuick = quickMode
  quickMode = false
  clearNotConnectedCheck()
  setState({ status: 'stopped', connections: 0, publicUrl: '', message: 'الـ tunnel متوقف.' })
  if (!wasQuick) reportCloud(false, 'اتوقف يدويًا من الجهاز')
}
function restart() {
  if (manager) manager.stop()
  setTimeout(start, 800)
}

// ---------------------------------------------------------------- local server health
function checkServer() {
  if (!config || !config.localPort) return
  const done = (up) => { if (up !== state.serverUp) setState({ serverUp: up }) }
  const req = http.get({ host: '127.0.0.1', port: config.localPort, path: '/', timeout: 2500 }, (res) => { res.resume(); done(true) })
  req.on('error', () => done(false))
  req.on('timeout', () => { req.destroy(); done(false) })
}

// ---------------------------------------------------------------- keep awake / autostart
function setKeepAwake(on) {
  state.keepAwake = on
  if (on) {
    if (powerBlockerId == null || !powerSaveBlocker.isStarted(powerBlockerId)) {
      powerBlockerId = powerSaveBlocker.start('prevent-app-suspension')
    }
  } else if (powerBlockerId != null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId)
    powerBlockerId = null
  }
  saveConfig({ keepAwake: on })
  pushStatus()
  return publicState()
}
function setAutoLaunch(on) {
  state.autoLaunch = on
  try { app.setLoginItemSettings({ openAtLogin: on, path: process.execPath }) } catch (e) { /* ignore */ }
  saveConfig({ autoLaunch: on })
  pushStatus()
  return publicState()
}

// ---------------------------------------------------------------- in-app setup
function firstErr(out) {
  const lines = out.split(/\r?\n/).filter((l) => l.trim())
  return lines.find((l) => /error|failed|cannot|denied|invalid/i.test(l)) || lines[lines.length - 1] || ''
}
function runCloudflared(args, onLine) {
  return new Promise((resolve) => {
    let child
    try { child = spawn(cloudflaredPath(), args, { windowsHide: true }) }
    catch (e) { return resolve({ code: -1, out: 'spawn error: ' + e.message }) }
    let out = ''
    const handle = (buf) => {
      const t = buf.toString()
      out += t
      t.split(/\r?\n/).forEach((l) => { if (l.trim() && onLine) onLine(l) })
    }
    if (child.stdout) child.stdout.on('data', handle)
    if (child.stderr) child.stderr.on('data', handle)
    child.on('error', (e) => resolve({ code: -1, out: out + '\n' + e.message }))
    child.on('exit', (code) => resolve({ code, out }))
  })
}

function setupStatus() {
  return { loggedIn: isLoggedIn() }
}

async function login() {
  if (isLoggedIn()) return { ok: true, already: true }
  if (loginRunning) return { ok: false, error: 'اللوجن شغّال بالفعل.' }
  loginRunning = true
  pushSetup('بيفتح المتصفح… سجّل دخول واختار الدومين، وبعدين ارجع هنا.')
  const res = await runCloudflared(['tunnel', 'login'], (l) => {
    pushSetup(l)
    const u = l.match(/https:\/\/\S*argotunnel\S*/i)
    if (u) shell.openExternal(u[0])
  })
  loginRunning = false
  const ok = isLoggedIn()
  return { ok, error: ok ? undefined : 'اللوجن اتلغى أو فشل. ' + firstErr(res.out) }
}

async function createTunnel(data) {
  const subdomain = (data && data.subdomain ? String(data.subdomain) : '').trim()
  const domain = (data && data.domain ? String(data.domain) : '').trim()
  const localPort = Number(data && data.port) || 4001
  if (!domain) return { ok: false, error: 'اكتب الدومين.' }
  if (!isLoggedIn()) return { ok: false, error: 'لازم تسجّل دخول Cloudflare الأول.' }
  if (createRunning) return { ok: false, error: 'الإنشاء شغّال بالفعل.' }
  createRunning = true
  try {
    const hostname = (subdomain ? subdomain + '.' : '') + domain
    const name = 'fb-' + (subdomain || 'tunnel') + '-' + crypto.randomBytes(3).toString('hex')

    pushSetup('بيعمل التونل: ' + name)
    const created = await runCloudflared(['tunnel', 'create', name], (l) => pushSetup(l))
    const m = created.out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    if (!m) return { ok: false, error: 'فشل إنشاء التونل. ' + firstErr(created.out) }
    const tunnelId = m[0]

    const credMatch = created.out.match(/credentials written to\s+(.+?\.json)/i)
    const credSrc = credMatch ? credMatch[1].trim() : path.join(cfHome(), tunnelId + '.json')
    let credFile = tunnelId + '.json'
    try { fs.copyFileSync(credSrc, path.join(tunnelDir(), credFile)) }
    catch (e) { credFile = credSrc }

    pushSetup('بيربط الـ DNS: ' + hostname)
    const routed = await runCloudflared(['tunnel', 'route', 'dns', '--overwrite-dns', name, hostname], (l) => pushSetup(l))
    if (routed.code !== 0 && !/already|updated|added|created/i.test(routed.out)) {
      return { ok: false, error: 'فشل ربط الـ DNS. ' + firstErr(routed.out) }
    }

    saveConfig({ token: '', tunnelId, credentialsFile: credFile, hostname, localPort, source: 'login' })
    quickMode = false
    pushSetup('تم ✓ جاري التشغيل…')
    if (manager) manager.stop()
    setTimeout(start, 600)
    return { ok: true, tunnelId, hostname }
  } finally {
    createRunning = false
  }
}

// ---------------------------------------------------------------- FitBoost (Control) tunnel
// التونل بيتعمل في Control (بتوكن Cloudflare API محفوظ هناك بس)، والجهاز بياخد
// run token التونل ده بس ويشغّل cloudflared بيه (token mode).
// النداءات لـ Control بتعدّي من سيرفر Next المحلي (lib/gateway.ts عنده توكن الجهاز)
// عن طريق /api/settings/tunnel بالـ INTERNAL_API_TOKEN المشترك بين الـ main و Next.
const NEXT_PORT = 4001

function callNext(method, p, body, timeoutMs) {
  return new Promise((resolve) => {
    const tok = process.env.INTERNAL_API_TOKEN
    if (!tok) return resolve({ status: 0, data: null, error: 'INTERNAL_API_TOKEN missing' })
    const payload = body !== undefined ? JSON.stringify(body) : null
    const headers = { 'x-internal-token': tok, Accept: 'application/json' }
    if (payload) {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(payload)
      // middleware بيعمل CSRF check على الـ POST — Origin لازم يطابق الـ Host
      headers.Origin = 'http://127.0.0.1:' + NEXT_PORT
    }
    let req
    try {
      req = http.request(
        { host: '127.0.0.1', port: NEXT_PORT, path: p, method, headers, timeout: timeoutMs || 20000 },
        (res) => {
          let raw = ''
          res.setEncoding('utf8')
          res.on('data', (c) => { raw += c })
          res.on('end', () => {
            let data = null
            try { data = JSON.parse(raw) } catch (e) { /* ignore */ }
            resolve({ status: res.statusCode || 0, data })
          })
        }
      )
    } catch (e) {
      return resolve({ status: 0, data: null, error: e.message })
    }
    req.on('error', (e) => resolve({ status: 0, data: null, error: e.message }))
    req.on('timeout', () => req.destroy(new Error('timeout')))
    if (payload) req.write(payload)
    req.end()
  })
}

// يوقف cloudflared الحالي ويستنى يقفل فعلاً قبل ما يشغّل بالإعداد الجديد
function stopThenStart(delay) {
  clearNotConnectedCheck()
  if (manager) manager.stop()
  const t0 = Date.now()
  const tick = () => {
    if (manager && manager.isRunning() && Date.now() - t0 < 5000) { setTimeout(tick, 300); return }
    manager = null
    start()
  }
  setTimeout(tick, delay == null ? 600 : delay)
}

function validRunToken(token) {
  return typeof token === 'string' && token.length >= 40 && /^[A-Za-z0-9+/=_-]+$/.test(token)
}

/** يحفظ تونل FitBoost (token + hostname + port) ويشغّله token mode */
function applyCloudTunnel(t, how) {
  const token = t && typeof t.token === 'string' ? t.token.trim() : ''
  if (!validRunToken(token)) return { ok: false, error: 'توكن التونل اللي جه من FitBoost مش صالح.' }
  const hostname = String((t && t.hostname) || '').trim().toLowerCase()
  const localPort = Number(t && t.localPort) || (config && config.localPort) || 4001
  saveConfig({
    token,
    hostname,
    localPort,
    demo: false,
    source: 'fitboost',
    cloudTunnelId: String((t && t.id) || ''),
    cloudTunnelName: String((t && t.name) || ''),
    cloudAppliedAt: new Date().toISOString(),
  })
  quickMode = false
  pushSetup((how === 'auto' ? 'اتظبط أوتوماتيك من FitBoost: ' : 'تم استلام التونل من FitBoost: ') + (hostname || '—'))
  if (how === 'auto') console.log('[tunnel] auto-configured from FitBoost:', hostname)
  stopThenStart()
  return { ok: true, hostname, localPort }
}

/** توكن يدوي (طريقة احتياطية) */
function setManualToken(data) {
  const token = (data && data.token ? String(data.token) : '').trim()
  if (!validRunToken(token)) return { ok: false, error: 'الـ token مش صالح — انسخه كامل من Cloudflare.' }
  const hostname = (data && data.hostname ? String(data.hostname) : '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const localPort = Number(data && data.port) || (config && config.localPort) || 4001
  saveConfig({ token, hostname, localPort, demo: false, source: 'manual' })
  quickMode = false
  stopThenStart()
  return { ok: true, hostname }
}

/** quick tunnel مؤقت (trycloudflare) — للتجربة بس، مش بيتحفظ */
function startQuick() {
  quickMode = true
  stopThenStart()
  return { ok: true }
}

// ---- تقارير الحالة لـ Control (tunnel-report) — throttled
const REPORT_MIN_GAP_CHANGED = 30 * 1000
const REPORT_HEARTBEAT = 10 * 60 * 1000
let lastReport = { running: null, at: 0 }
let pendingReport = null
let reportTimer = null
let heartbeatTimer = null
let notConnectedTimer = null

function sendReport(r) {
  lastReport = { running: r.running, at: Date.now() }
  const body = { running: !!r.running }
  if (!r.running && r.error) body.error = String(r.error).slice(0, 500)
  callNext('POST', '/api/settings/tunnel/report', body, 15000).catch(() => {})
}
function reportCloud(running, error) {
  if (activeMode === 'demo' || activeMode === 'none') return
  const r = { running: !!running, error: error || '' }
  const changed = r.running !== lastReport.running
  const gap = changed ? REPORT_MIN_GAP_CHANGED : REPORT_HEARTBEAT
  const wait = gap - (Date.now() - lastReport.at)
  if (wait <= 0) {
    pendingReport = null
    if (reportTimer) { clearTimeout(reportTimer); reportTimer = null }
    sendReport(r)
    return
  }
  if (!changed) return
  // اتغيرت بسرعة — نبعت آخر حالة بعد ما المهلة تخلص
  pendingReport = r
  if (!reportTimer) {
    reportTimer = setTimeout(() => {
      reportTimer = null
      const p = pendingReport
      pendingReport = null
      if (p && p.running !== lastReport.running) sendReport(p)
    }, wait)
  }
}
function scheduleNotConnectedCheck(msg) {
  if (notConnectedTimer) return
  notConnectedTimer = setTimeout(() => {
    notConnectedTimer = null
    if (state.status !== 'connected') reportCloud(false, msg)
  }, 60 * 1000)
}
function clearNotConnectedCheck() {
  if (notConnectedTimer) { clearTimeout(notConnectedTimer); notConnectedTimer = null }
}

// ---- الفحص عند التشغيل: لو مفيش تونل متظبط (أو المتظبط جاي من FitBoost) وControl
//      عنده تونل جاهز للجهاز ده → يتظبط ويشتغل لوحده. مش بيلمس إعداد login/يدوي شغّال.
let cloudCheckTimer = null
let cloudCheckTries = 0
function cloudEligible() {
  if (!config) return false
  const m = resolveMode()
  return m === 'none' || (m === 'token' && config.source === 'fitboost')
}
function scheduleCloudCheck(ms) {
  if (cloudCheckTimer) clearTimeout(cloudCheckTimer)
  cloudCheckTimer = setTimeout(cloudCheck, ms)
}
async function cloudCheck() {
  cloudCheckTimer = null
  if (!cloudEligible()) return
  let r
  try { r = await callNext('GET', '/api/settings/tunnel', undefined, 20000) }
  catch (e) { r = { status: 0, data: null } }
  if (r.status === 200 && r.data && r.data.ok) {
    cloudCheckTries = 0
    const t = r.data.tunnel
    const ready = !r.data.status || r.data.status === 'ready'
    if (t && t.token && ready && cloudEligible() && !quickMode && t.token !== config.token) {
      applyCloudTunnel(t, 'auto')
    }
    // نراجع كل نص ساعة طالما لسه مفيش تونل أو التونل من FitBoost (عشان لو اتعمل من جديد في Control)
    scheduleCloudCheck(30 * 60 * 1000)
    return
  }
  // السيرفر المحلي لسه مقامش / مفيش نت / الجهاز لسه مش مربوط → نحاول تاني
  cloudCheckTries++
  scheduleCloudCheck(cloudCheckTries < 10 ? 2 * 60 * 1000 : 30 * 60 * 1000)
}

function reloadConfig() {
  config = loadConfig()
  setState({ message: 'تم إعادة تحميل الإعدادات' })
  return publicState()
}
function openConfig() {
  try { shell.openPath(configPath()) } catch (e) { /* ignore */ }
}

// ---------------------------------------------------------------- lifecycle
function setSender(fn) {
  sender = fn
}
function init() {
  config = loadConfig()
  state.autoLaunch = !!(app.getLoginItemSettings && app.getLoginItemSettings().openAtLogin)
  if (config.keepAwake) setKeepAwake(true)
  healthTimer = setInterval(checkServer, 3000)
  checkServer()
  if (resolveMode() !== 'none') start()
  else setState({ status: 'idle', message: 'مفيش تونل متظبط لسه — فعّله أوتوماتيك من FitBoost.' })
  // بنستنى سيرفر Next يقوم (والجهاز يتربط بـ Control) قبل أول فحص
  scheduleCloudCheck(45 * 1000)
  heartbeatTimer = setInterval(() => { if (state.status === 'connected') reportCloud(true) }, REPORT_HEARTBEAT)
}
function dispose() {
  if (healthTimer) clearInterval(healthTimer)
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  if (cloudCheckTimer) clearTimeout(cloudCheckTimer)
  if (reportTimer) clearTimeout(reportTimer)
  clearNotConnectedCheck()
  if (manager) manager.stop()
  if (powerBlockerId != null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId)
  }
}

module.exports = {
  setSender,
  init,
  dispose,
  getState: publicState,
  start,
  stop,
  restart,
  setupStatus,
  login,
  createTunnel,
  applyCloudTunnel: (t) => applyCloudTunnel(t, 'manual'),
  setManualToken,
  startQuick,
  setKeepAwake,
  setAutoLaunch,
  reloadConfig,
  openConfig,
}
