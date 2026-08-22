#!/usr/bin/env bash
# 🔄 تحديث النسخة التجريبية لآخر كود على main.
#   bash /opt/fitboost-beta/deploy/update-beta.sh
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/fitboost-beta}"
BRANCH="${BRANCH:-main}"
cd "$APP_DIR"

echo "⬇️  جلب آخر كود..."
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"     # .env و prisma/*.db مش متتبعين، فبيفضلوا زي ما هم

echo "📦 تحديث الحزم..."
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --include=dev --no-audit --no-fund

echo "🗃️  مزامنة الـ schema مع الداتا التجريبية..."
npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss
DATABASE_URL="file:$APP_DIR/prisma/demo-seed.db" \
  npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss

echo "🏗️  بناء..."
NODE_OPTIONS="--max-old-space-size=2048" npm run build

pm2 restart fitboost-beta
echo "✅ البيتا اتحدّثت."
