#!/usr/bin/env bash
# =====================================================================
# 🚀 رفع جيم على السيرفر — بيتشغّل من جهازك انت، مش من السيرفر
#
#   bash deploy/deploy-gym-remote.sh
#
# بيعمل كل حاجة بالترتيب: فحوصات قبلية على الجهاز والسيرفر، رفع
# الداتابيز، التنصيب، والتحقق بعده. وبيقف عند أول مشكلة بدل ما يكمّل.
#
# الباسورد بيتكتب مرة واحدة بس: بنفتح اتصال SSH واحد مشترك
# (ControlMaster) وكل الأوامر بتمشي عليه. مفيش باسورد بيتكتب في أي ملف.
#
# متغيرات تقدر تغيّرها:
#   SERVER=162.35.106.93  DOMAIN=helmyapoint.fitboost.website
#   SLUG=helmyapoint      PORT=4011  WHATSAPP_PORT=4012
#   LOCAL_DB=prisma/helmyapoint.db   GYM_NAME="هيلمي بوينت"
#   FRESH=1               يبدأ بداتابيز فاضية بدل ما يرفع LOCAL_DB
# =====================================================================
set -euo pipefail

SERVER="${SERVER:-162.35.106.93}"
SSH_USER="${SSH_USER:-root}"
DOMAIN="${DOMAIN:-helmyapoint.fitboost.website}"
SLUG="${SLUG:-helmyapoint}"
PORT="${PORT:-4011}"
WHATSAPP_PORT="${WHATSAPP_PORT:-4012}"
DB_FILE="${DB_FILE:-$SLUG.db}"
GYM_NAME="${GYM_NAME:-هيلمي بوينت}"
BRANCH="${BRANCH:-main}"
REPO="${REPO:-https://github.com/AmrAnter44/Fitboost-Gym-System.git}"
LOCAL_DB="${LOCAL_DB:-prisma/$SLUG.db}"
FRESH="${FRESH:-0}"

APP_NAME="fitboost-$SLUG"
APP_DIR="/opt/$APP_NAME"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="/root/$SLUG-upload.db"

# ── اتصال SSH واحد مشترك: الباسورد مرة واحدة بس ──────────────────────
CTL="$(mktemp -u /tmp/fitboost-ssh-XXXXXX)"
SSH_OPTS=(-o ControlMaster=auto -o ControlPath="$CTL" -o ControlPersist=30m
          -o ServerAliveInterval=30 -o ServerAliveCountMax=20)
sh_() { ssh -n "${SSH_OPTS[@]}" "$SSH_USER@$SERVER" "$@"; }
cleanup() { ssh -O exit -o ControlPath="$CTL" "$SSH_USER@$SERVER" 2>/dev/null || true; }
trap cleanup EXIT

step() { echo -e "\n\033[1;36m=== $* ===\033[0m"; }
ok()   { echo -e "  \033[1;32m✓\033[0m $*"; }
fail() { echo -e "\n\033[1;31m❌ $*\033[0m" >&2; exit 1; }

# ── وضع التراجع ──────────────────────────────────────────────────────
if [ "${ROLLBACK:-0}" = "1" ]; then
  step "تراجع — بيشيل $APP_NAME بس، الديمو مايتأثرش"
  sh_ "pm2 delete '$APP_NAME' '$APP_NAME-whatsapp' 2>/dev/null || true
       rm -f '/etc/caddy/sites/$DOMAIN.caddy'
       systemctl reload caddy || true
       pm2 save || true
       crontab -l 2>/dev/null | grep -v '$APP_DIR' | crontab - || true"
  ok "اتشال. مجلد $APP_DIR سايبه زي ما هو — امسحه بإيدك لو متأكد."
  DEMO_RB="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://demo.fitboost.website || echo 000)"
  echo "  الديمو: $DEMO_RB"
  exit 0
fi

echo "الجيم    : $GYM_NAME  ($APP_NAME)"
echo "الدومين  : $DOMAIN"
echo "السيرفر  : $SSH_USER@$SERVER"
echo "البورتات : تطبيق $PORT / واتساب $WHATSAPP_PORT"
echo "الداتابيز: $([ "$FRESH" = "1" ] && echo 'فاضية من الأول' || echo "$LOCAL_DB → $DB_FILE")"

# ═══════════════════════════════ فحوصات على جهازك ═══════════════════
step "1/8 فحوصات على جهازك"

command -v sqlite3 >/dev/null || fail "sqlite3 مش متسطّب على جهازك"

if [ "$FRESH" != "1" ]; then
  [ -f "$ROOT/$LOCAL_DB" ] || fail "مالقيتش $LOCAL_DB — حدّد LOCAL_DB أو شغّل بـ FRESH=1"
  [ "$(sqlite3 "$ROOT/$LOCAL_DB" 'PRAGMA quick_check;' 2>&1)" = "ok" ] \
    || fail "$LOCAL_DB تالفة — مش هرفع حاجة"
  read -r M R U <<<"$(sqlite3 -separator ' ' "$ROOT/$LOCAL_DB" \
    'select (select count(*) from Member),(select count(*) from Receipt),(select count(*) from User);')"
  ok "$LOCAL_DB سليمة — $M عضو · $R إيصال · $U حساب"
