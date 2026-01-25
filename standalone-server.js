// standalone-server.js
// Wrapper script to load .env before starting Next.js standalone server
// This fixes JWT authentication issues in production by manually loading .env

const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('  Standalone Server Wrapper v1.1.4');
console.log('========================================\n');
console.log('📁 Current directory:', __dirname);

// Manual .env loading (most reliable for standalone builds)
const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found at:', envPath);
  console.error('⚠️ Environment variables will use fallback values');
  console.error('⚠️ This may cause JWT authentication to fail!');
} else {
  console.log('📄 Found .env file, loading...\n');

  try {
    const envContent = fs.readFileSync(envPath, 'utf8');

    // Handle both Unix (\n) and Windows (\r\n) line endings
    const lines = envContent.split(/\r?\n/);
    let loadedCount = 0;

    lines.forEach(line => {
      line = line.trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) return;

      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // Force set environment variable
        process.env[key] = value;
        loadedCount++;

        // Log (hide sensitive values)
        const isSensitive = key.includes('SECRET') || key.includes('PASSWORD') || key.includes('KEY');
        const displayValue = isSensitive ? '[HIDDEN]' : value;
        console.log(`  ✓ ${key} = ${displayValue}`);
      }
    });

    console.log(`\n✅ Loaded ${loadedCount} environment variables from .env\n`);
  } catch (err) {
    console.error('❌ Error reading .env file:', err.message);
  }
}

// Verify critical environment variables
console.log('📊 Critical Environment Variables:');
console.log('  → JWT_SECRET:', process.env.JWT_SECRET ? `✅ SET (${process.env.JWT_SECRET.substring(0, 15)}...)` : '❌ NOT SET');
console.log('  → DATABASE_URL:', process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET');
console.log('  → NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('  → PORT:', process.env.PORT || '3000');
console.log('  → NEXT_PUBLIC_DOMAIN:', process.env.NEXT_PUBLIC_DOMAIN || 'Not set');

// Start Next.js server
console.log('\n🚀 Starting Next.js standalone server...\n');

const serverPath = path.join(__dirname, 'server.js');

if (!fs.existsSync(serverPath)) {
  console.error('❌ Server file not found!');
  console.error('   Expected at:', serverPath);
  console.error('   Current dir:', __dirname);
  console.log('\nFiles in current directory:');
  fs.readdirSync(__dirname).forEach(file => {
    console.log(`   - ${file}`);
  });
  process.exit(1);
}

console.log('✅ Loading Next.js server from:', serverPath);
console.log('========================================\n');

// Load and execute the Next.js server
require(serverPath);
