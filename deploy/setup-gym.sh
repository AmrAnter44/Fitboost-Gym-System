#!/usr/bin/env bash
# =====================================================================
# 🏋️ تنصيب FitBoost لجيم حقيقي — بيشتغل على سيرفر فاضي أو جنب الديمو
#
#   الاستخدام (كـ root على Ubuntu 22.04 / 24.04):
#     bash setup-gym.sh gym.example.com "اسم الجيم"
#
#   متغيرات اختيارية:
#     SLUG=elnour            اسم النسخة (بيحدد المجلد وأسماء PM2)
#     PORT=4011              بورت التطبيق
#     WHATSAPP_PORT=4012     بورت خدمة الواتساب
#     DB_FILE=helmyapoint.db اسم ملف الداتابيز (الافتراضي <slug>.db)
#     SEED_DB=/root/x.db     داتابيز جاهزة تتنقل بدل ما نبدأ فاضي
#                            (ارفعها بـ scp الأول — شوف README-GYM.md)
#     OWNER_EMAIL=owner@gym.com
#     BRANCH=main
#
#   قبل ما تشغّله: وجّه A record للدومين على IP السيرفر (عشان Caddy يجيب SSL).
#
#   ⚠️ السكربت ده آمن مع نسخ تانية على نفس السيرفر:
#      - بيكتب بلوك Caddy في /etc/caddy/sites/ ومابيدوسش على الـ Caddyfile
#      - بيتأكد إن البورتات مش مشغولة قبل ما يبدأ
#      - أسماء PM2 ومجلد الجلسات مشتقّة من SLUG
# =====================================================================
set -euo pipefail

DOMAIN="${1:-}"
GYM_NAME="${2:-جيم}"
REPO="${REPO:-https://github.com/AmrAnter44/Fitboost-Gym-System.git}"
BRANCH="${BRANCH:-main}"

step() { echo -e "\n\033[1;36m=== $* ===\033[0m"; }
fail() { echo -e "\033[1;31m❌ $*\033[0m" >&2; exit 1; }
note() { echo -e "\033[1;33m   $*\033[0m"; }

[ -n "$DOMAIN" ] || fail "لازم تمرر الدومين:  bash setup-gym.sh gym.example.com \"اسم الجيم\""
[ "$(id -u)" = "0" ] || fail "شغّل السكربت كـ root (أو بـ sudo)"

# اسم النسخة من أول جزء في الدومين لو مامرّرتش SLUG
SLUG="${SLUG:-$(echo "$DOMAIN" | cut -d. -f1 | tr -cd 'a-zA-Z0-9-')}"
APP_NAME="fitboost-$SLUG"
APP_DIR="${APP_DIR:-/opt/$APP_NAME}"
PORT="${PORT:-4011}"
WHATSAPP_PORT="${WHATSAPP_PORT:-4012}"
OWNER_EMAIL="${OWNER_EMAIL:-owner@$DOMAIN}"
# اسم ملف الداتابيز — باسم الجيم عشان ماتلخبطش مع نسخة تانية على نفس السيرفر
DB_FILE="${DB_FILE:-$SLUG.db}"
MADE_OWNER=0   # بيبقى 1 بس لو عملنا داتابيز فاضية وحساب أونر جديد

echo "النسخة   : $APP_NAME"
echo "المجلد   : $APP_DIR"
echo "البورتات : تطبيق $PORT / واتساب $WHATSAPP_PORT"
echo "الداتابيز: prisma/$DB_FILE"

step "1/11 فحص التعارضات"
# لو البورت مشغول بنسخة تانية، أحسن نقف دلوقتي بدل ما نكتشف بعد البناء
for p in "$PORT" "$WHATSAPP_PORT"; do
  if ss -ltn 2>/dev/null | grep -q ":$p "; then
    fail "البورت $p مشغول بالفعل. مرّر PORT/WHATSAPP_PORT مختلفين، مثلاً: PORT=4021 WHATSAPP_PORT=4022 bash setup-gym.sh $DOMAIN"
  fi
done
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  note "في نسخة PM2 باسم $APP_NAME موجودة — هتتستبدل."
fi
echo "✓ البورتات فاضية"

step "2/11 حزم النظام الأساسية"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg ufw cron iproute2 \
  build-essential python3 pkg-config debian-keyring debian-archive-keyring apt-transport-https \
  libx11-dev libxtst-dev libxkbcommon-dev sqlite3