fi

# الكود لازم يكون على الريموت، لأن السيرفر بيعمل clone منه
git -C "$ROOT" ls-remote --heads "$REPO" "$BRANCH" >/dev/null 2>&1 \
  || fail "مقدرتش أوصل للريبو"
LOCAL_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
REMOTE_HEAD="$(git -C "$ROOT" ls-remote "$REPO" "$BRANCH" | cut -f1)"
if [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]; then
  echo -e "  \033[1;33m⚠️\033[0m  المحلي (${LOCAL_HEAD:0:8}) مختلف عن origin/$BRANCH (${REMOTE_HEAD:0:8})"
  echo "     السيرفر بياخد اللي على origin. لو عندك تعديلات مش مرفوعة، اعمل push الأول."
  read -rp "     أكمّل؟ [y/N] " a; [ "$a" = "y" ] || exit 1
else
  ok "الكود على origin/$BRANCH (${REMOTE_HEAD:0:8})"
fi

# الدومين لازم يوصل للسيرفر مباشرة — Caddy محتاج ده عشان يجيب شهادة
DNS_IP="$(dig +short "$DOMAIN" A | tail -1)"
[ -n "$DNS_IP" ] || fail "$DOMAIN مالوش A record لسه"
if [ "$DNS_IP" != "$SERVER" ]; then
  case "$DNS_IP" in
    104.21.*|172.6[4-9].*|172.7[0-1].*)
      fail "$DOMAIN وراء Cloudflare ($DNS_IP). خلّيه DNS only (سحابة رمادية) —
   البروكسي بيمنع شهادة Let's Encrypt وبيبفّر الـ SSE فالـ QR مش هيظهر." ;;
    *) fail "$DOMAIN بيوصل لـ $DNS_IP مش $SERVER" ;;
  esac
fi
ok "$DOMAIN → $DNS_IP (مباشر، مش متبروكس)"

# ═══════════════════════════════ فحوصات على السيرفر ═════════════════
step "2/8 الاتصال بالسيرفر (الباسورد مرة واحدة بس)"
sh_ true || fail "مقدرتش أتصل بالسيرفر"
ok "متصل — $(sh_ 'hostname; uname -m' | tr '\n' ' ')"

step "3/8 فحوصات على السيرفر"

