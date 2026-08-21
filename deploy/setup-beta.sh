#!/usr/bin/env bash
# =====================================================================
# 🚀 تنصيب النسخة التجريبية (البيتا) من FitBoost على سيرفر Ubuntu نظيف
#
#   الاستخدام (كـ root على Ubuntu 22.04 / 24.04):
#     bash setup-beta.sh beta.example.com
#
#   متغيرات اختيارية:
#     MEMBERS=200 DEMO_PASSWORD=xxxx BRANCH=main bash setup-beta.sh beta.example.com
#
#   قبل ما تشغّله: وجّه A record للدومين على IP السيرفر (عشان Caddy يجيب SSL).
# =====================================================================
set -euo pipefail

DOMAIN="${1:-}"
REPO="${REPO:-https://github.com/AmrAnter44/Fitboost-Gym-System.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/fitboost-beta}"
MEMBERS="${MEMBERS:-150}"
DEMO_PASSWORD="${DEMO_PASSWORD:-demo1234}"

step() { echo -e "\n\033[1;36m=== $* ===\033[0m"; }
fail() { echo -e "\033[1;31m❌ $*\033[0m" >&2; exit 1; }

[ -n "$DOMAIN" ] || fail "لازم تمرر الدومين:  bash setup-beta.sh beta.example.com"
[ "$(id -u)" = "0" ] || fail "شغّل السكربت كـ root (أو بـ sudo)"

step "1/9 حزم النظام الأساسية"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg ufw cron \
  build-essential python3 pkg-config debian-keyring debian-archive-keyring apt-transport-https \
  libx11-dev libxtst-dev libxkbcommon-dev sqlite3

step "2/9 مساحة swap (بناء Next محتاج رام)"
# بعض المزودين بيدّوا swap صغيرة (1GB) — مش كفاية للبناء على سيرفر بكور واحد.
# بنضمن إجمالي ~4GB على الأقل بدل ما نتخطى الخطوة لمجرد وجود أي swap.
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

step "3/9 Node.js 20 + PM2"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
npm install -g pm2 --silent
echo "✓ node $(node -v) / npm $(npm -v)"

step "4/9 Caddy (HTTPS تلقائي)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi
echo "✓ $(caddy version | head -1)"

step "5/9 جلب الكود"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  git clone --depth 1 -b "$BRANCH" "$REPO" "$APP_DIR"
fi
mkdir -p "$APP_DIR/uploads" "$APP_DIR/logs"
cd "$APP_DIR"

step "6/9 إعداد .env"
if [ ! -f "$APP_DIR/.env" ]; then
  JWT="$(openssl rand -hex 64)"
  sed -e "s|beta\.example\.com|$DOMAIN|g" \
      -e "s|REPLACE_ME_WITH_RANDOM_128_HEX_CHARS|$JWT|" \
      -e "s|/opt/fitboost-beta|$APP_DIR|g" \
      deploy/env.beta.example > "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  echo "✓ اتعمل .env بـ JWT_SECRET عشوائي"
else
  echo "✓ .env موجود بالفعل — سايبه زي ما هو"
fi

step "7/9 تنصيب الحزم"
# devDependencies مطلوبة للبناء (typescript/tailwind)، بس مش محتاجين بايناريز
# الإلكترون ولا متصفحات Playwright على السيرفر — توفير وقت ومساحة.
ELECTRON_SKIP_BINARY_DOWNLOAD=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 NEXT_TELEMETRY_DISABLED=1 \
  npm ci --include=dev --no-audit --no-fund

step "8/9 توليد البيانات التجريبية + بناء النظام"
# الداتا الأول: `next build` ممكن يلمس الداتابيز أثناء توليد الصفحات
if [ ! -f "$APP_DIR/prisma/demo-seed.db" ]; then
  node scripts/seed-demo-data.js --out=prisma/gym.db --force \
    --members="$MEMBERS" --password="$DEMO_PASSWORD"
  cp prisma/gym.db prisma/demo-seed.db   # نسخة أصلية للـ reset اليومي
  echo "✓ اتولّدت داتا تجريبية ($MEMBERS عضو)"
else
  echo "✓ في داتا تجريبية بالفعل — سايبها"
fi
NODE_OPTIONS="--max-old-space-size=2048" npm run build

step "9/9 تشغيل الخدمة + Caddy + الجدار الناري"
sed "s|beta\.example\.com|$DOMAIN|g" deploy/Caddyfile.beta > /etc/caddy/Caddyfile
mkdir -p /var/log/caddy && chown -R caddy:caddy /var/log/caddy
systemctl reload caddy || systemctl restart caddy

pm2 delete fitboost-beta >/dev/null 2>&1 || true
pm2 start deploy/ecosystem.beta.config.js
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null

# إعادة تعيين الداتا التجريبية كل يوم 4 الفجر
chmod +x deploy/reset-demo.sh deploy/update-beta.sh
CRON_LINE="0 4 * * * $APP_DIR/deploy/reset-demo.sh >> $APP_DIR/logs/reset.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'reset-demo.sh' ; echo "$CRON_LINE" ) | crontab -

ufw allow OpenSSH >/dev/null
ufw allow 80/tcp  >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

cat <<EOF

✅ خلص التنصيب.

   🔗 الرابط:    https://$DOMAIN
   👤 الحسابات:  owner@demo.local / manager@demo.local / reception@demo.local
                 coach@demo.local / sales@demo.local
   🔑 الباسورد:  $DEMO_PASSWORD

   الداتا التجريبية بترجع لأصلها كل يوم 4 الفجر تلقائياً.

   أوامر مفيدة:
     pm2 logs fitboost-beta        # اللوجات
     pm2 restart fitboost-beta     # إعادة تشغيل
     $APP_DIR/deploy/update-beta.sh   # تحديث البيتا لآخر كود
     $APP_DIR/deploy/reset-demo.sh    # تصفير الداتا التجريبية فوراً
EOF
