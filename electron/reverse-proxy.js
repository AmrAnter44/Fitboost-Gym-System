// Reverse Proxy Server for X Gym
// Routes requests based on domain name to appropriate Next.js servers

const http = require('http');
const httpProxy = require('http-proxy');

let proxyServer = null;
let currentPort = null;

/**
 * Start reverse proxy server
 * @param {number} port - Port to listen on (default: 80)
 * @returns {Promise<number>} - Resolves with the actual port used
 */
function startReverseProxy(port = 80) {
  return new Promise((resolve, reject) => {
    try {
      // Create proxy instance
      const proxy = httpProxy.createProxyServer({
        xfwd: true, // Add X-Forwarded-* headers
        changeOrigin: true
      });

      // Handle proxy errors
      proxy.on('error', (err, req, res) => {
        console.error('🔴 Proxy error:', err.message);

        if (res && res.writeHead && !res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'text/plain' });
          res.end('Bad Gateway - Target server not available');
        }
      });

      // Create HTTP server
      const server = http.createServer((req, res) => {
        // Get hostname from request
        const host = req.headers.host ? req.headers.host.split(':')[0] : '';

        // Log request
        console.log(`📥 [Proxy] ${req.method} ${host}${req.url}`);

        // Route to Main System
        const target = 'http://localhost:4001';
        console.log(`   ↳ Routing to Main System (4001)`);

        // Proxy the request
        proxy.web(req, res, { target });
      });

      // Handle WebSocket upgrade requests
      server.on('upgrade', (req, socket, head) => {
        const target = 'http://localhost:4001';

        console.log(`🔌 [Proxy] WebSocket upgrade to ${target}`);
        proxy.ws(req, socket, head, { target });
      });

      // Start listening
      server.listen(port, '0.0.0.0', () => {
        currentPort = port;
        console.log('');
        console.log('╔════════════════════════════════════════╗');
        console.log('║   ✅ Reverse Proxy Server Running      ║');
        console.log('╚════════════════════════════════════════╝');
        console.log('');
        console.log(`📌 Listening on: 0.0.0.0:${port}`);
        console.log('');
        console.log('🌐 Routing:');
        console.log('   system.xgym.website  → localhost:4001');
        console.log('   localhost            → localhost:4001');
        console.log('');

        proxyServer = server;
        resolve(port);
      });

      // Handle server errors
      server.on('error', (err) => {
        if (err.code === 'EACCES') {
          // Port requires admin privileges
          if (port === 80) {
            console.warn('⚠️  Port 80 requires administrator privileges');
            console.warn('⚠️  Trying port 8080 instead...');
            console.log('');
            startReverseProxy(8080).then(resolve).catch(reject);
          } else {
            reject(new Error(`Port ${port} requires elevated privileges`));
          }
        } else if (err.code === 'EADDRINUSE') {
          // Port already in use
          console.warn(`⚠️  Port ${port} is already in use`);
          console.warn(`⚠️  Trying port ${port + 1} instead...`);
          console.log('');
          startReverseProxy(port + 1).then(resolve).catch(reject);
        } else {
          reject(err);
        }
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Stop reverse proxy server
 */
function stopReverseProxy() {
  return new Promise((resolve) => {
    if (proxyServer) {
      console.log('');
      console.log('🛑 Stopping reverse proxy server...');

      proxyServer.close(() => {
        console.log(`✅ Reverse proxy stopped (was on port ${currentPort})`);
        proxyServer = null;
        currentPort = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Get current proxy server status
 * @returns {Object|null} - Server status or null if not running
 */
function getProxyStatus() {
  if (proxyServer && currentPort) {
    return {
      running: true,
      port: currentPort,
      address: `http://0.0.0.0:${currentPort}`
    };
  }
  return null;
}

module.exports = {
  startReverseProxy,
  stopReverseProxy,
  getProxyStatus
};
