// preelectron-build.js - Verify build files before electron-builder
const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('  Pre-Electron Build Check v1.1.0');
console.log('========================================\n');

let hasErrors = false;

// Check .next/standalone exists
const standalonePath = path.join('.next', 'standalone');
if (!fs.existsSync(standalonePath)) {
  console.error('❌ ERROR: .next/standalone directory not found!');
  console.error('   Run "npm run build" first.');
  hasErrors = true;
} else {
  console.log('✅ .next/standalone directory exists');
}

// Check server.js exists
const serverPath = path.join(standalonePath, 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error('❌ ERROR: server.js not found in standalone!');
  hasErrors = true;
} else {
  console.log('✅ server.js exists');
}

// Check static files
const staticPath = path.join(standalonePath, '.next', 'static');
if (!fs.existsSync(staticPath)) {
  console.warn('⚠️  WARNING: Static files not found in standalone');
} else {
  console.log('✅ Static files exist');
}

// Check public files
const publicPath = path.join(standalonePath, 'public');
if (!fs.existsSync(publicPath)) {
  console.warn('⚠️  WARNING: Public files not found in standalone');
} else {
  console.log('✅ Public files exist');
}

// Check database
const dbPath = path.join('prisma', 'gym.db');
if (!fs.existsSync(dbPath)) {
  console.warn('⚠️  WARNING: Database file not found at:', dbPath);
} else {
  console.log('✅ Database file exists');
}

// Check icon
const iconPath = path.join('build', 'icon.ico');
if (!fs.existsSync(iconPath)) {
  console.warn('⚠️  WARNING: Icon file not found at:', iconPath);
} else {
  console.log('✅ Icon file exists');
}

console.log('\n========================================');
if (hasErrors) {
  console.error('  Build Check Failed! ❌');
  console.log('========================================\n');
  process.exit(1);
} else {
  console.log('  Build Check Passed! ✅');
  console.log('========================================\n');
}
