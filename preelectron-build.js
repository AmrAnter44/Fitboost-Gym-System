// preelectron-build.js - Verify build files before electron-builder
const fs = require('fs');
const path = require('path');


let hasErrors = false;

// Check .next/standalone exists
const standalonePath = path.join('.next', 'standalone');
if (!fs.existsSync(standalonePath)) {
  console.error('❌ ERROR: .next/standalone directory not found!');
  console.error('   Run "npm run build" first.');
  hasErrors = true;
} else {
}

// Check server.js exists
const serverPath = path.join(standalonePath, 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error('❌ ERROR: server.js not found in standalone!');
  hasErrors = true;
} else {
}

// Check static files
const staticPath = path.join(standalonePath, '.next', 'static');
if (!fs.existsSync(staticPath)) {
} else {
}

// Check public files
const publicPath = path.join(standalonePath, 'public');
if (!fs.existsSync(publicPath)) {
} else {
}

// Check database
const dbPath = path.join('prisma', 'gym.db');
if (!fs.existsSync(dbPath)) {
} else {
}

// Check Prisma Client
const prismaClientPath = path.join('node_modules', '.prisma', 'client');
const prismaClientIndexPath = path.join(prismaClientPath, 'index.js');
if (!fs.existsSync(prismaClientPath) || !fs.existsSync(prismaClientIndexPath)) {
  console.error('❌ ERROR: Prisma Client not generated!');
  console.error('   Run "prisma generate" or "npm run postinstall" first.');
  hasErrors = true;
} else {
}

// Check WhatsApp dependencies
const whatsappWebPath = path.join('node_modules', 'whatsapp-web.js');
const puppeteerPath = path.join('node_modules', 'puppeteer');
if (!fs.existsSync(whatsappWebPath)) {
} else {
}
if (!fs.existsSync(puppeteerPath)) {
} else {
}

// Check icon
const iconPath = path.join('build', 'icon.ico');
if (!fs.existsSync(iconPath)) {
} else {
}

// Check Chromium installation
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
    chromiumFound = true;
    break;
  }
}

if (!chromiumFound) {
} else {
}

if (hasErrors) {
  console.error('  Build Check Failed! ❌');
  process.exit(1);
} else {
}
