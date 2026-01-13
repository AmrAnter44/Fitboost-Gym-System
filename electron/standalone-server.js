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

// Load Next.js server
const nextServer = require(serverFile);

// Create HTTP server
const server = http.createServer((req, res) => {
  // Parse URL to remove query strings
  const urlPath = req.url.split('?')[0];

  // Check if request is for a public file (but not API or Next.js routes)
  if (!urlPath.startsWith('/api') && !urlPath.startsWith('/_next')) {
    const filePath = path.join(publicDir, urlPath);

    // Security: prevent directory traversal
    if (filePath.startsWith(publicDir) && fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        console.log('📄 Serving static file:', urlPath);

        fs.readFile(filePath, (err, data) => {
          if (err) {
            console.error('❌ Error reading file:', err);
            res.writeHead(500);
            res.end('Internal Server Error');
          } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
          }
        });
        return;
      }
    }
  }

  // Forward to Next.js server
  nextServer.handle(req, res);
});

server.listen(PORT, HOSTNAME, () => {
  console.log(`✅ Server listening on http://${HOSTNAME}:${PORT}`);
  console.log(`✅ Public folder accessible at: ${publicDir}`);
});
