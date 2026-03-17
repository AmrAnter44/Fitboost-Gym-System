// check-whatsapp-setup.js - التحقق من إعداد WhatsApp للبرودكشن
const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('  WhatsApp Production Setup Check');
console.log('========================================\n');

let hasErrors = false;
let hasWarnings = false;

// فحص المكتبات الأساسية
console.log('📦 Checking Dependencies...\n');

const requiredPackages = [
  { name: 'whatsapp-web.js', path: 'node_modules/whatsapp-web.js' },
  { name: 'puppeteer', path: 'node_modules/puppeteer' },
  { name: 'qrcode-terminal', path: 'node_modules/qrcode-terminal' }
];

requiredPackages.forEach(pkg => {
  if (fs.existsSync(pkg.path)) {
    const packageJson = require(`./${pkg.path}/package.json`);
    console.log(`✅ ${pkg.name} v${packageJson.version}`);
  } else {
    console.error(`❌ ${pkg.name} NOT FOUND!`);
    hasErrors = true;
  }
});

// فحص Puppeteer Chromium
console.log('\n🌐 Checking Puppeteer Chromium...\n');
const chromiumPath = path.join('node_modules', 'puppeteer', '.local-chromium');
if (fs.existsSync(chromiumPath)) {
  const chromiumFolders = fs.readdirSync(chromiumPath).filter(f =>
    fs.statSync(path.join(chromiumPath, f)).isDirectory()
  );
  if (chromiumFolders.length > 0) {
    console.log(`✅ Chromium installed: ${chromiumFolders.join(', ')}`);
  } else {
    console.warn('⚠️  WARNING: Chromium folder exists but empty');
    hasWarnings = true;
  }
} else {
  console.warn('⚠️  WARNING: Chromium not downloaded yet');
  console.warn('   It will be downloaded on first use.');
  hasWarnings = true;
}

// فحص ملف WhatsApp Manager
console.log('\n📱 Checking WhatsApp Manager...\n');
const whatsappManagerPath = path.join('electron', 'whatsapp-manager.js');
if (fs.existsSync(whatsappManagerPath)) {
  console.log('✅ whatsapp-manager.js exists');

  // فحص محتوى الملف
  const content = fs.readFileSync(whatsappManagerPath, 'utf8');
  const checks = [
    { regex: /class WhatsAppManager/, name: 'WhatsAppManager class' },
    { regex: /require\(['"]whatsapp-web\.js['"]\)/, name: 'whatsapp-web.js import' },
    { regex: /LocalAuth/, name: 'LocalAuth strategy' },
    { regex: /sendMessage/, name: 'sendMessage method' },
    { regex: /sendImage/, name: 'sendImage method' }
  ];

  checks.forEach(check => {
    if (check.regex.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.error(`  ❌ ${check.name} NOT FOUND!`);
      hasErrors = true;
    }
  });
} else {
  console.error('❌ whatsapp-manager.js NOT FOUND!');
  hasErrors = true;
}

// فحص electron/main.js
console.log('\n⚡ Checking Electron Main...\n');
const mainJsPath = path.join('electron', 'main.js');
if (fs.existsSync(mainJsPath)) {
  const content = fs.readFileSync(mainJsPath, 'utf8');
  const checks = [
    { regex: /require.*whatsapp-manager/, name: 'WhatsAppManager import' },
    { regex: /whatsapp:init/, name: 'IPC handler: whatsapp:init' },
    { regex: /whatsapp:send/, name: 'IPC handler: whatsapp:send' },
    { regex: /whatsapp:sendImage/, name: 'IPC handler: whatsapp:sendImage' },
    { regex: /whatsapp:status/, name: 'IPC handler: whatsapp:status' }
  ];

  checks.forEach(check => {
    if (check.regex.test(content)) {
      console.log(`  ✅ ${check.name}`);
    } else {
      console.warn(`  ⚠️  ${check.name} not found`);
      hasWarnings = true;
    }
  });
} else {
  console.error('❌ electron/main.js NOT FOUND!');
  hasErrors = true;
}

// فحص package.json electron-builder config
console.log('\n🔧 Checking Electron Builder Config...\n');
const packageJson = require('./package.json');
const build = packageJson.build;

if (build) {
  // فحص files
  const files = build.files || [];
  const requiredFiles = [
    'electron/**/*',
    'node_modules/whatsapp-web.js/**/*',
    'node_modules/puppeteer/**/*'
  ];

  console.log('Files Configuration:');
  requiredFiles.forEach(file => {
    if (files.includes(file)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.error(`  ❌ ${file} NOT INCLUDED!`);
      hasErrors = true;
    }
  });

  // فحص asarUnpack
  const asarUnpack = build.asarUnpack || [];
  const requiredUnpack = [
    'node_modules/puppeteer/**/*',
    'node_modules/whatsapp-web.js/**/*'
  ];

  console.log('\nasarUnpack Configuration:');
  requiredUnpack.forEach(file => {
    if (asarUnpack.includes(file)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.error(`  ❌ ${file} NOT UNPACKED!`);
      hasErrors = true;
    }
  });
} else {
  console.error('❌ Build configuration not found in package.json!');
  hasErrors = true;
}

// النتيجة النهائية
console.log('\n========================================');
if (hasErrors) {
  console.error('  Setup Check Failed! ❌');
  console.log('========================================\n');
  console.error('Please fix the errors above before building.');
  process.exit(1);
} else if (hasWarnings) {
  console.warn('  Setup Check Passed with Warnings! ⚠️');
  console.log('========================================\n');
  console.log('You can proceed, but check warnings above.');
} else {
  console.log('  Setup Check Passed! ✅');
  console.log('========================================\n');
  console.log('WhatsApp is ready for production build!');
}
