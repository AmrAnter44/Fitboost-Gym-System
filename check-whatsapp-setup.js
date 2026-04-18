// check-whatsapp-setup.js - التحقق من إعداد WhatsApp للبرودكشن
const fs = require('fs');
const path = require('path');


let hasErrors = false;
let hasWarnings = false;

// فحص المكتبات الأساسية

const requiredPackages = [
  { name: 'whatsapp-web.js', path: 'node_modules/whatsapp-web.js' },
  { name: 'puppeteer', path: 'node_modules/puppeteer' },
  { name: 'qrcode-terminal', path: 'node_modules/qrcode-terminal' }
];

requiredPackages.forEach(pkg => {
  if (fs.existsSync(pkg.path)) {
    const packageJson = require(`./${pkg.path}/package.json`);
  } else {
    console.error(`❌ ${pkg.name} NOT FOUND!`);
    hasErrors = true;
  }
});

// فحص Puppeteer Chromium
const chromiumPath = path.join('node_modules', 'puppeteer', '.local-chromium');
if (fs.existsSync(chromiumPath)) {
  const chromiumFolders = fs.readdirSync(chromiumPath).filter(f =>
    fs.statSync(path.join(chromiumPath, f)).isDirectory()
  );
  if (chromiumFolders.length > 0) {
  } else {
    hasWarnings = true;
  }
} else {
  hasWarnings = true;
}

// فحص ملف WhatsApp Manager
const whatsappManagerPath = path.join('electron', 'whatsapp-manager.js');
if (fs.existsSync(whatsappManagerPath)) {

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
    } else {
      hasWarnings = true;
    }
  });
} else {
  console.error('❌ electron/main.js NOT FOUND!');
  hasErrors = true;
}

// فحص package.json electron-builder config
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

  requiredFiles.forEach(file => {
    if (files.includes(file)) {
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

  requiredUnpack.forEach(file => {
    if (asarUnpack.includes(file)) {
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
if (hasErrors) {
  console.error('  Setup Check Failed! ❌');
  console.error('Please fix the errors above before building.');
  process.exit(1);
} else if (hasWarnings) {
} else {
}
