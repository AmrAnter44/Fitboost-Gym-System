#!/bin/bash

# 🚀 سكريبت سريع لإصلاح مشاكل الداتابيز الشائعة
# الاستخدام: bash scripts/quick-fix-db.sh

# ألوان للطباعة
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # بدون لون

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🔧 سكريبت سريع لإصلاح مشاكل الداتابيز${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# الانتقال لمجلد المشروع
cd "$(dirname "$0")/.." || exit

DB_PATH="./prisma/gym.db"

# فحص وجود الداتابيز
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ الداتابيز غير موجودة في: $DB_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✅ الداتابيز موجودة${NC}"

# 1. إزالة extended attributes (macOS فقط)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "\n${YELLOW}🧹 إزالة extended attributes...${NC}"
    xattr -rc ./prisma/ 2>/dev/null && echo -e "${GREEN}✅ تم${NC}" || echo -e "${YELLOW}⚠️  تخطي${NC}"
fi

# 2. ضبط الصلاحيات
echo -e "\n${YELLOW}🔐 ضبط صلاحيات الملفات...${NC}"
chmod -R 755 ./prisma/ 2>/dev/null
chmod 644 ./prisma/*.db 2>/dev/null
echo -e "${GREEN}✅ تم${NC}"

# 3. حذف ملفات WAL و SHM القديمة
echo -e "\n${YELLOW}🗑️  حذف ملفات WAL/SHM المؤقتة...${NC}"
rm -f ./prisma/gym.db-wal 2>/dev/null
rm -f ./prisma/gym.db-shm 2>/dev/null
echo -e "${GREEN}✅ تم${NC}"

# 4. إنشاء نسخة احتياطية
BACKUP_NAME="gym.db.backup.$(date +%Y%m%d_%H%M%S)"
echo -e "\n${YELLOW}💾 إنشاء نسخة احتياطية...${NC}"
cp "$DB_PATH" "./prisma/$BACKUP_NAME"
echo -e "${GREEN}✅ تم: $BACKUP_NAME${NC}"

# 5. توليد Prisma Client
echo -e "\n${YELLOW}⚙️  توليد Prisma Client...${NC}"
npx prisma generate > /dev/null 2>&1 && echo -e "${GREEN}✅ تم${NC}" || echo -e "${RED}❌ فشل${NC}"

# 6. فحص الاتصال بالداتابيز
echo -e "\n${YELLOW}🔍 فحص الاتصال بالداتابيز...${NC}"
if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ الاتصال ناجح${NC}"
else
    echo -e "${RED}❌ فشل الاتصال${NC}"
    exit 1
fi

# 7. حذف .next cache
if [ -d ".next" ]; then
    echo -e "\n${YELLOW}🗑️  حذف Next.js cache...${NC}"
    rm -rf .next
    echo -e "${GREEN}✅ تم${NC}"
fi

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ انتهى الإصلاح بنجاح!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n${YELLOW}💡 يمكنك الآن تشغيل السيرفر:${NC}"
echo -e "   ${GREEN}npm run dev${NC}\n"
