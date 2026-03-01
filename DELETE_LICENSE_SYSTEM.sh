#!/bin/bash

echo "🗑️  حذف نظام الترخيص بالكامل..."
echo ""

# حذف ملفات lib
echo "1️⃣ حذف lib/license.ts"
rm -f lib/license.ts
rm -f lib/license.ts.backup
rm -f lib/supabase.ts

# حذف contexts
echo "2️⃣ حذف contexts/LicenseContext.tsx"
rm -f contexts/LicenseContext.tsx

# حذف components
echo "3️⃣ حذف components/LicenseLockedScreen.tsx"
rm -f components/LicenseLockedScreen.tsx

# حذف API routes
echo "4️⃣ حذف API routes"
rm -rf app/api/license

# حذف test scripts
echo "5️⃣ حذف test scripts"
rm -f test-supabase-license.js
rm -f test-validate-license.mjs
rm -f test-api-license.js
rm -f test-update-db.mjs

# حذف documentation
echo "6️⃣ حذف documentation files"
rm -f LICENSE_SYSTEM_DOCUMENTATION.md
rm -f DEBUG_LICENSE.md
rm -f LICENSE_DEBUG_GUIDE.md
rm -f README_NEXT_STEPS.md
rm -f LICENSE_REBUILD_SUMMARY.md
rm -f OLD_VS_NEW_COMPARISON.md
rm -f FINAL_FIX_SUMMARY.md
rm -f FINAL_FIX.md
rm -f RESTART_REQUIRED.md
rm -f THEME_SYNC.md

echo ""
echo "✅ تم حذف جميع الملفات!"
echo ""
echo "⚠️  الآن يجب تعديل:"
echo "   - components/ClientLayout.tsx (إزالة LicenseProvider)"
echo "   - components/Navbar.tsx (إزالة زر الفحص)"
echo "   - prisma/schema.prisma (حذف SupabaseLicense model)"
echo "   - API routes (إزالة requireValidLicense)"
echo ""
