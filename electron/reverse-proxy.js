// Reverse Proxy Server for FitBoost
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

        // Route to Main System
        const target = 'http://localhost:4001';

        // Proxy the request
        proxy.web(req, res, { target });
      });

      // Handle WebSocket upgrade requests
      server.on('upgrade', (req, socket, head) => {
        const target = 'http://localhost:4001';

        proxy.ws(req, socket, head, { target });
      });

      // Start listening
      server.listen(port, '0.0.0.0', () => {
        currentPort = port;

        proxyServer = server;
        resolve(port);
      });

      // Handle server errors
      server.on('error', (err) => {
        if (err.code === 'EACCES') {
          // Port requires admin privileges
          if (port === 80) {
            startReverseProxy(8080).then(resolve).catch(reject);
          } else {
            reject(new Error(`Port ${port} requires elevated privileges`));
          }
        } else if (err.code === 'EADDRINUSE') {
          // Port already in use
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

      proxyServer.close(() => {
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
