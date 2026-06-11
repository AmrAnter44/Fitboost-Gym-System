/**
 * LAN discovery for Fitboost Assistant client.
 *
 * Strategy (fastest → slowest):
 *   1. Try the last known good IP (instant, < 1s)
 *   2. Parallel subnet scan on /24 (typically 3-8s)
 *   3. Manual entry by the user (in splash UI)
 *
 * Targets port 4001 (the Fitboost server port).
 */

const http = require('http')
const os = require('os')

const PORT = 4001
const PROBE_TIMEOUT_MS = 600

// Endpoints to try, in order of preference. The first one is the
// dedicated health endpoint (new servers). The others are fallbacks
// for older servers that don't have /api/health yet — any Next.js
// response (200 HTML or auth redirect) on port 4001 is good enough
// to identify a Fitboost host on the LAN.
const PROBE_PATHS = [
  { path: '/api/health', confirm: true },  // best: confirms it's Fitboost via JSON
  { path: '/login', confirm: false },       // fallback: any 200/3xx is fine
  { path: '/', confirm: false },            // fallback: same
]

/**
 * Probe a single IP. Returns true if the host LOOKS like a Fitboost server.
 * New servers respond on /api/health with {service:'fitboost'}.
 * Old servers respond on / or /login with HTML or a redirect.
 */
function probeHost(ip, port = PORT, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise(async (resolve) => {
    for (const { path: probePath, confirm } of PROBE_PATHS) {
      const result = await singleProbe(ip, port, probePath, timeoutMs, confirm)
      if (result) {
        resolve(true)
        return
      }
    }
    resolve(false)
  })
}

function singleProbe(ip, port, probePath, timeoutMs, confirmIdentity) {
  return new Promise((resolve) => {
    const req = http.request({
      method: 'GET',
      host: ip,
      port,
      path: probePath,
      timeout: timeoutMs,
    }, (res) => {
      const status = res.statusCode || 0
      let body = ''
      res.on('data', (chunk) => { if (confirmIdentity && body.length < 2048) body += chunk })
      res.on('end', () => {
        if (confirmIdentity) {
          // Strict: must be JSON saying service=fitboost
          try {
            const parsed = JSON.parse(body)
            resolve(parsed.service === 'fitboost' || parsed.ok === true)
          } catch {
            resolve(false)
          }
        } else {
          // Loose: any 2xx or 3xx response from a Next.js server is acceptable.
          // Random services on port 4001 are extremely rare on a gym LAN.
          resolve(status >= 200 && status < 400)
        }
      })
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
    req.end()
  })
}

/**
 * Detect all local IPv4 subnets the machine has. Usually one (Wi-Fi or Ethernet),
 * but could be multiple if the machine has VPNs or multiple NICs.
 * Returns array of { localIp, subnetPrefix } where subnetPrefix is e.g. "192.168.1."
 */
function getLocalSubnets() {
  const subnets = []
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family !== 'IPv4' || iface.internal) continue
      // Only handle /24 subnets (the common LAN case) — derive prefix from IP
      const parts = iface.address.split('.')
      if (parts.length !== 4) continue
      const prefix = parts.slice(0, 3).join('.') + '.'
      subnets.push({ localIp: iface.address, subnetPrefix: prefix })
    }
  }
  return subnets
}

/**
 * Scan an entire /24 subnet (1-254) in parallel.
 * onProgress(scanned, total, foundIp) called as IPs are probed.
 * Resolves with the first matching IP, or null if none found.
 */
async function scanSubnet(subnetPrefix, onProgress) {
  let scanned = 0
  const total = 254
  let found = null
  let firstResolve

  const result = new Promise((resolve) => { firstResolve = resolve })

  const promises = []
  for (let i = 1; i <= 254; i++) {
    const ip = subnetPrefix + i
    promises.push(
      probeHost(ip).then((ok) => {
        scanned++
        if (ok && !found) {
          found = ip
          firstResolve(ip)
        }
        if (onProgress) onProgress(scanned, total, found)
      })
    )
  }

  // Wait until either a match is found OR all probes complete
  await Promise.race([
    result,
    Promise.all(promises).then(() => firstResolve(null)),
  ])

  return found
}

/**
 * Try the last-known-good IP first. Falls back to subnet scan.
 *
 * @param {string|null} lastIp  Previously saved IP, or null
 * @param {function} onProgress (phase: string, info: object) => void
 * @returns {Promise<string|null>} the discovered IP, or null
 */
async function discoverServer(lastIp, onProgress) {
  // 1. Try the last known IP (instant)
  if (lastIp) {
    if (onProgress) onProgress('saved', { ip: lastIp })
    const ok = await probeHost(lastIp, PORT, 1500) // give a bit more time on first try
    if (ok) {
      if (onProgress) onProgress('found', { ip: lastIp, source: 'saved' })
      return lastIp
    }
    if (onProgress) onProgress('saved-failed', { ip: lastIp })
  }

  // 2. Subnet scan on all local subnets
  const subnets = getLocalSubnets()
  if (subnets.length === 0) {
    if (onProgress) onProgress('no-network', {})
    return null
  }

  for (const { localIp, subnetPrefix } of subnets) {
    if (onProgress) onProgress('scanning', { localIp, subnetPrefix, scanned: 0, total: 254 })
    const found = await scanSubnet(subnetPrefix, (scanned, total) => {
      if (onProgress) onProgress('scanning', { localIp, subnetPrefix, scanned, total })
    })
    if (found) {
      if (onProgress) onProgress('found', { ip: found, source: 'scan' })
      return found
    }
  }

  if (onProgress) onProgress('not-found', {})
  return null
}

module.exports = {
  probeHost,
  discoverServer,
  getLocalSubnets,
  PORT,
}
