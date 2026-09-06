#!/usr/bin/env bash
# 🔄 تحديث نسخة جيم لآخر كود على main.
#
#   APP_DIR=/opt/fitboost-elnour bash deploy/update-gym.sh
#   APP_DIR=/opt/fitboost-elnour bash deploy/update-gym.sh --if-changed
#
# ⚠️ ملاحظة مهمة: السكربت بيعمل git reset --hard وده بيعيد كتابة الملف ده
# نفسه وهو شغال. باش بيقرا السكربتات على أجزاء، فتغيير الملف أثناء التنفيذ
# بيلخبط مكان القراءة. عشان كده كل الجسم جوه main() والاستدعاء في بلوك واحد
# في الآخر — باش بيقرا الدالة كاملة في الذاكرة قبل ما ينفّذها.
#
# الداتا مابتتلمسش: .env و prisma/*.db و uploads/ و .whatsapp-auth/ مش
# متتبعين في git، فـ reset --hard مابيمسّهمش.
set -euo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:$PATH"

main() {
  local APP_DIR="${APP_DIR:-/opt/fitboost}"
  local BRANCH="${BRANCH:-main}"
  local IF_CHANGED=0
  [ "${1:-}" = "--if-changed" ] && IF_CHANGED=1

  cd "$APP_DIR"

  # اسم عمليات PM2 من .env — كل جيم ليه اسمه
  local APP_NAME
  APP_NAME="$(grep -E '^APP_NAME=' .env 2>/dev/null | cut -d= -f2- | tr -d '"'"'"' ' || true)"
  APP_NAME="${APP_NAME:-fitboost}"

  echo "[$(date '+%F %T')] ⬇️  فحص آخر كود ($APP_NAME)..."
  git fetch -q origin "$BRANCH"

  local LOCAL REMOTE
  LOCAL="$(git rev-parse HEAD)"
  REMOTE="$(git rev-parse "origin/$BRANCH")"

  if [ "$IF_CHANGED" = "1" ] && [ "$LOCAL" = "$REMOTE" ]; then
    echo "[$(date '+%F %T')] ✓ مفيش كود جديد — تخطّي التحديث"
    return 0
  fi

  echo "   من ${LOCAL:0:8} إلى ${REMOTE:0:8}"

  # نسخة احتياطية قبل أي تحديث — أرخص من الندم
  if [ -x deploy/backup-gym.sh ]; then
    echo "💾 نسخة احتياطية قبل التحديث..."
    APP_DIR="$APP_DIR" BACKUP_DIR="/var/backups/$APP_NAME" \
      WA_DIR="$APP_DIR/.whatsapp-auth" deploy/backup-gym.sh || true
  fi

  git reset --hard -q "origin/$BRANCH"

  echo "📦 تحديث الحزم..."
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    npm ci --include=dev --no-audit --no-fund

  echo "🗃️  مزامنة الـ schema مع داتا الجيم..."
  npx prisma generate
  npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss

  echo "🏗️  بناء..."
  NODE_OPTIONS="--max-old-space-size=2048" npm run build

  pm2 restart "$APP_NAME" "$APP_NAME-whatsapp"
  echo "[$(date '+%F %T')] ✅ $APP_NAME اتحدّث لـ ${REMOTE:0:8}"
}

# لازم يفضلوا في بلوك واحد — شوف الملاحظة فوق
{ main "$@"; exit $?; }
