# Fix for "Cannot find module 'next'" Error

## Problem
When running the production Electron build on Windows, the app crashes with:
```
Error: Cannot find module 'next'
Require stack:
- C:\Program Files\Gym Management\resources\app.asar.unpacked\.next\standalone\server.js
```

## Root Cause
The Next.js standalone build includes a `node_modules` folder with minimal dependencies. However, electron-builder wasn't properly including or unpacking these node_modules, causing Node.js to be unable to find the 'next' module at runtime.

## Solutions Implemented

### 1. Updated electron-builder Configuration (package.json)
- Made the `files` array more explicit about including `.next/standalone/node_modules/**/*`
- Added specific patterns to include `.js`, `.json`, and `.node` files
- Added explicit `asarUnpack` patterns for:
  - `electron/**/*` - Ensures wrapper script can be executed
  - `.next/standalone/**/*` - Unpacks the entire standalone build
  - `.next/standalone/node_modules/**/*` - Explicitly unpacks node_modules
- Excluded unnecessary files (`.md`, `.ts`, test folders) to reduce build size

### 2. Created Server Wrapper Script (electron/server-wrapper.js)
- Validates that all required files exist before starting the server
- Sets up `NODE_PATH` environment variable to include standalone node_modules
- Reinitializes Node's module resolution paths
- Provides detailed error messages if something is missing

### 3. Updated Electron Main Process (electron/main.js)
- Modified to use the server wrapper script when starting the standalone server
- **Critical fix**: Always uses the unpacked path in production (files in asar can't be executed)
- In dev mode: Uses `__dirname` directly
- In production: Uses `__dirname.replace('app.asar', 'app.asar.unpacked')`
- Ensures proper module resolution even if electron-builder packaging has issues
- Provides better error handling and logging

### 4. Enhanced Build Scripts
- **postbuild.js**: Now verifies that node_modules/next exists in standalone
- **preelectron-build.js**: Added validation for node_modules and next module before building

## How to Rebuild

1. **Clean previous build:**
   ```bash
   rm -rf .next dist
   ```

2. **Build Next.js:**
   ```bash
   npm run build
   ```

3. **Verify the build output:**
   - Check that `.next/standalone/node_modules/next` exists
   - The postbuild script will show warnings if anything is missing

4. **Build Electron app:**
   ```bash
   npm run build:electron
   ```
   or for Windows specifically:
   ```bash
   npm run build:electron:win
   ```

5. **Check the output:**
   - The preelectron-build script will validate everything before building
   - If it passes, the installer will be in the `dist` folder

## Testing the Fix

### On Development Machine (Mac):
```bash
# Test that the standalone server works
cd .next/standalone
node server.js
# Should start without errors
```

### On Windows (Production):
1. Install the newly built app
2. Check the console logs (if accessible)
3. The server wrapper will show diagnostic messages:
   - ✓ Standalone directory: ...
   - ✓ Server file: ...
   - ✓ node_modules found
   - ✓ next module found

## What Changed in Each File

### package.json
- Explicit inclusion of standalone node_modules
- Explicit asarUnpack pattern for node_modules
- Exclusions for unnecessary files

### electron/main.js
- Uses server-wrapper.js instead of directly running server.js
- Better error handling

### electron/server-wrapper.js (NEW)
- Ensures proper module resolution
- Validates all dependencies exist

### postbuild.js
- Copies server-wrapper.js to standalone
- Validates next module exists

### preelectron-build.js
- Checks for node_modules in standalone
- Checks for next module specifically

## Fallback Options

If this still doesn't work, alternative approaches:

1. **Copy node_modules manually:**
   - Modify postbuild.js to copy specific required modules

2. **Use NODE_PATH in electron main.js:**
   - Set NODE_PATH before spawning the server process

3. **Bundle differently:**
   - Consider using a different Next.js output mode
   - Or use a custom server approach

## Verification Steps

Before deploying the new build to production:

1. ✅ Run `npm run build` - should complete without errors
2. ✅ Check that `.next/standalone/node_modules/next` exists
3. ✅ Run `npm run build:electron:win` - should pass validation
4. ✅ Test install the `.exe` on a Windows machine
5. ✅ Check that the app starts without the "Cannot find module 'next'" error

## Contact
If issues persist, check:
- Windows console logs
- Event Viewer for application errors
- Create a support ticket with full error logs
