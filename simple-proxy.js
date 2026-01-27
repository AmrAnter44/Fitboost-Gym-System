// Simple Proxy Server for X Gym
// This replaces Caddy with a simple Node.js proxy

const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  res.writeHead(500, { 'Content-Type': 'text/plain' });
  res.end('Proxy error');
});

const server = http.createServer((req, res) => {
  const host = req.headers.host;

  console.log(`[${new Date().toISOString()}] ${host} → ${req.url}`);

  // Route based on hostname
  if (host && host.startsWith('client.')) {
    // Client Portal: client.xgym.website → localhost:3002
    proxy.web(req, res, { target: 'http://localhost:3002' });
  } else {
    // Main System: system.xgym.website → localhost:4001
    proxy.web(req, res, { target: 'http://localhost:4001' });
  }
});

// Listen on port 80 (HTTP)
const PORT = 80;
server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   X Gym Proxy Server Running           ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log('📌 Listening on port:', PORT);
  console.log('');
  console.log('🌐 Routing:');
  console.log('   system.xgym.website  → localhost:4001');
  console.log('   client.xgym.website  → localhost:3002');
  console.log('');
  console.log('⚠️  Make sure ports 4001 and 3002 are running!');
  console.log('');
});
