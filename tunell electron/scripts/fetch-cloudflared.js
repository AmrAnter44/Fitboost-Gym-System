// Downloads the cloudflared binary into ./resources so it can be bundled
// into the Electron build (and used for local dev).
//
//   node scripts/fetch-cloudflared.js            -> Windows exe + current platform
//   node scripts/fetch-cloudflared.js win        -> Windows exe only
//   node scripts/fetch-cloudflared.js mac|linux  -> that platform only
//   node scripts/fetch-cloudflared.js all        -> win + mac + linux

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const RES = path.join(__dirname, '..', 'resources');
fs.mkdirSync(RES, { recursive: true });

const BASE = 'https://github.com/cloudflare/cloudflared/releases/latest/download/';

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const go = (u, n) => {
      if (n > 8) return reject(new Error('too many redirects'));
      https
        .get(u, { headers: { 'User-Agent': 'tunnelkeeper' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return go(new URL(res.headers.location, u).toString(), n + 1);
          }
          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error('HTTP ' + res.statusCode + ' for ' + u));
          }
          res.pipe(file);
          file.on('finish', () => file.close(() => resolve()));
        })
        .on('error', (e) => {
          file.close();
          fs.rmSync(dest, { force: true });
          reject(e);
        });
    };
    go(url, 0);
  });
}

async function fetchWin() {
  const dest = path.join(RES, 'cloudflared.exe');
  console.log('↓ cloudflared-windows-amd64.exe');
  await download(BASE + 'cloudflared-windows-amd64.exe', dest);
  console.log('✓ resources/cloudflared.exe');
}

async function fetchDarwin() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const tgz = path.join(RES, 'cloudflared-darwin.tgz');
  console.log('↓ cloudflared-darwin-' + arch + '.tgz');
  try {
    await download(BASE + 'cloudflared-darwin-' + arch + '.tgz', tgz);
  } catch (e) {
    await download(BASE + 'cloudflared-darwin-amd64.tgz', tgz);
  }
  execSync('tar -xzf ' + JSON.stringify(tgz) + ' -C ' + JSON.stringify(RES));
  fs.rmSync(tgz, { force: true });
  fs.chmodSync(path.join(RES, 'cloudflared'), 0o755);
  console.log('✓ resources/cloudflared');
}

async function fetchLinux() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const dest = path.join(RES, 'cloudflared');
  console.log('↓ cloudflared-linux-' + arch);
  await download(BASE + 'cloudflared-linux-' + arch, dest);
  fs.chmodSync(dest, 0o755);
  console.log('✓ resources/cloudflared');
}

(async () => {
  const target = (process.argv[2] || '').toLowerCase();
  const jobs = new Set();
  if (!target || target === 'all') {
    jobs.add('win'); // always need the Windows exe for packaging
    if (target === 'all') {
      jobs.add('mac');
      jobs.add('linux');
    } else {
      jobs.add(process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux');
    }
  } else {
    jobs.add(target);
  }

  if (jobs.has('win')) await fetchWin();
  if (jobs.has('mac')) {
    try { await fetchDarwin(); } catch (e) { console.warn('! darwin fetch skipped: ' + e.message); }
  }
  if (jobs.has('linux')) {
    try { await fetchLinux(); } catch (e) { console.warn('! linux fetch skipped: ' + e.message); }
  }
  console.log('done.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
