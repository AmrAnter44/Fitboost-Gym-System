// PM2 config للنسخة التجريبية (البيتا) على سيرفر Linux.
//
// بنشغّل `next start` مباشرة (مش npm start) عشان نتخطى سكربتات الـ prestart
// اللي مصمّمة لجهاز الجيم الويندوز (فحص/مزامنة gym.db محلياً).
//
//   pm2 start deploy/ecosystem.beta.config.js
//   pm2 save && pm2 startup
const path = require('path')
const ROOT = path.join(__dirname, '..')   // مجلد التطبيق مهما كان مكانه

module.exports = {
  apps: [{
    name: 'fitboost-beta',
    script: './node_modules/next/dist/bin/next',
    args: 'start -p 4001 -H 127.0.0.1',   // Caddy هو اللي بيتعرض للإنترنت
    cwd: ROOT,
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: { NODE_ENV: 'production' },
    error_file: path.join(ROOT, 'logs/pm2-error.log'),
    out_file: path.join(ROOT, 'logs/pm2-out.log'),
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '20s',
    kill_timeout: 8000,
  }]
}
