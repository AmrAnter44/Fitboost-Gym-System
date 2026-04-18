// standalone-server.js
// Wrapper script to load .env before starting Next.js standalone server
// This fixes JWT authentication issues in production by manually loading .env

const fs = require('fs');
const path = require('path');


// Manual .env loading (most reliable for standalone builds)
const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found at:', envPath);
  console.error('⚠️ Environment variables will use fallback values');
  console.error('⚠️ This may cause JWT authentication to fail!');
} else {

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
      }
    });

  } catch (err) {
    console.error('❌ Error reading .env file:', err.message);
  }
}

// Verify critical environment variables

// Run database migrations

const migrationPath = path.join(__dirname, 'migrate-database-complete.js');
if (fs.existsSync(migrationPath)) {
  try {
    const { execSync } = require('child_process');
    execSync(`node "${migrationPath}"`, { stdio: 'inherit', cwd: __dirname });
  } catch (migrationError) {
    console.error('  ⚠️ Migration warning:', migrationError.message);
  }
} else {
}

// Start Next.js server

const serverPath = path.join(__dirname, 'server.js');

if (!fs.existsSync(serverPath)) {
  console.error('❌ Server file not found!');
  console.error('   Expected at:', serverPath);
  console.error('   Current dir:', __dirname);
  fs.readdirSync(__dirname).forEach(file => {
  });
  process.exit(1);
}


// Load and execute the Next.js server
require(serverPath);