step "3/11 مساحة swap (بناء Next محتاج رام)"
SWAP_KB="$(awk '/SwapTotal/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
if [ "${SWAP_KB:-0}" -lt 3000000 ]; then
  if [ ! -f /swapfile ]; then
    fallocate -l 4G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
    swapon /swapfile
    grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "✓ اتضافت swap 4GB (كان فيه $((SWAP_KB/1024))MB بس)"
  else
    swapon /swapfile 2>/dev/null || true
    echo "✓ /swapfile موجود بالفعل"
  fi
else
  echo "✓ في swap كفاية ($((SWAP_KB/1024))MB)"
fi

step "4/11 Node.js 20 + PM2"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2 --silent
echo "✓ node $(node -v) / npm $(npm -v) / $(uname -m)"

step "5/11 Caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi
echo "✓ $(caddy version | head -1)"

step "6/11 جلب الكود"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  git clone --depth 1 -b "$BRANCH" "$REPO" "$APP_DIR"
fi
mkdir -p "$APP_DIR/uploads" "$APP_DIR/logs" "$APP_DIR/.whatsapp-auth"
cd "$APP_DIR"

step "7/11 إعداد .env"
# لازم يتعمل قبل الـ build: UPLOADS_PATH بيتقرا وقت البناء في next.config
if [ ! -f "$APP_DIR/.env" ]; then
  JWT="$(openssl rand -hex 64)"
  TOKEN="$(openssl rand -hex 32)"
  sed -e "s|gym\.example\.com|$DOMAIN|g" \
      -e "s|REPLACE_ME_WITH_RANDOM_128_HEX_CHARS|$JWT|" \
      -e "s|REPLACE_ME_WITH_RANDOM_64_HEX_CHARS|$TOKEN|" \
      -e "s|^APP_NAME=.*|APP_NAME=$APP_NAME|" \
      -e "s|^PORT=.*|PORT=$PORT|" \
      -e "s|^WHATSAPP_PORT=.*|WHATSAPP_PORT=$WHATSAPP_PORT|" \
      -e "s|helmyapoint\.db|$DB_FILE|g" \
      -e "s|/opt/fitboost-gym|$APP_DIR|g" \
      deploy/env.gym.example > "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  echo "✓ اتعمل .env بأسرار عشوائية (JWT_SECRET + INTERNAL_API_TOKEN)"
else
  echo "✓ .env موجود بالفعل — سايبه زي ما هو"
  grep -q '^INTERNAL_API_TOKEN=' "$APP_DIR/.env" \
    || fail "الـ .env مفيهوش INTERNAL_API_TOKEN — الواتساب مش هيشتغل من غيره. ضيفه: echo \"INTERNAL_API_TOKEN=\$(openssl rand -hex 32)\" >> $APP_DIR/.env"
fi

step "8/11 تنصيب الحزم"
# devDependencies مطلوبة للبناء. مش محتاجين بايناريز إلكترون ولا متصفحات
# Playwright — الواتساب هنا بـ Baileys (WebSocket) مش متصفح.
ELECTRON_SKIP_BINARY_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 NEXT_TELEMETRY_DISABLED=1 \
  npm ci --include=dev --no-audit --no-fund

step "9/11 تجهيز الداتابيز + البناء"
# الداتا الأول: `next build` ممكن يلمس الداتابيز أثناء توليد الصفحات
npx prisma generate

# لو في داتابيز جاهزة اترفعت للسيرفر، ننقلها قبل أي حاجة
if [ ! -f "$APP_DIR/prisma/$DB_FILE" ] && [ -n "${SEED_DB:-}" ]; then
  [ -f "$SEED_DB" ] || fail "SEED_DB=$SEED_DB مش موجود على السيرفر — ارفعه بـ scp الأول"
  [ "$(sqlite3 "$SEED_DB" 'PRAGMA quick_check;' 2>&1)" = "ok" ] \
    || fail "الداتابيز اللي في SEED_DB تالفة — مانقلتش حاجة"
  cp "$SEED_DB" "$APP_DIR/prisma/$DB_FILE"
  echo "✓ اتنقلت داتا الجيم من $SEED_DB ($(du -h "$SEED_DB" | cut -f1))"
fi

if [ ! -f "$APP_DIR/prisma/$DB_FILE" ]; then
  npx prisma db push --skip-generate --accept-data-loss
  node scripts/bootstrap-gym.js --gym="$GYM_NAME" --email="$OWNER_EMAIL" \
    | tee "$APP_DIR/logs/owner-credentials.txt"
  chmod 600 "$APP_DIR/logs/owner-credentials.txt"
  MADE_OWNER=1
