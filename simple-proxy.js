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


  // Route to Main System
  proxy.web(req, res, { target: 'http://localhost:4001' });
});

// Listen on port 80 (HTTP)
const PORT = 80;
server.listen(PORT, () => {
});
