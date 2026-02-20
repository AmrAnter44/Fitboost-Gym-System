// Simple Proxy Server for FitBoost
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

  // Route to Main System
  proxy.web(req, res, { target: 'http://localhost:4001' });
});

// Listen on port 80 (HTTP)
const PORT = 80;
server.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   FitBoost Proxy Server Running           ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log('📌 Listening on port:', PORT);
  console.log('');
  console.log('🌐 Routing:');
  console.log('   system.xgym.website  → localhost:4001');
  console.log('');
  console.log('⚠️  Make sure port 4001 is running!');
  console.log('');
});
