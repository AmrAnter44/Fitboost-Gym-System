// PM2 config لجيم حقيقي — عمليتين لكل جيم:
//
//   <APP_NAME>            → تطبيق Next على 127.0.0.1:<PORT>
//   <APP_NAME>-whatsapp   → خدمة Baileys على 127.0.0.1:<WHATSAPP_PORT>
//
// كل القيم بتتقرا من .env بتاع المجلد ده، فنفس الملف بيشغّل أكتر من جيم
// على نفس السيرفر — كل واحد في مجلده وببورتات وأسماء مختلفة.
//
// بنشغّل `next start` مباشرة (مش `npm start`) عشان نتخطى سكربتات الـ
// prestart المصمّمة لجهاز ويندوز في الجيم.
//
//   pm2 start deploy/ecosystem.gym.config.js
//   pm2 save && pm2 startup
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')

// الـ sidecar مابيقراش .env لوحده (في الديسكتوب electron/main.js هو اللي
// بيحمّله)، وقيم زي INTERNAL_API_TOKEN و WHATSAPP_PORT لازم تكون متطابقة
// في العمليتين — فبنقرا الملف هنا ونمرّره للاتنين.
function readEnv() {
  const out = {}
  const file = path.join(ROOT, '.env')
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const ENV = readEnv()
const NAME = ENV.APP_NAME || 'fitboost'
const PORT = ENV.PORT || '4001'
const WA_PORT = ENV.WHATSAPP_PORT || '4002'

if (!ENV.INTERNAL_API_TOKEN) {
  console.warn('⚠️  مفيش INTERNAL_API_TOKEN في .env — كل مسارات '
    + '/api/whatsapp/internal هترجّع 503 والواتساب مش هيشتغل.')
}

const shared = {
  NODE_ENV: 'production',
  DATABASE_URL: ENV.DATABASE_URL || '',
  INTERNAL_API_TOKEN: ENV.INTERNAL_API_TOKEN || '',
  // الاتنين لازم يشوفوا نفس البورتات عشان يلاقوا بعض
  PORT,
  APP_PORT: PORT,
  WHATSAPP_PORT: WA_PORT,
  // ⚠️ مجلد الجلسات لازم يكون مختلف لكل جيم — لو اتنين شاركوا نفس المجلد
  //    هيدوسوا على جلسة بعض والرقمين هيتفصلوا من واتساب.
  WHATSAPP_AUTH_DIR: ENV.WHATSAPP_AUTH_DIR || path.join(ROOT, '.whatsapp-auth'),
}

const common = {
  cwd: ROOT,
  instances: 1,
  exec_mode: 'fork',
  watch: false,
  autorestart: true,
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  merge_logs: true,
}

module.exports = {
  apps: [
    {
      ...common,
      name: NAME,
      script: './node_modules/next/dist/bin/next',
      args: `start -p ${PORT} -H 127.0.0.1`,
      max_memory_restart: '1G',
      env: shared,
      error_file: path.join(ROOT, 'logs/pm2-error.log'),
      out_file: path.join(ROOT, 'logs/pm2-out.log'),
      max_restarts: 10,
      min_uptime: '20s',
      kill_timeout: 8000,
    },
    {
      ...common,
      name: `${NAME}-whatsapp`,
      script: './electron/whatsapp-service.js',
      // Baileys ماسك الجلسات في الذاكرة؛ الاستخدام العادي أقل من ده بكتير،
      // فلو وصل الحد يبقى في تسريب والأفضل يعيد التشغيل.
      max_memory_restart: '700M',
      env: shared,
      error_file: path.join(ROOT, 'logs/wa-error.log'),
      out_file: path.join(ROOT, 'logs/wa-out.log'),
      // بيرجع يكلّم Next، فبنديله فرصة يقوم الأول بدل ما يلف في إعادة تشغيل
      restart_delay: 5000,
      max_restarts: 20,
      min_uptime: '30s',
      kill_timeout: 10000,
    },
  ],
}
