// Manages the cloudflared child process:
//  - starts a token-based tunnel  (cloudflared tunnel run, token via env)
//  - parses output to count registered edge connections (0..4)
//  - auto-restarts on crash with backoff  (replaces the .bat :loop trick)
const { spawn } = require('child_process');

// "Registered tunnel connection connIndex=0 ..." (modern) or "Connection <id> registered" (older).
// The (?:^|[^a-z]) guard stops "Unregistered tunnel connection" (a drop event) from counting.
const CONN_RE = /(?:^|[^a-z])registered tunnel connection|\bconnection\b[^\n]*?(?:^|[^a-z])registered\b/i;
const TOKEN_ERR_RE = /(unauthorized|invalid.*(token|tunnel secret)|failed to (parse|unmarshal|read).*token|token is (invalid|empty)|error parsing tunnel id)/i;
const CREDS_ERR_RE = /(credentials file .*(doesn't exist|not a file)|couldn't read|error reading config|error parsing (the )?config|tunnel .* not found)/i;

class TunnelManager {
  constructor(opts) {
    this.opts = opts; // { binPath, token, onLog, onConnection, onConnecting, onError, onExit }
    this.child = null;
    this.manualStop = false;
    this.connections = 0;
    this.restartTimer = null;
    this.backoff = 2000;
    this._stableTimer = null;
  }

  isRunning() {
    return !!this.child;
  }

  start() {
    this.manualStop = false;
    this.connections = 0;
    this._spawn();
  }

  _spawn() {
    const o = this.opts;
    const env = { ...process.env };
    let args;
    if (o.mode === 'demo') {
      // token-less quick tunnel on trycloudflare.com (for testing)
      args = ['--no-autoupdate', 'tunnel', '--url', 'http://localhost:' + (o.localPort || 4001)];
    } else if (o.mode === 'local') {
      // locally-managed named tunnel; port + hostname come from the generated config.yml
      // (--config must precede "tunnel run")
      args = ['--no-autoupdate', '--config', o.configPath, 'tunnel', 'run'];
    } else {
      // token (remotely-managed) tunnel; token via env, not argv
      args = ['--no-autoupdate', 'tunnel', 'run'];
      env.TUNNEL_TOKEN = o.token;
    }

    let child;
    try {
      child = spawn(this.opts.binPath, args, { env, windowsHide: true });
    } catch (e) {
      this._emitError('Cannot launch cloudflared: ' + e.message);
      this._scheduleRestart(-1);
      return;
    }
    this.child = child;
    if (this.opts.onConnecting) this.opts.onConnecting();

    const handle = (buf) => {
      buf
        .toString()
        .split(/\r?\n/)
        .forEach((line) => {
          if (!line.trim()) return;
          if (this.opts.onLog) this.opts.onLog(line);
          const url = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
          if (url && this.opts.onUrl) this.opts.onUrl(url[0]);
          if (CONN_RE.test(line)) {
            this.connections = Math.min(4, this.connections + 1);
            if (this.opts.onConnection) this.opts.onConnection(this.connections);
          } else if (TOKEN_ERR_RE.test(line)) {
            this._emitError('Cloudflare رفض الاتصال — راجع الـ token في config.json.');
          } else if (CREDS_ERR_RE.test(line)) {
            this._emitError('مشكلة في ملف credentials أو الإعدادات — راجع tunnelId و credentialsFile في config.json.');
          }
        });
    };

    if (child.stdout) child.stdout.on('data', handle);
    if (child.stderr) child.stderr.on('data', handle); // cloudflared logs to stderr

    child.on('error', (e) => this._emitError('cloudflared error: ' + e.message));

    child.on('exit', (code, signal) => {
      this.child = null;
      if (this._stableTimer) clearTimeout(this._stableTimer);
      const exitInfo = code == null ? signal : code;
      if (this.manualStop) {
        this.backoff = 2000;
        if (this.opts.onExit) this.opts.onExit(exitInfo, false);
      } else {
        if (this.opts.onExit) this.opts.onExit(exitInfo, true);
        this._scheduleRestart(exitInfo);
      }
    });

    // if it survives 30s, treat it as stable and reset backoff
    this._stableTimer = setTimeout(() => {
      if (this.child === child) this.backoff = 2000;
    }, 30000);
  }

  _scheduleRestart() {
    this.restartTimer = setTimeout(() => {
      this.connections = 0;
      this._spawn();
    }, this.backoff);
    this.backoff = Math.min(Math.round(this.backoff * 1.5), 30000);
  }

  _emitError(msg) {
    if (this.opts.onError) this.opts.onError(msg);
  }

  stop() {
    this.manualStop = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this._stableTimer) {
      clearTimeout(this._stableTimer);
      this._stableTimer = null;
    }
    if (this.child) {
      try {
        this.child.kill();
      } catch (e) {
        /* ignore */
      }
    }
  }
}

module.exports = { TunnelManager };
