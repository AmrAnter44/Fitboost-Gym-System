const { spawn } = require('child_process');

// UDP responder: أجهزة Fitboost Assistant بتلاقي السيرفر فورًا بدل مسح الشبكة
try {
  const { startUdpAnnouncer } = require('./electron/udp-announce');
  startUdpAnnouncer(4001);
} catch (e) {
  console.error('UDP announcer failed (non-fatal):', e.message);
}

// Performance banner

// Start Next.js with optimizations
const nextProcess = spawn(
  'node',
  [
    '--max-old-space-size=4096',
    '--max-http-header-size=16384',
    'node_modules/next/dist/bin/next',
    'dev',
    '-p',
    '4001',
    '-H',
    '0.0.0.0'
  ],
  {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      UV_THREADPOOL_SIZE: '8', // Increase thread pool for better performance
    }
  }
);

nextProcess.on('error', (error) => {
  console.error('❌ Failed to start Next.js:', error);
  process.exit(1);
});

nextProcess.on('exit', (code) => {
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  nextProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  nextProcess.kill('SIGTERM');
});