else
  # ⚠️ `db push --accept-data-loss` بيخلّي الداتابيز تطابق السكيما، فأي عمود
  #    أو جدول زيادة فيها بيتشال. بناخد نسخة قبلها — الاسترجاع أرخص من الندم.
  echo "✓ في داتابيز — بنزامن السكيما عليها"
  cp "$APP_DIR/prisma/$DB_FILE" "$APP_DIR/prisma/$DB_FILE.bak-before-schema-sync"
  npx prisma db push --skip-generate --accept-data-loss
  echo "  (نسخة قبل المزامنة: prisma/$DB_FILE.bak-before-schema-sync)"
fi
NODE_OPTIONS="--max-old-space-size=2048" npm run build

step "10/11 Caddy + تشغيل الخدمتين"
# ⚠️ مابنكتبش على /etc/caddy/Caddyfile — ممكن يكون فيه الديمو أو جيم تاني.
# بنحط بلوك النسخة دي في ملف لوحده وبنضمن إن الـ Caddyfile بيعمله import.
mkdir -p /etc/caddy/sites
sed "s|gym\.example\.com|$DOMAIN|g; s|4001|$PORT|g" \
  deploy/Caddyfile.gym > "/etc/caddy/sites/$DOMAIN.caddy"

if ! grep -q 'import sites/\*\.caddy' /etc/caddy/Caddyfile 2>/dev/null; then
  cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak-$(date +%F_%H%M)" 2>/dev/null || true
  printf '\nimport sites/*.caddy\n' >> /etc/caddy/Caddyfile
  echo "✓ اتضاف import للـ Caddyfile (اتاخد منه نسخة احتياطية)"
fi

caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null \
  || fail "إعدادات Caddy فيها خطأ — مالمستش الخدمة. راجع /etc/caddy/sites/$DOMAIN.caddy"
mkdir -p /var/log/caddy && chown -R caddy:caddy /var/log/caddy
systemctl reload caddy

pm2 delete "$APP_NAME" "$APP_NAME-whatsapp" >/dev/null 2>&1 || true
pm2 start deploy/ecosystem.gym.config.js
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null

step "11/11 النسخ الاحتياطي + الجدار الناري"
chmod +x deploy/backup-gym.sh deploy/update-gym.sh 2>/dev/null || true
mkdir -p "/var/backups/$APP_NAME"
CRON_LINE="0 3 * * * APP_DIR=$APP_DIR BACKUP_DIR=/var/backups/$APP_NAME WA_DIR=$APP_DIR/.whatsapp-auth $APP_DIR/deploy/backup-gym.sh >> $APP_DIR/logs/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v "$APP_DIR/deploy/backup-gym.sh" ; echo "$CRON_LINE" ) | crontab -

ufw allow OpenSSH >/dev/null
ufw allow 80/tcp  >/dev/null
ufw allow 443/tcp >/dev/null
# $PORT و $WHATSAPP_PORT مش متعرضين عن قصد — الاتنين سامعين على 127.0.0.1 بس
ufw --force enable >/dev/null

sleep 4
WA_STATUS="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$WHATSAPP_PORT/status/all" || echo 000)"

cat <<EOF

✅ خلص التنصيب.

   🔗 الرابط:     https://$DOMAIN
$(if [ "$MADE_OWNER" = "1" ]; then cat <<OWNER
   👤 الأونر:     $OWNER_EMAIL
   🔑 الباسورد:   في $APP_DIR/logs/owner-credentials.txt
                  (احفظه وغيّره من الإعدادات، وبعدين امسح الملف)
OWNER
else cat <<KEPT
   👤 الدخول:     بحسابات الجيم اللي كانت في الداتابيز المرفوعة
                  (مااتعملش حساب جديد ومااتغيّرش أي باسورد)
KEPT
fi)

   📱 الواتساب:   $([ "$WA_STATUS" = "200" ] && echo "شغال ✓ على البورت $WHATSAPP_PORT" || echo "لسه بيقوم (كود $WA_STATUS) — شوف: pm2 logs $APP_NAME-whatsapp")
                  للربط: ادخل بحساب الأونر → الإعدادات → واتساب → اربط رقم
                  وامسح الـ QR من موبايل الجيم (واتساب → الأجهزة المرتبطة).

   💾 نسخة احتياطية يومية ٣ الفجر في /var/backups/$APP_NAME

   أوامر مفيدة:
     pm2 status                         # كل النسخ على السيرفر
     pm2 logs $APP_NAME                 # لوجات التطبيق
     pm2 logs $APP_NAME-whatsapp        # لوجات الواتساب
     pm2 restart $APP_NAME-whatsapp     # إعادة تشغيل الواتساب لوحده
     $APP_DIR/deploy/backup-gym.sh      # نسخة احتياطية فوراً
     APP_DIR=$APP_DIR $APP_DIR/deploy/update-gym.sh   # تحديث لآخر كود
EOF
