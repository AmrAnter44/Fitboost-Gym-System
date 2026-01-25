# v1.1.4 - Fix Production JWT Authentication 🔐

## Critical Fix
Fixed 401 Unauthorized errors that occurred ONLY in production/port forwarding environments.

## Root Cause
Next.js standalone builds don't automatically load `.env` files, causing JWT_SECRET to fall back to default value. This created a mismatch between tokens signed in dev vs production.

## Solution
- ✅ Created `standalone-server.js` wrapper that manually reads and parses `.env` file
- ✅ Wrapper loads environment variables into `process.env` before starting Next.js server
- ✅ Updated build process to copy wrapper to standalone folder
- ✅ Updated production startup script to use wrapper as entry point

## What This Fixes
- 401 Unauthorized errors on `/api/auth/me`
- 401 errors on `/api/receipts` and other protected endpoints
- Admin users unable to access `/members` page in production
- "ليس لديك صلاحية" (No permission) errors despite having correct permissions

## Verification Steps
After deploying this version:
1. Clear browser localStorage/cookies
2. Login again with your credentials
3. Navigate to `/members` or other protected pages
4. Should now work without 401 errors

## Technical Details
The wrapper logs loaded environment variables on startup for debugging:
- ✅ JWT_SECRET: Set (first 10 chars shown)
- ✅ DATABASE_URL: Set
- ✅ NODE_ENV: production
- ✅ NEXT_PUBLIC_DOMAIN: Set

If you see "⚠️ Warning: .env file not found", check that `.env` file exists in the standalone folder.

---

**Full Changelog**: https://github.com/AmrAnter44/sys-Xgym/compare/v1.1.3...v1.1.4
