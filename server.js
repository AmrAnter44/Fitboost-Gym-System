const { spawn } = require('child_process');

// Performance banner
console.log('\n');
console.log('╔════════════════════════════════════════════╗');
console.log('║  🚀 Starting Next.js - Performance Mode   ║');
console.log('╠════════════════════════════════════════════╣');
console.log('║  ⚡ Optimizations:                        ║');
console.log('║  ✓ 4GB Memory Allocated                   ║');
console.log('║  ✓ Database WAL Mode Active               ║');
console.log('║  ✓ React Query Caching (5min)             ║');
console.log('║  ✓ Webpack Filesystem Cache               ║');
console.log('║  ✓ Image Optimization (WebP)              ║');
console.log('╚════════════════════════════════════════════╝');
console.log('\n');

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
  console.log(`\n⚠️ Next.js exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Shutting down gracefully...');
  nextProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Shutting down gracefully...');
  nextProcess.kill('SIGTERM');
});
