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

# يبني مع الاحتفاظ بآخر نسخة شغالة من .next — لو البناء فشل (رام/كود/قطع)
# بنرجّعها عشان التطبيق يفضل يقوم بعد أي restart بدل ما يوقع.
build_keeping_last_good() {
  rm -rf .next.prev
  if [ -f .next/BUILD_ID ]; then
    mkdir -p .next.prev
    tar -C .next --exclude=./cache -cf - . | tar -C .next.prev -xf -
  fi
  local rc=0
  NODE_OPTIONS="--max-old-space-size=2048" npm run build || rc=$?
  if [ "$rc" = 0 ]; then
    rm -rf .next.prev
    return 0
  fi
  if [ -f .next.prev/BUILD_ID ]; then
    echo "❌ البناء فشل — رجّعنا آخر نسخة شغالة من .next"
    rm -rf .next && mv .next.prev .next
  else
    echo "❌ البناء فشل ومفيش نسخة سابقة ترجع"
  fi
  return "$rc"
}

main() {
  local APP_DIR="${APP_DIR:-/opt/fitboost-beta}"
  local BRANCH="${BRANCH:-main}"
  local IF_CHANGED=0
  [ "${1:-}" = "--if-changed" ] && IF_CHANGED=1

  cd "$APP_DIR"

  # ── التحديث بيشتغل منفصل عن جلسة الـ SSH ──────────────────────────────
  # لو الاتصال قطع في نص البناء، السكربت كان بيتقتل و.next بيفضل ناقص،
  # وأول restart (الكرون أو pm2) بيوقع التطبيق. عشان كده بنعيد تشغيل
  # نفسنا بـ setsid في الخلفية ونكتب في لوج، والجلسة الحالية بتتابع اللوج
  # بس. لو الجلسة قطعت، التحديث بيكمّل لوحده.
  if [ -z "${FITBOOST_DETACHED:-}" ]; then
    mkdir -p logs
    local LOG="$APP_DIR/logs/update.log" STATUS="$APP_DIR/logs/update.status"
    local PIDF="$APP_DIR/logs/update.pid"
    rm -f "$STATUS" "$PIDF"
    [ -f "$LOG" ] && mv -f "$LOG" "$LOG.prev"
    echo "[$(date '+%F %T')] 🚀 التحديث شغال في الخلفية — اللوج: $LOG"
    echo "   لو الاتصال قطع، التحديث بيكمّل لوحده. تابعه بـ:  tail -f $LOG"
    FITBOOST_DETACHED=1 APP_DIR="$APP_DIR" BRANCH="$BRANCH" \
      setsid nohup bash "$APP_DIR/deploy/update-beta.sh" "$@" >> "$LOG" 2>&1 < /dev/null &
    local i=0
    while [ ! -f "$PIDF" ] && [ "$i" -lt 30 ]; do sleep 1; i=$((i+1)); done
    tail -n +1 -f "$LOG" 2>/dev/null &
    local TAIL=$!
    # نستنى لحد ما العملية الخلفية تكتب حالتها (أو تموت من غير ما تكتب)
    while [ ! -f "$STATUS" ] && kill -0 "$(cat "$PIDF" 2>/dev/null || echo 0)" 2>/dev/null; do sleep 2; done
    sleep 1; kill "$TAIL" 2>/dev/null || true
    local RC
    RC="$(cat "$STATUS" 2>/dev/null || echo 1)"
    return "$RC"
  fi
  trap 'echo $? > "$APP_DIR/logs/update.status"' EXIT
  echo $$ > "$APP_DIR/logs/update.pid"

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
  build_keeping_last_good

  pm2 restart fitboost-beta
  echo "[$(date '+%F %T')] ✅ البيتا اتحدّثت لـ ${REMOTE:0:8}"
}

# لازم يفضلوا في بلوك واحد — شوف الملاحظة فوق
{ main "$@"; exit $?; }
