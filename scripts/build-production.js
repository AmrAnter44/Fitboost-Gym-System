// scripts/build-production.js - Complete production build script
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('  🏗️  Fitboost Production Build');
console.log('  Version: 5.6.2');
console.log('========================================\n');

function runCommand(command, description) {
  console.log(`\n📌 ${description}...`);
  console.log(`   Command: ${command}\n`);
  try {
    execSync(command, { stdio: 'inherit', shell: true });
    console.log(`✅ ${description} completed!\n`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed!`);
    console.error(`   Error: ${error.message}\n`);
    return false;
  }
}

function checkFileExists(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${description} exists`);
    return true;
  } else {
    console.error(`❌ ${description} not found at: ${filePath}`);
    return false;
  }
}

// Step 1: Clean old build
console.log('🧹 Cleaning old build files...\n');
const cleanDirs = ['.next', 'dist'];
cleanDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`   Removing ${dir}...`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
console.log('✅ Cleaning completed!\n');

// Step 2: Install dependencies
if (!runCommand('npm install', 'Installing dependencies')) {
  process.exit(1);
}

// Step 3: Generate Prisma Client
if (!runCommand('npx prisma generate', 'Generating Prisma Client')) {
  process.exit(1);
}

// Step 4: Build Next.js
if (!runCommand('npm run build', 'Building Next.js application')) {
  process.exit(1);
}

// Step 5: Verify build files
console.log('\n🔍 Verifying build files...\n');
let verificationFailed = false;

if (!checkFileExists('.next/standalone/server.js', 'server.js')) {
  verificationFailed = true;
}
if (!checkFileExists('.next/standalone/.next/static', 'Static files')) {
  verificationFailed = true;
}
if (!checkFileExists('.next/standalone/public', 'Public files')) {
  verificationFailed = true;
}
if (!checkFileExists('prisma/gym.db', 'Database file')) {
  console.warn('⚠️  Database file not found - will use seed database');
}

if (verificationFailed) {
  console.error('\n❌ Build verification failed!');
  console.error('   Please check the error messages above.\n');
  process.exit(1);
}

console.log('\n✅ All build files verified!\n');

// Step 6: Build Electron
const isWindows = process.platform === 'win32';
const electronBuildCommand = isWindows
  ? 'npx electron-builder --win --x64 --publish never'
  : 'npx electron-builder --publish never';

if (!runCommand(electronBuildCommand, 'Building Electron application')) {
  process.exit(1);
}

// Step 7: Final verification
console.log('\n🔍 Final verification...\n');

const distPath = 'dist';
if (!fs.existsSync(distPath)) {
  console.error('❌ dist directory not found!');
  process.exit(1);
}

const distFiles = fs.readdirSync(distPath);
console.log('📦 Build output files:');
distFiles.forEach(file => {
  const filePath = path.join(distPath, file);
  const stats = fs.statSync(filePath);
  const size = stats.isDirectory()
    ? 'Directory'
    : `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
  console.log(`   - ${file} (${size})`);
});

console.log('\n========================================');
console.log('  ✅ Production Build Completed!');
console.log('========================================\n');

console.log('📍 Next steps:');
console.log('   1. Test the application: cd dist/win-unpacked && "Gym Management.exe"');
console.log('   2. Install the application: Run the setup .exe file in dist/');
console.log('   3. Create a backup of the build: Copy dist/ folder to safe location\n');
