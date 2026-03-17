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

// Check Prisma Client
const prismaClientPath = path.join('node_modules', '.prisma', 'client');
const prismaClientIndexPath = path.join(prismaClientPath, 'index.js');
if (!fs.existsSync(prismaClientPath) || !fs.existsSync(prismaClientIndexPath)) {
  console.error('❌ ERROR: Prisma Client not generated!');
  console.error('   Run "prisma generate" or "npm run postinstall" first.');
  hasErrors = true;
} else {
  console.log('✅ Prisma Client is generated');
}

// Check WhatsApp dependencies
const whatsappWebPath = path.join('node_modules', 'whatsapp-web.js');
const puppeteerPath = path.join('node_modules', 'puppeteer');
if (!fs.existsSync(whatsappWebPath)) {
  console.warn('⚠️  WARNING: whatsapp-web.js not found!');
  console.warn('   Run "npm install" to install WhatsApp dependencies.');
} else {
  console.log('✅ whatsapp-web.js is installed');
}
if (!fs.existsSync(puppeteerPath)) {
  console.warn('⚠️  WARNING: puppeteer not found!');
  console.warn('   Run "npm install" to install Puppeteer.');
} else {
  console.log('✅ puppeteer is installed');
}

// Check icon
const iconPath = path.join('build', 'icon.ico');
if (!fs.existsSync(iconPath)) {
  console.warn('⚠️  WARNING: Icon file not found at:', iconPath);
} else {
  console.log('✅ Icon file exists');
}

// Check Chromium installation
console.log('\n📦 Checking Chromium...');
const os = require('os');
const chromiumPaths = [
  path.join(os.homedir(), '.cache', 'puppeteer'),
  path.join(os.homedir(), 'AppData', 'Local', 'puppeteer'),
  path.join(os.homedir(), 'Library', 'Caches', 'puppeteer'),
  path.join('node_modules', '.cache', 'puppeteer'),
  path.join('node_modules', 'puppeteer', '.local-chromium')
];

let chromiumFound = false;
for (const chromePath of chromiumPaths) {
  if (fs.existsSync(chromePath)) {
    console.log('✅ Chromium cache found at:', chromePath);
    chromiumFound = true;
    break;
  }
}

if (!chromiumFound) {
  console.warn('⚠️  WARNING: Chromium not found in development!');
  console.warn('   Chromium will be downloaded automatically on first WhatsApp use in production.');
  console.warn('   You can pre-download it with: npm run whatsapp:install-chromium');
} else {
  console.log('✅ Chromium is ready (will be downloaded on-demand in production)');
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
