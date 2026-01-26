/**
 * Custom standalone server for Client Portal
 * Similar to standalone-server.js for main system
 */

// Load default server.js from standalone
const NextServer = require('next/dist/server/next-server').default;
const http = require('http');
const path = require('path');
const fs = require('fs');

const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3002', 10);

console.log('🌐 Starting Client Portal custom standalone server');

// In production standalone, __dirname = client-portal/.next/standalone/
const standaloneDir = __dirname;

// Parent directory for .next/static lookup
const clientPortalRoot = path.join(standaloneDir, '..', '..');

console.log('📂 Standalone dir:', standaloneDir);
console.log('📂 Client Portal root:', clientPortalRoot);

// Check paths
const staticPath = path.join(clientPortalRoot, '.next', 'static');
const publicPath = path.join(standaloneDir, 'public');

if (fs.existsSync(staticPath)) {
  console.log('✓ .next/static found at:', staticPath);
} else {
  console.warn('⚠️ .next/static NOT found at:', staticPath);
}

if (fs.existsSync(publicPath)) {
  console.log('✓ Public folder found at:', publicPath);
} else {
  console.warn('⚠️ Public folder NOT found at:', publicPath);
}

// Start server
process.chdir(standaloneDir);

const nextServer = new NextServer({
  hostname,
  port,
  dir: standaloneDir,
  dev: false,
  conf: {
    env: {},
    webpack: null,
    webpackDevMiddleware: null,
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: false, tsconfigPath: 'tsconfig.json' },
    distDir: '.next',
    cleanDistDir: true,
    assetPrefix: '',
    configOrigin: 'next.config.js',
    useFileSystemPublicRoutes: true,
    generateEtags: true,
    pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
    poweredByHeader: false,
    compress: true,
    images: {
      deviceSizes: [640, 750, 828, 1080, 1200],
      imageSizes: [16, 32, 48, 64, 96, 128, 256],
      path: '/_next/image',
      loader: 'default',
      loaderFile: '',
      domains: [],
      disableStaticImages: false,
      minimumCacheTTL: 60,
      formats: ['image/webp'],
      dangerouslyAllowSVG: false,
      contentSecurityPolicy: "script-src 'none'; frame-src 'none'; sandbox;",
      contentDispositionType: 'inline',
      remotePatterns: [],
      unoptimized: false
    },
    devIndicators: { buildActivity: true, buildActivityPosition: 'bottom-right' },
    onDemandEntries: { maxInactiveAge: 60000, pagesBufferLength: 5 },
    amp: { canonicalBase: '' },
    basePath: '',
    sassOptions: {},
    trailingSlash: false,
    i18n: null,
    productionBrowserSourceMaps: false,
    optimizeFonts: true,
    excludeDefaultMomentLocales: true,
    serverRuntimeConfig: {},
    publicRuntimeConfig: {},
    reactProductionProfiling: false,
    reactStrictMode: true,
    httpAgentOptions: { keepAlive: true },
    outputFileTracing: true,
    staticPageGenerationTimeout: 120,
    swcMinify: true,
    output: 'standalone',
    modularizeImports: undefined,
    experimental: {
      serverComponentsExternalPackages: [],
      outputFileTracingRoot: '',
      swcTraceProfiling: false,
      forceSwcTransforms: false,
      swcPlugins: undefined,
      largePageDataBytes: 128 * 1000,
      disablePostcssPresetEnv: undefined,
      amp: undefined,
      disableOptimizedLoading: undefined,
      gzipSize: true,
      craCompat: false,
      esmExternals: true,
      appDir: true,
      isrFlushToDisk: true,
      workerThreads: false,
      proxyTimeout: undefined,
      optimizeCss: false,
      nextScriptWorkers: false,
      scrollRestoration: false,
      externalDir: false,
      reactRoot: true,
      disableISSG: undefined,
      clientRouterFilter: true,
      clientRouterFilterRedirects: false,
      fetchCacheKeyPrefix: '',
      middlewarePrefetch: 'flexible',
      optimisticClientCache: true,
      manualClientBasePath: false,
      cpus: undefined,
      memoryBasedWorkersCount: false,
      isrMemoryCacheSize: 52428800,
      incrementalCacheHandlerPath: undefined,
      fullySpecified: undefined,
      urlImports: undefined,
      outputFileTracingIgnores: [],
      outputFileTracingIncludes: undefined
    }
  }
});

const requestHandler = nextServer.getRequestHandler();

http.createServer(async (req, res) => {
  try {
    await requestHandler(req, res);
  } catch (err) {
    console.error('Error handling request:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}).listen(port, hostname, (err) => {
  if (err) {
    throw err;
  }
  console.log(`✅ Client Portal ready on http://${hostname}:${port}`);
});
