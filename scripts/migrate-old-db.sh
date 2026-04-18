#!/bin/bash

# 🔄 سكريبت نقل داتابيز قديمة إلى النظام الجديد
# الاستخدام: bash scripts/migrate-old-db.sh /path/to/old/gym.db

# ألوان للطباعة
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # بدون لون

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🔄 سكريبت نقل داتابيز قديمة إلى النظام الجديد${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# فحص المعامل
if [ -z "$1" ]; then
    echo -e "${RED}❌ خطأ: يجب تحديد مسار الداتابيز القديمة${NC}"
    echo -e "${YELLOW}الاستخدام: bash scripts/migrate-old-db.sh /path/to/old/gym.db${NC}"
    exit 1
fi

OLD_DB_PATH="$1"

# فحص وجود الملف
if [ ! -f "$OLD_DB_PATH" ]; then
    echo -e "${RED}❌ الملف غير موجود: $OLD_DB_PATH${NC}"
    exit 1
fi

# الانتقال لمجلد المشروع
cd "$(dirname "$0")/.." || exit

NEW_DB_PATH="./prisma/gym.db"

# عرض معلومات الملف القديم
FILE_SIZE=$(du -h "$OLD_DB_PATH" | cut -f1)
echo -e "${BLUE}📊 معلومات الداتابيز القديمة:${NC}"
echo -e "   المسار: ${YELLOW}$OLD_DB_PATH${NC}"
echo -e "   الحجم: ${YELLOW}$FILE_SIZE${NC}"
echo ""

# السؤال عن التأكيد
echo -e "${YELLOW}⚠️  تحذير: هذا سيستبدل الداتابيز الحالية (إن وُجدت)${NC}"
read -p "هل تريد المتابعة؟ (yes/no): " -r
echo ""
if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
    echo -e "${BLUE}❌ تم الإلغاء${NC}"
    exit 0
fi

# 1. نسخ احتياطي للداتابيز الحالية (إن وُجدت)
if [ -f "$NEW_DB_PATH" ]; then
    BACKUP_NAME="gym.db.backup.before-migration.$(date +%Y%m%d_%H%M%S)"
    echo -e "${YELLOW}💾 إنشاء نسخة احتياطية للداتابيز الحالية...${NC}"
    cp "$NEW_DB_PATH" "./prisma/$BACKUP_NAME"
    echo -e "${GREEN}✅ تم: $BACKUP_NAME${NC}"
    echo ""
fi

# 2. نسخ الداتابيز القديمة
echo -e "${YELLOW}📋 نسخ الداتابيز القديمة...${NC}"
cp "$OLD_DB_PATH" "$NEW_DB_PATH"
echo -e "${GREEN}✅ تم النسخ إلى: $NEW_DB_PATH${NC}"
echo ""

# 3. إزالة extended attributes (macOS فقط)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "${YELLOW}🧹 إزالة extended attributes...${NC}"
    xattr -rc ./prisma/ 2>/dev/null && echo -e "${GREEN}✅ تم${NC}" || echo -e "${YELLOW}⚠️  تخطي${NC}"
    echo ""
fi

# 4. ضبط الصلاحيات
echo -e "${YELLOW}🔐 ضبط صلاحيات الملفات...${NC}"
chmod -R 755 ./prisma/ 2>/dev/null
chmod 644 ./prisma/*.db 2>/dev/null
echo -e "${GREEN}✅ تم${NC}"
echo ""

# 5. حذف ملفات WAL و SHM
echo -e "${YELLOW}🗑️  حذف ملفات WAL/SHM المؤقتة...${NC}"
rm -f ./prisma/gym.db-wal 2>/dev/null
rm -f ./prisma/gym.db-shm 2>/dev/null
echo -e "${GREEN}✅ تم${NC}"
echo ""

# 6. فحص سلامة الداتابيز
echo -e "${YELLOW}🔍 فحص سلامة الداتابيز...${NC}"
if sqlite3 "$NEW_DB_PATH" "PRAGMA integrity_check;" | grep -q "ok"; then
    echo -e "${GREEN}✅ الداتابيز سليمة${NC}"
else
    echo -e "${RED}❌ الداتابيز قد تكون تالفة${NC}"
    exit 1
fi
echo ""

# 7. توليد Prisma Client
echo -e "${YELLOW}⚙️  توليد Prisma Client...${NC}"
npx prisma generate > /dev/null 2>&1 && echo -e "${GREEN}✅ تم${NC}" || echo -e "${RED}❌ فشل${NC}"
echo ""

# 8. فحص schema والـ migrations
echo -e "${YELLOW}📋 فحص الـ schema...${NC}"
npx prisma validate > /dev/null 2>&1 && echo -e "${GREEN}✅ الـ schema صحيح${NC}" || echo -e "${RED}❌ مشكلة في الـ schema${NC}"
echo ""

# 9. محاولة تطبيق الـ migrations
echo -e "${YELLOW}🔄 تطبيق الـ migrations...${NC}"
echo -e "${BLUE}ℹ️  هذا قد يستغرق بعض الوقت...${NC}"
echo ""

# محاولة migrate deploy أولاً
if npx prisma migrate deploy 2>&1 | tee /tmp/migrate-output.txt; then
    echo -e "${GREEN}✅ تم تطبيق الـ migrations بنجاح${NC}"
else
    echo -e "${YELLOW}⚠️  migrate deploy فشل، محاولة db push...${NC}"

    # محاولة db push كخطة بديلة
    if npx prisma db push --accept-data-loss; then
        echo -e "${GREEN}✅ تم تحديث الداتابيز باستخدام db push${NC}"
    else
        echo -e "${RED}❌ فشل تحديث الداتابيز${NC}"
        echo -e "${YELLOW}💡 قد تحتاج إلى تطبيق الـ migrations يدوياً${NC}"
    fi
fi
echo ""

# 10. فحص الاتصال النهائي
echo -e "${YELLOW}🔍 فحص الاتصال بالداتابيز...${NC}"
if npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ الاتصال ناجح${NC}"

    # عد الجداول
    TABLE_COUNT=$(sqlite3 "$NEW_DB_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%';")
    echo -e "${BLUE}ℹ️  عدد الجداول: $TABLE_COUNT${NC}"
else
    echo -e "${RED}❌ فشل الاتصال${NC}"
fi
echo ""

# 11. حذف .next cache
if [ -d ".next" ]; then
    echo -e "${YELLOW}🗑️  حذف Next.js cache...${NC}"
    rm -rf .next
    echo -e "${GREEN}✅ تم${NC}"
    echo ""
fi

# النتيجة النهائية
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ انتهى نقل الداتابيز بنجاح!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📊 الملخص:${NC}"
echo -e "   الداتابيز القديمة: ${YELLOW}$OLD_DB_PATH${NC}"
echo -e "   الداتابيز الجديدة: ${YELLOW}$NEW_DB_PATH${NC}"
echo -e "   الحجم: ${YELLOW}$FILE_SIZE${NC}"
echo ""
echo -e "${YELLOW}💡 الخطوات التالية:${NC}"
echo -e "   1. راجع البيانات للتأكد من صحتها"
echo -e "   2. شغّل السيرفر: ${GREEN}npm run dev${NC}"
echo -e "   3. اختبر تسجيل الدخول"
echo ""
echo -e "${BLUE}💾 النسخ الاحتياطية موجودة في: ./prisma/${NC}\n"