# الديمو بيصفّر ١:٠٠ وبيبني ١:٣٠ — بناءين مع بعض على الرام دي = الاتنين يقعوا
SRV_TIME="$(sh_ 'date "+%H:%M"')"
H="${SRV_TIME%%:*}"; MI="${SRV_TIME##*:}"; NOW=$((10#$H * 60 + 10#$MI))
if [ "$NOW" -ge 45 ] && [ "$NOW" -le 150 ]; then
  fail "وقت السيرفر $SRV_TIME — ده جوه نافذة الديمو (١٢:٤٥–٢:٣٠).
   الديمو بيصفّر ١:٠٠ وبيبني ١:٣٠، وبناءين مع بعض هيوقّعوا الاتنين. استنى شوية."
fi
ok "وقت السيرفر $SRV_TIME — بره نافذة الديمو"

for p in "$PORT" "$WHATSAPP_PORT"; do
  sh_ "ss -ltn | grep -q ':$p '" && fail "البورت $p مشغول على السيرفر" || true
done
ok "البورتات $PORT و $WHATSAPP_PORT فاضية"

DEMO_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://demo.fitboost.website || echo 000)"
[ "$DEMO_CODE" = "200" ] || echo -e "  \033[1;33m⚠️\033[0m  الديمو رد $DEMO_CODE (المفروض 200) — كمّل بحذر"
[ "$DEMO_CODE" = "200" ] && ok "الديمو شغال (200)" || true

DISK="$(sh_ "df -BG --output=avail / | tail -1 | tr -dc '0-9'")"
[ "$DISK" -ge 5 ] || fail "مساحة القرص ${DISK}GB بس — مش كفاية"
ok "مساحة القرص ${DISK}GB"

# ═══════════════════════════════ رفع الداتابيز ══════════════════════
if [ "$FRESH" != "1" ]; then
  step "4/8 رفع الداتابيز"
  TMP="$(mktemp -u /tmp/$SLUG-upload-XXXXXX.db)"
  # ⚠️ مش cp — نسخ ملف SQLite في وضع WAL ممكن يضيّع آخر معاملات
  sqlite3 "$ROOT/$LOCAL_DB" ".backup '$TMP'"
  [ "$(sqlite3 "$TMP" 'PRAGMA quick_check;')" = "ok" ] || fail "النسخة طلعت تالفة"
  ok "نسخة متسقة اتعملت ($(du -h "$TMP" | cut -f1))"
  scp "${SSH_OPTS[@]}" -q "$TMP" "$SSH_USER@$SERVER:$STAGE"
  rm -f "$TMP"
  sh_ "[ \"\$(sqlite3 '$STAGE' 'PRAGMA quick_check;')\" = ok ]" \
    || fail "الملف وصل تالف — جرّب تاني"
  ok "وصلت للسيرفر سليمة → $STAGE"
else
  step "4/8 رفع الداتابيز — متخطّاة (FRESH=1)"
fi

# ═══════════════════════════════ التنصيب ════════════════════════════
step "5/8 التنصيب (٥–١٥ دقيقة — البناء بياخد وقت)"
SEED_ARG=""
[ "$FRESH" != "1" ] && SEED_ARG="SEED_DB='$STAGE'"
sh_ "set -e
  rm -rf /tmp/fitboost-kit
  git clone --depth 1 -b '$BRANCH' '$REPO' /tmp/fitboost-kit
  cd /tmp/fitboost-kit
  $SEED_ARG SLUG='$SLUG' PORT='$PORT' WHATSAPP_PORT='$WHATSAPP_PORT' DB_FILE='$DB_FILE' \
    bash deploy/setup-gym.sh '$DOMAIN' '$GYM_NAME'
" || fail "التنصيب فشل — شوف الرسايل فوق. للتراجع: ROLLBACK=1 bash deploy/deploy-gym-remote.sh"

# ═══════════════════════════════ التحقق ═════════════════════════════
step "6/8 التحقق من الخدمات"
sh_ "pm2 list | grep -E '$APP_NAME|fitboost-beta'" || true
sh_ "pm2 describe '$APP_NAME' >/dev/null 2>&1" || fail "عملية $APP_NAME مش موجودة"
sh_ "pm2 describe '$APP_NAME-whatsapp' >/dev/null 2>&1" || fail "عملية الواتساب مش موجودة"
ok "العمليتين شغالين"

WA="$(sh_ "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$WHATSAPP_PORT/status/all" || echo 000)"
if [ "$WA" = "200" ]; then ok "خدمة الواتساب رادّة على $WHATSAPP_PORT"
else echo -e "  \033[1;33m⚠️\033[0m  الواتساب رد $WA — شوف: pm2 logs $APP_NAME-whatsapp"; fi

step "7/8 التحقق من الداتا"
if [ "$FRESH" != "1" ]; then
  read -r M2 R2 U2 <<<"$(sh_ "sqlite3 -separator ' ' '$APP_DIR/prisma/$DB_FILE' \
    'select (select count(*) from Member),(select count(*) from Receipt),(select count(*) from User);'")"
  echo "  قبل الرفع : $M عضو · $R إيصال · $U حساب"
  echo "  بعد الرفع : $M2 عضو · $R2 إيصال · $U2 حساب"
  if [ "$M" = "$M2" ] && [ "$R" = "$R2" ] && [ "$U" = "$U2" ]; then
    ok "الأعداد مطابقة"
  else
    echo -e "  \033[1;33m⚠️\033[0m  الأعداد اتغيّرت بعد مزامنة السكيما!"
    echo "     في نسخة: $APP_DIR/prisma/$DB_FILE.bak-before-schema-sync"
  fi
fi
if sh_ "[ \"\$(sqlite3 '$APP_DIR/prisma/$DB_FILE' 'PRAGMA quick_check;')\" = ok ]"; then
  ok "الداتابيز سليمة على السيرفر"
else fail "الداتابيز على السيرفر مش سليمة — راجع قبل ما تستخدمها"; fi

step "8/8 التحقق من الموقع والديمو"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "https://$DOMAIN" || echo 000)"
case "$CODE" in
  200|302|307) ok "https://$DOMAIN رد $CODE — الشهادة شغالة" ;;
  000) echo -e "  \033[1;33m⚠️\033[0m  مفيش رد — الشهادة ممكن تاخد دقيقة، جرّب تاني بعد شوية" ;;
  *)   echo -e "  \033[1;33m⚠️\033[0m  رد $CODE — شوف: journalctl -u caddy -n 30" ;;
esac

DEMO2="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://demo.fitboost.website || echo 000)"
[ "$DEMO2" = "200" ] || fail "⚠️ الديمو رد $DEMO2 بعد التنصيب — راجع فوراً!"
ok "الديمو لسه شغال (200)"

# نظّف نسخة الداتابيز المؤقتة من السيرفر — مالهاش لازمة بعد النقل
if [ "$FRESH" != "1" ]; then sh_ "rm -f '$STAGE'"; ok "اتمسحت النسخة المؤقتة من السيرفر"; fi

cat <<EOF

$(printf '\033[1;32m')✅ خلص.$(printf '\033[0m')

   🔗 https://$DOMAIN
   👤 الدخول بحسابات الجيم اللي كانت في الداتابيز

   📱 لربط الواتساب:
      الإعدادات → واتساب → اربط رقم، وامسح الـ QR من موبايل الجيم
      (واتساب → الأجهزة المرتبطة → ربط جهاز)

   💾 نسخة احتياطية يومية ٣ الفجر في /var/backups/$APP_NAME

   أوامر على السيرفر:
     pm2 logs $APP_NAME
     pm2 logs $APP_NAME-whatsapp
     APP_DIR=$APP_DIR $APP_DIR/deploy/update-gym.sh
EOF
