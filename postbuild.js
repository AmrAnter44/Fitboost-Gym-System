// postbuild.js - Copy files to standalone after build
const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('  Post-Build Script v1.1.5');
console.log('========================================\n');

// Copy static files
const staticSrc = path.join('.next', 'static');
const staticDest = path.join('.next', 'standalone', '.next', 'static');
if (fs.existsSync(staticSrc) && fs.existsSync('.next/standalone')) {
  fs.cpSync(staticSrc, staticDest, { recursive: true });
  console.log('✅ Static files copied to standalone');
}

// Copy public files
const publicSrc = 'public';
const publicDest = path.join('.next', 'standalone', 'public');
if (fs.existsSync(publicSrc) && fs.existsSync('.next/standalone')) {
  fs.cpSync(publicSrc, publicDest, { recursive: true });
  console.log('✅ Public files copied to standalone');
}

// Copy .env file
if (fs.existsSync('.env') && fs.existsSync('.next/standalone')) {
  fs.copyFileSync('.env', path.join('.next', 'standalone', '.env'));
  console.log('✅ .env file copied to standalone');
}

// Copy database
const dbSrc = path.join('prisma', 'prisma', 'gym.db');
const dbDest = path.join('.next', 'standalone', 'prisma', 'prisma');
if (fs.existsSync(dbSrc)) {
  fs.mkdirSync(dbDest, { recursive: true });
  fs.copyFileSync(dbSrc, path.join(dbDest, 'gym.db'));
  console.log('✅ Database copied to standalone');
}

// Copy standalone-server.js
if (fs.existsSync('standalone-server.js') && fs.existsSync('.next/standalone')) {
  fs.copyFileSync('standalone-server.js', path.join('.next', 'standalone', 'standalone-server.js'));
  console.log('✅ standalone-server.js copied to standalone');
}

// Copy migration script
if (fs.existsSync('migrate-database-complete.js') && fs.existsSync('.next/standalone')) {
  fs.copyFileSync('migrate-database-complete.js', path.join('.next', 'standalone', 'migrate-database-complete.js'));
  console.log('✅ migrate-database-complete.js copied to standalone');
}

console.log('\n========================================');
console.log('  Post-Build Complete!');
console.log('========================================\n');
