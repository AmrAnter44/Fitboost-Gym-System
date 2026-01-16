// Custom server wrapper for Next.js standalone with public folder support
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 4001;
const HOSTNAME = '0.0.0.0';

// Get the standalone directory (passed as argument or current directory)
const standaloneDir = process.argv[2] || process.cwd();
const publicDir = path.join(standaloneDir, 'public');
const serverFile = path.join(standaloneDir, 'server.js');

console.log('🚀 Starting custom standalone server');
console.log('📁 Standalone dir:', standaloneDir);
console.log('📁 Public dir:', publicDir);
console.log('📄 Server file:', serverFile);

// Check if Next.js server exists
if (!fs.existsSync(serverFile)) {
  console.error('❌ server.js not found at:', serverFile);
  process.exit(1);
}

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

// DON'T require server.js directly as it starts its own server
// Instead, we'll create our own server and use Next.js handler

// Create HTTP server FIRST
const server = http.createServer((req, res) => {
  // Parse URL to remove query strings
  const urlPath = req.url.split('?')[0];

  console.log('📥 Incoming request:', urlPath);

  // Check if request is for a public file (but not API or Next.js routes)
  if (!urlPath.startsWith('/api') && !urlPath.startsWith('/_next') && urlPath !== '/') {
    const filePath = path.join(publicDir, urlPath);
    console.log('🔍 Checking path:', filePath);
    console.log('🔍 Path starts with public?', filePath.startsWith(publicDir));
    console.log('🔍 File exists?', fs.existsSync(filePath));

    // Security: prevent directory traversal
    if (filePath.startsWith(publicDir) && fs.existsSync(filePath)) {
      try {
        const stats = fs.statSync(filePath);
        console.log('🔍 Is file?', stats.isFile());

        if (stats.isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const contentType = mimeTypes[ext] || 'application/octet-stream';

          console.log('✅ Serving static file:', urlPath, 'Type:', contentType);

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
        console.error('❌ Error reading file:', err);
      }
    } else {
      console.log('⚠️ File not found or path issue');
    }
  }

  // Forward to Next.js server - require it here to avoid auto-start
  console.log('➡️ Forwarding to Next.js:', urlPath);
  if (!server.nextHandler) {
    // Lazy load Next.js handler only when needed
    const NextServer = require(serverFile);
    // Next.js standalone server exports the handler directly
    server.nextHandler = NextServer;
    console.log('✅ Next.js handler loaded');
  }

  // Call the handler - Next.js standalone exports a request handler
  if (typeof server.nextHandler === 'function') {
    server.nextHandler(req, res);
  } else if (server.nextHandler && typeof server.nextHandler.handle === 'function') {
    server.nextHandler.handle(req, res);
  } else {
    console.error('❌ Next.js handler not found or invalid');
    res.writeHead(500);
    res.end('Internal Server Error: Next.js handler not available');
  }
});

server.listen(PORT, HOSTNAME, () => {
  console.log(`✅ Server listening on http://${HOSTNAME}:${PORT}`);
  console.log(`✅ Public folder accessible at: ${publicDir}`);
});
