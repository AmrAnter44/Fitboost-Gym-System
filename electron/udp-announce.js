/**
 * UDP responder — بيخلي أجهزة Fitboost Assistant تلاقي السيرفر فورًا (<100ms)
 * بدل مسح 254 عنوان لما يتغير الـ IP.
 *
 * الكلاينت بيبعت broadcast برسالة FITBOOST_DISCOVER_V1 على بورت 40045،
 * والسيرفر بيرد بـ JSON فيه بورت الخدمة. سيرفرات قديمة من غير الملف ده
 * بيتجاهلها الكلاينت ويرجع للمسح العادي تلقائيًا.
 */

const dgram = require('dgram')

const FITBOOST_UDP_PORT = 40045
const DISCOVER_MAGIC = 'FITBOOST_DISCOVER_V1'

function startUdpAnnouncer(servicePort = 4001) {
  try {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    sock.on('message', (msg, rinfo) => {
      try {
        if (msg.toString().trim() !== DISCOVER_MAGIC) return
        const reply = Buffer.from(JSON.stringify({ service: 'fitboost', port: servicePort }))
        sock.send(reply, rinfo.port, rinfo.address)
      } catch { /* رسالة مش مفهومة — تجاهل */ }
    })

    sock.on('error', (err) => {
      // مش مصيري — الكلاينت هيرجع للمسح العادي
      console.error('[UDP-Announce] error:', err.message)
      try { sock.close() } catch { /* ignore */ }
    })

    sock.bind(FITBOOST_UDP_PORT, () => {
      console.log(`[UDP-Announce] listening on udp/${FITBOOST_UDP_PORT}`)
    })

    return sock
  } catch (err) {
    console.error('[UDP-Announce] failed to start:', err.message)
    return null
  }
}

module.exports = { startUdpAnnouncer, FITBOOST_UDP_PORT, DISCOVER_MAGIC }
