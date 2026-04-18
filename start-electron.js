#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');


let attempts = 0;
const maxAttempts = 180; // 3 minutes (180 seconds)

function checkServer() {
  attempts++;

  const req = http.get('http://localhost:4001', (res) => {

    // Start Electron
    const electron = spawn('npx', [
      'electron',
      '.',
      '--enable-features=WebRTC',
      '--enable-usermedia-screen-capturing'
    ], {
      stdio: 'inherit',
      shell: true
    });

    electron.on('exit', (code) => {
      process.exit(code);
    });
  });

  req.on('error', (err) => {
    if (attempts >= maxAttempts) {
      console.error(`\n❌ Timeout: Next.js did not start after ${maxAttempts} seconds`);
      console.error('Please make sure Next.js is running on http://localhost:4001');
      process.exit(1);
    }

    // Show progress every 10 seconds
    if (attempts % 10 === 0) {
    }

    // Retry after 1 second
    setTimeout(checkServer, 1000);
  });

  req.end();
}

// Start checking
checkServer();
