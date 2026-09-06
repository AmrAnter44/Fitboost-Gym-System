#!/usr/bin/env bash
# =====================================================================
# 💾 نسخة احتياطية يومية لجيم حقيقي
#
#   بينسخ:
#     - الداتابيز (بـ sqlite3 .backup — آمن والتطبيق شغال)
#     - جلسة الواتساب (من غيرها هتعيد مسح الـ QR بعد أي استرجاع)
#     - ملفات الرفع (صور الأعضاء) — مرة في الأسبوع، لأنها تقيلة
#
#   بيشتغل من الكرون كل يوم ٣ الفجر. للتشغيل اليدوي:
#     /opt/fitboost/deploy/backup-gym.sh
# =====================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/fitboost}"
DEST="${BACKUP_DIR:-/var/backups/fitboost}"
KEEP_DAYS="${KEEP_DAYS:-21}"
WA_DIR="${WA_DIR:-$HOME/.fitboost-whatsapp}"

STAMP="$(date +%F_%H%M)"
mkdir -p "$DEST"

# ── الداتابيز ────────────────────────────────────────────────────────
# `.backup` بيعمل نسخة متسقة والتطبيق شغال. نسخ الملف بـ cp مش آمن
# مع WAL — ممكن تطلع نسخة ناقصة.
# اسم الملف من DATABASE_URL — كل جيم ليه اسمه
DB="$(sed -n 's|^DATABASE_URL="*file:\([^?"]*\).*|\1|p' "$APP_DIR/.env" 2>/dev/null | head -1)"
DB="${DB:-$APP_DIR/prisma/gym.db}"
if [ -f "$DB" ]; then
  sqlite3 "$DB" ".backup '$DEST/$(basename "$DB" .db)-$STAMP.db'"
  # نتأكد إن النسخة سليمة قبل ما نعتمد عليها
  if [ "$(sqlite3 "$DEST/$(basename "$DB" .db)-$STAMP.db" 'PRAGMA quick_check;' 2>&1)" != "ok" ]; then
    echo "$(date '+%F %T') ❌ النسخة طلعت تالفة — اتمسحت" >&2
    rm -f "$DEST/$(basename "$DB" .db)-$STAMP.db"
    exit 1
  fi
  gzip -f "$DEST/$(basename "$DB" .db)-$STAMP.db"
  echo "$(date '+%F %T') ✓ داتابيز: $(basename "$DB" .db)-$STAMP.db.gz ($(du -h "$DEST/$(basename "$DB" .db)-$STAMP.db.gz" | cut -f1))"
else
  echo "$(date '+%F %T') ⚠️  مالقيتش $DB" >&2
fi

# ── جلسة الواتساب ────────────────────────────────────────────────────
if [ -d "$WA_DIR" ]; then
  tar -czf "$DEST/whatsapp-$STAMP.tar.gz" -C "$(dirname "$WA_DIR")" "$(basename "$WA_DIR")"
  echo "$(date '+%F %T') ✓ جلسة واتساب: whatsapp-$STAMP.tar.gz"
fi

# ── ملفات الرفع (أسبوعياً — يوم الأحد) ───────────────────────────────
if [ -d "$APP_DIR/uploads" ] && [ "$(date +%u)" = "7" ]; then
  tar -czf "$DEST/uploads-$STAMP.tar.gz" -C "$APP_DIR" uploads
  echo "$(date '+%F %T') ✓ ملفات الرفع: uploads-$STAMP.tar.gz"
fi

# ── تنظيف القديم ─────────────────────────────────────────────────────
find "$DEST" -name '*.db.gz'       -mtime "+$KEEP_DAYS" -delete
find "$DEST" -name 'whatsapp-*.tar.gz' -mtime "+$KEEP_DAYS" -delete
find "$DEST" -name 'uploads-*.tar.gz'  -mtime +60           -delete

echo "$(date '+%F %T') ✓ خلص — $(ls -1 "$DEST" | wc -l) ملف في $DEST"
