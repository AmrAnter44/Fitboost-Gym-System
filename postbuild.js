// postbuild.js - Copy files to standalone after build
const fs = require('fs');
const path = require('path');


// Copy static files to standalone
const staticSrc = path.join('.next', 'static');
const staticDest = path.join('.next', 'standalone', '.next', 'static');
if (fs.existsSync(staticSrc) && fs.existsSync('.next/standalone')) {
  fs.cpSync(staticSrc, staticDest, { recursive: true });
}

// Copy public files to standalone
const publicSrc = 'public';
const publicDest = path.join('.next', 'standalone', 'public');
if (fs.existsSync(publicSrc) && fs.existsSync('.next/standalone')) {
  fs.cpSync(publicSrc, publicDest, { recursive: true });
}

// Copy server-wrapper.js to standalone
const wrapperSrc = path.join('electron', 'server-wrapper.js');
const wrapperDest = path.join('.next', 'standalone', 'server-wrapper.js');
if (fs.existsSync(wrapperSrc) && fs.existsSync('.next/standalone')) {
  fs.copyFileSync(wrapperSrc, wrapperDest);
} else if (!fs.existsSync(wrapperSrc)) {
  console.error('❌ ERROR: server-wrapper.js not found!');
}

// Copy udp-announce.js next to the wrapper (اكتشاف الـ Assistant الفوري)
const udpSrc = path.join('electron', 'udp-announce.js');
const udpDest = path.join('.next', 'standalone', 'udp-announce.js');
if (fs.existsSync(udpSrc) && fs.existsSync('.next/standalone')) {
  fs.copyFileSync(udpSrc, udpDest);
}

// Verify standalone build
if (fs.existsSync('.next/standalone/server.js')) {
} else {
  console.error('❌ ERROR: Standalone server.js not found!');
  console.error('   Make sure next.config.js has output: "standalone"');
}

// Verify node_modules in standalone
const standaloneNodeModules = path.join('.next', 'standalone', 'node_modules');
if (fs.existsSync(standaloneNodeModules)) {

  // Check for next module
  const nextModule = path.join(standaloneNodeModules, 'next');
  if (fs.existsSync(nextModule)) {
  } else {
  }
} else {
}

