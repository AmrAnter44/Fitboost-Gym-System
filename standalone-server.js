// standalone-server.js
// Wrapper script to load .env before starting Next.js standalone server

const fs = require('fs');
const path = require('path');

// Load .env file manually for standalone builds
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');

  if (!fs.existsSync(envPath)) {
    console.warn('⚠️ Warning: .env file not found at:', envPath);
    console.warn('⚠️ Using fallback JWT_SECRET');
    return;
  }

  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    lines.forEach(line => {
      // Skip empty lines and comments
      if (!line || line.trim().startsWith('#')) return;

      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // Only set if not already set (command line env vars take precedence)
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });

    console.log('✅ .env file loaded successfully');
    console.log('✅ JWT_SECRET:', process.env.JWT_SECRET ? 'Set (' + process.env.JWT_SECRET.substring(0, 10) + '...)' : 'Not set (using fallback)');
    console.log('✅ DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    console.log('✅ NODE_ENV:', process.env.NODE_ENV || 'development');
    console.log('✅ NEXT_PUBLIC_DOMAIN:', process.env.NEXT_PUBLIC_DOMAIN || 'Not set');
  } catch (error) {
    console.error('❌ Error loading .env file:', error);
  }
}

// Load environment variables first
loadEnvFile();

// Now start the Next.js server
console.log('\n🚀 Starting Next.js standalone server...\n');

// Check if we're in standalone folder
const serverPath = fs.existsSync(path.join(__dirname, '.next', 'standalone', 'server.js'))
  ? path.join(__dirname, '.next', 'standalone', 'server.js')
  : path.join(__dirname, 'server.js');

if (!fs.existsSync(serverPath)) {
  console.error('❌ Server file not found at:', serverPath);
  console.error('❌ Please run "npm run build" first');
  process.exit(1);
}

// Load the actual Next.js server
require(serverPath);
