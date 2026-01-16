// Custom server wrapper for Next.js standalone with public folder support
const path = require('path');
const fs = require('fs');
const http = require('http');

// Get the standalone directory (passed as argument or current directory)
const standaloneDir = process.argv[2] || process.cwd();
const publicDir = path.join(standaloneDir, 'public');

console.log('🚀 Starting custom standalone server');
console.log('📁 Standalone dir:', standaloneDir);
console.log('📁 Public dir:', publicDir);

// MIME types for static files
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

// Intercept http.createServer to add static file serving
const originalCreateServer = http.createServer;
http.createServer = function(requestListener) {
  // Wrap the original request listener
  const wrappedListener = (req, res) => {
    const urlPath = req.url.split('?')[0];

    console.log('📥 Request:', urlPath);

    // Check if request is for a public file
    if (!urlPath.startsWith('/api') && !urlPath.startsWith('/_next') && urlPath !== '/') {
      const filePath = path.join(publicDir, urlPath);

      if (filePath.startsWith(publicDir) && fs.existsSync(filePath)) {
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = mimeTypes[ext] || 'application/octet-stream';

            console.log('✅ Serving:', urlPath);

            const data = fs.readFileSync(filePath);
            res.writeHead(200, {
              'Content-Type': contentType,
              'Content-Length': data.length,
              'Cache-Control': 'public, max-age=31536000'
            });
            res.end(data);
            return;
          }
        } catch (err) {
          console.error('❌ Error:', err.message);
        }
      }
    }

    // Forward to Next.js
    return requestListener(req, res);
  };

  return originalCreateServer.call(this, wrappedListener);
};

// Now require the Next.js server which will use our wrapped createServer
console.log('✅ Loading Next.js server...');
require(path.join(standaloneDir, 'server.js'));
