#!/usr/bin/env bash
# ♻️ يرجّع الداتا التجريبية لأصلها (بيشتغل من الكرون كل يوم 4 الفجر).
set -euo pipefail
# الكرون بيشتغل بـ PATH ضيق — نضيف أماكن pm2/node
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:$PATH"
APP_DIR="${APP_DIR:-/opt/fitboost-beta}"
cd "$APP_DIR"

[ -f prisma/demo-seed.db ] || { echo "❌ مفيش prisma/demo-seed.db"; exit 1; }

pm2 stop fitboost-beta >/dev/null 2>&1 || true
rm -f prisma/gym.db prisma/gym.db-wal prisma/gym.db-shm
cp prisma/demo-seed.db prisma/gym.db
find uploads -mindepth 1 -delete 2>/dev/null || true   # صور رفعها المجرّبون
find prisma/backups -name '*.bak' -mtime +3 -delete 2>/dev/null || true  # باكاب تلقائي قديم
pm2 start fitboost-beta >/dev/null 2>&1 || pm2 restart fitboost-beta
echo "[$(date '+%F %T')] ✅ اترجّعت الداتا التجريبية"
