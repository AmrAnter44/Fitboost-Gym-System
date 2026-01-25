# v1.1.4 - Fix Cookie Secure Flag for HTTP Sites 🔐

## CRITICAL FIX - 401 Unauthorized Errors Resolved

Fixed 401 Unauthorized errors that occurred ONLY in production/port forwarding environments.

## Root Cause Discovery

After multiple fix attempts, the **real root cause** was discovered:

1. **Site runs on HTTP** (not HTTPS): `http://system.xgym.website`
2. **Cookies were set with `secure: true`** when `NODE_ENV=production`
3. **Browsers refuse to send secure cookies over HTTP** connections
4. **Result**: `auth-token` cookie never sent to server → 401 errors

This is why it worked in dev (NODE_ENV=development, secure=false) but failed in production!

## Solution

**Primary Fix - Cookie Secure Flag:**
- Changed cookie `secure` flag to check `NEXT_PUBLIC_APP_URL` protocol instead of `NODE_ENV`
- `secure: true` only on HTTPS sites (`https://`)
- `secure: false` on HTTP sites (`http://`)
- Cookies now work correctly on both HTTP and HTTPS

**Secondary Fix - Enhanced .env Loading:**
- Created `standalone-server.js` wrapper with detailed logging
- Manually loads `.env` file before starting Next.js server
- Shows which environment variables are loaded
- Helps debug environment issues in production

## Changes Made

### Modified Files:
- `app/api/auth/login/route.ts` - Fixed cookie secure flag
- `app/api/auth/me/route.ts` - Fixed cookie secure flag for clearing
- `standalone-server.js` - New wrapper with enhanced logging
- `package.json` - Updated to v1.1.4, copy wrapper to standalone
- `start-production.bat` - Use wrapper as entry point

## What This Fixes

✅ 401 Unauthorized errors on `/api/auth/me`
✅ 401 Unauthorized errors on `/api/receipts` and other protected endpoints
✅ Admin users unable to access `/members` page in production
✅ "ليس لديك صلاحية" (No permission) errors despite having correct permissions
✅ Cookies not being sent over HTTP connections

## Deployment Steps

1. **Install/Extract the new v1.1.4 build**
2. **Run `start-production.bat`** - You'll see detailed logging:
   ```
   ========================================
     Standalone Server Wrapper v1.1.4
   ========================================

   📁 Current directory: C:\...\x gym\.next\standalone
   📄 Found .env file, loading...

     ✓ DATABASE_URL = file:./prisma/gym.db
     ✓ JWT_SECRET = [HIDDEN]
     ✓ PORT = 4001
     ✓ NODE_ENV = production
     ✓ NEXT_PUBLIC_APP_URL = http://system.xgym.website

   ✅ Loaded 6 environment variables from .env

   📊 Critical Environment Variables:
     → JWT_SECRET: ✅ SET (gym-secret-key...)
     → DATABASE_URL: ✅ SET
     → NODE_ENV: production
     → NEXT_PUBLIC_DOMAIN: system.xgym.website

   🚀 Starting Next.js standalone server...
   ```

3. **Clear browser cookies** (important!)
4. **Login again** with your admin credentials
5. **Navigate to `/members`** - Should work now!

## Why This Works

**Before (v1.1.3 and earlier):**
- Cookie header: `Set-Cookie: auth-token=xyz; Secure; HttpOnly; SameSite=Lax`
- Browser sees `Secure` flag
- Browser checks connection: HTTP (not HTTPS)
- Browser refuses to send cookie ❌
- Server sees no cookie → 401 Unauthorized

**After (v1.1.4):**
- Cookie header: `Set-Cookie: auth-token=xyz; HttpOnly; SameSite=Lax` (no Secure flag on HTTP)
- Browser sees no `Secure` flag required
- Browser sends cookie over HTTP ✅
- Server receives cookie → Authenticates successfully

## Security Note

When you move to HTTPS in the future:
1. Update `.env`: `NEXT_PUBLIC_APP_URL=https://system.xgym.website`
2. Rebuild the app
3. Cookies will automatically become secure again

---

**Full Changelog**: https://github.com/AmrAnter44/sys-Xgym/compare/v1.1.3...v1.1.4
