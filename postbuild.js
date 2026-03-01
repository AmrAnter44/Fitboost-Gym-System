// postbuild.js - Copy files to standalone after build
const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('  Post-Build Script v1.3.0');
console.log('========================================\n');

// Copy static files to standalone
const staticSrc = path.join('.next', 'static');
const staticDest = path.join('.next', 'standalone', '.next', 'static');
if (fs.existsSync(staticSrc) && fs.existsSync('.next/standalone')) {
  fs.cpSync(staticSrc, staticDest, { recursive: true });
  console.log('✅ Static files copied to standalone');
}

// Copy public files to standalone
const publicSrc = 'public';
const publicDest = path.join('.next', 'standalone', 'public');
if (fs.existsSync(publicSrc) && fs.existsSync('.next/standalone')) {
  fs.cpSync(publicSrc, publicDest, { recursive: true });
  console.log('✅ Public files copied to standalone');
}

// Copy server-wrapper.js to standalone
const wrapperSrc = path.join('electron', 'server-wrapper.js');
const wrapperDest = path.join('.next', 'standalone', 'server-wrapper.js');
if (fs.existsSync(wrapperSrc) && fs.existsSync('.next/standalone')) {
  fs.copyFileSync(wrapperSrc, wrapperDest);
  console.log('✅ server-wrapper.js copied to standalone');
} else if (!fs.existsSync(wrapperSrc)) {
  console.error('❌ ERROR: server-wrapper.js not found!');
}

// Verify standalone build
if (fs.existsSync('.next/standalone/server.js')) {
  console.log('✅ Standalone server.js exists');
} else {
  console.error('❌ ERROR: Standalone server.js not found!');
  console.error('   Make sure next.config.js has output: "standalone"');
}

// Verify node_modules in standalone
const standaloneNodeModules = path.join('.next', 'standalone', 'node_modules');
if (fs.existsSync(standaloneNodeModules)) {
  console.log('✅ Standalone node_modules exists');

  // Check for next module
  const nextModule = path.join(standaloneNodeModules, 'next');
  if (fs.existsSync(nextModule)) {
    console.log('✅ Next.js module found in standalone');
  } else {
    console.warn('⚠️ WARNING: next module not in standalone node_modules');
  }
} else {
  console.warn('⚠️ WARNING: node_modules not found in standalone');
}

console.log('\n========================================');
console.log('  Post-Build Complete!');
console.log('========================================\n');
