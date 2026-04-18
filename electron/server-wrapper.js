/**
 * Server Wrapper for Standalone Next.js Server
 * This wrapper ensures proper module resolution in Electron environment
 */

const path = require('path');
const fs = require('fs');

// Get the standalone directory path from command line argument
const standaloneDir = process.argv[2];

if (!standaloneDir) {
  console.error('ERROR: No standalone directory specified');
  console.error('Usage: node server-wrapper.js <standalone-directory-path>');
  process.exit(1);
}

// Validate that the standalone directory exists
if (!fs.existsSync(standaloneDir)) {
  console.error('ERROR: Standalone directory not found:', standaloneDir);
  process.exit(1);
}

// Validate that server.js exists
const serverPath = path.join(standaloneDir, 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error('ERROR: server.js not found at:', serverPath);
  process.exit(1);
}

// Check if node_modules exists - try multiple locations
let nodeModulesPath = path.join(standaloneDir, 'node_modules');

// If not in standalone, check in resources/standalone-modules (production build)
if (!fs.existsSync(nodeModulesPath)) {

  // In production: resources/standalone-modules
  const productionModulesPath = path.join(process.resourcesPath, 'standalone-modules');
  if (fs.existsSync(productionModulesPath)) {
    nodeModulesPath = productionModulesPath;
  } else {
    console.error('ERROR: node_modules not found at:', nodeModulesPath);
    console.error('Also checked:', productionModulesPath);
    console.error('The standalone build might be incomplete');
    process.exit(1);
  }
}

// Check if 'next' module exists
const nextModulePath = path.join(nodeModulesPath, 'next');
if (!fs.existsSync(nextModulePath)) {
  console.error('ERROR: next module not found at:', nextModulePath);
  console.error('Cannot start server without next module');
  process.exit(1);
}


// Set up NODE_PATH to ensure module resolution works
const currentNodePath = process.env.NODE_PATH || '';
const nodePaths = [
  nodeModulesPath,
  ...currentNodePath.split(path.delimiter).filter(Boolean)
];
process.env.NODE_PATH = nodePaths.join(path.delimiter);

// Change to the standalone directory
process.chdir(standaloneDir);


// Require module from the new NODE_PATH
require('module').Module._initPaths();

// Now require and run the server
try {
  require(serverPath);
} catch (error) {
  console.error('ERROR starting server:', error);
  process.exit(1);
}
