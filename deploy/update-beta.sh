#!/usr/bin/env bash
# 🔄 تحديث النسخة التجريبية لآخر كود على main.
#
#   bash /opt/fitboost-beta/deploy/update-beta.sh              # حدّث دايماً
#   bash /opt/fitboost-beta/deploy/update-beta.sh --if-changed # حدّث بس لو في كود جديد
#
# ⚠️ ملاحظة مهمة: السكربت ده بيعمل git reset --hard وده بيعيد كتابة الملف ده
# نفسه وهو شغال. باش بيقرا السكربتات على أجزاء، فتغيير الملف أثناء التنفيذ
# بيلخبط مكان القراءة. عشان كده كل الجسم جوه main() والاستدعاء في بلوك واحد
# في الآخر — باش بيقرا الدالة كاملة في الذاكرة قبل ما ينفّذها.
set -euo pipefail

# الكرون بيشتغل بـ PATH ضيق
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:$PATH"

main() {
  local APP_DIR="${APP_DIR:-/opt/fitboost-beta}"
  local BRANCH="${BRANCH:-main}"
  local IF_CHANGED=0
  [ "${1:-}" = "--if-changed" ] && IF_CHANGED=1

  cd "$APP_DIR"

  echo "[$(date '+%F %T')] ⬇️  فحص آخر كود..."
  git fetch -q origin "$BRANCH"

  local LOCAL REMOTE
  LOCAL="$(git rev-parse HEAD)"
  REMOTE="$(git rev-parse "origin/$BRANCH")"

  if [ "$IF_CHANGED" = "1" ] && [ "$LOCAL" = "$REMOTE" ]; then
    echo "[$(date '+%F %T')] ✓ مفيش كود جديد — تخطّي التحديث"
    return 0
  fi

  echo "   من ${LOCAL:0:8} إلى ${REMOTE:0:8}"
  git reset --hard -q "origin/$BRANCH"   # .env و prisma/*.db مش متتبعين فبيفضلوا زي ما هم

  echo "📦 تحديث الحزم..."
  ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --include=dev --no-audit --no-fund

  echo "🗃️  مزامنة الـ schema مع الداتا التجريبية ونسخة التصفير..."
  npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss
  DATABASE_URL="file:$APP_DIR/prisma/demo-seed.db" \
    npx prisma db push --schema=prisma/schema.prisma --skip-generate --accept-data-loss

  echo "🏗️  بناء..."
  NODE_OPTIONS="--max-old-space-size=2048" npm run build

  pm2 restart fitboost-beta
  echo "[$(date '+%F %T')] ✅ البيتا اتحدّثت لـ ${REMOTE:0:8}"
}

# لازم يفضلوا في بلوك واحد — شوف الملاحظة فوق
{ main "$@"; exit $?; }
