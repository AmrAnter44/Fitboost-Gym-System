const el = (id) => document.getElementById(id);

const STATUS_AR = {
  idle: 'في الانتظار',
  starting: 'جاري البدء…',
  connecting: 'جاري الاتصال…',
  connected: 'متصل ✓',
  error: 'خطأ',
  stopped: 'متوقف',
};
let lastPct = 0;
let setupAutoCollapsed = false;

function pct(s) {
  if (s.status === 'connected') return s.connections >= 4 ? 100 : 30 + s.connections * 17.5;
  if (s.status === 'connecting') return Math.max(30, 30 + s.connections * 17.5);
  if (s.status === 'starting') return 15;
  if (s.status === 'error') return lastPct; // keep the bar where it was, just turn red
  return 0; // idle / stopped
}

function render(s) {
  const p = Math.round(pct(s));
  lastPct = p;

  el('bar').style.width = p + '%';
  el('bar').className = 'bar ' + s.status;
  el('pct').textContent = p + '%';
  el('statusText').textContent = STATUS_AR[s.status] || s.status;

  el('pillText').textContent = STATUS_AR[s.status] || s.status;
  el('statusPill').className = 'pill ' + s.status;
  document.body.dataset.status = s.status;
  el('message').textContent = s.message || '';

  for (let i = 1; i <= 4; i++) {
    el('dot' + i).className = 'dot' + (s.connections >= i ? ' on' : '');
  }
  el('connCount').textContent = (s.connections || 0) + '/4';

  el('serverDot').className = 'statedot ' + (s.serverUp ? 'up' : 'down');
  el('serverText').textContent = s.serverUp
    ? 'السيرفر المحلي شغّال (localhost:' + s.localPort + ')'
    : 'السيرفر المحلي مش شغّال على المنفذ ' + s.localPort;

  if (s.publicUrl) {
    el('urlCard').style.display = 'flex';
    el('urlLink').textContent = s.publicUrl;
    el('urlLink').dataset.url = s.publicUrl;
  } else {
    el('urlCard').style.display = 'none';
  }

  el('keepAwake').checked = !!s.keepAwake;
  el('autoLaunch').checked = !!s.autoLaunch;
  el('restarts').textContent = s.restarts || 0;

  const running = ['starting', 'connecting', 'connected'].includes(s.status);
  el('startBtn').disabled = running;
  el('stopBtn').disabled = !running;

  // collapse the setup panel once if the tunnel is already configured
  if (!setupAutoCollapsed && s.configured) {
    setupAutoCollapsed = true;
    const setup = document.getElementById('setup');
    if (setup) setup.classList.add('collapsed');
  }
}

window.api.onStatus(render);
window.api.onLog((line) => {
  const box = el('log');
  const div = document.createElement('div');
  div.className = 'logline';
  div.textContent = line;
  box.appendChild(div);
  while (box.childNodes.length > 200) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
});
window.api.getState().then(render);

el('startBtn').onclick = () => window.api.start();
el('stopBtn').onclick = () => window.api.stop();
el('restartBtn').onclick = () => window.api.restart();
el('minBtn').onclick = () => window.api.hide();
el('quitBtn').onclick = () => window.api.quit();
el('configBtn').onclick = () => window.api.openConfig();
el('reloadBtn').onclick = () => window.api.reloadConfig();
el('urlCard').onclick = (e) => {
  e.preventDefault();
  const url = el('urlLink').dataset.url;
  if (url) window.api.openUrl(url);
};
el('keepAwake').onchange = (e) => window.api.setKeepAwake(e.target.checked);
el('autoLaunch').onchange = (e) => window.api.setAutoLaunch(e.target.checked);
el('logToggle').onclick = () => el('logToggle').closest('.logs').classList.toggle('open');

// brand logo: use logo.png next to index.html if present, otherwise the built-in mark
const logoImg = el('logoImg');
const logoSvg = el('logoSvg');
if (logoImg) {
  logoImg.onload = () => logoImg.closest('.logo').classList.add('has-img');
  logoImg.onerror = () => {}; // keep the built-in bolt mark
  logoImg.src = 'logo.png';
}

// ---------- in-app tunnel setup ----------
let loggedIn = false;
let busy = false;

function setLogin(ok) {
  loggedIn = ok;
  el('loginDot').className = 'statedot ' + (ok ? 'up' : 'down');
  el('loginState').textContent = ok ? 'مسجّل دخول ✓' : 'مش مسجّل دخول';
  el('loginBtn').style.display = ok ? 'none' : '';
  updateCreateBtn();
}
function updateCreateBtn() {
  el('createBtn').disabled = busy || !loggedIn || !el('domInput').value.trim();
}
function setupLog(line) {
  const box = el('setupLog');
  box.textContent += (box.textContent ? '\n' : '') + line;
  box.scrollTop = box.scrollHeight;
}
function collapseSetup(collapse) {
  el('setup').classList.toggle('collapsed', collapse);
}

window.api.setupStatus().then((s) => setLogin(!!s.loggedIn));
window.api.onSetupProgress(setupLog);

el('setupToggle').onclick = () => el('setup').classList.toggle('collapsed');
el('domInput').oninput = updateCreateBtn;
el('subInput').oninput = updateCreateBtn;

el('loginBtn').onclick = async () => {
  if (busy) return;
  busy = true;
  el('loginBtn').disabled = true;
  el('loginState').textContent = 'بيفتح المتصفح…';
  updateCreateBtn();
  try {
    const r = await window.api.login();
    if (r && r.ok) setLogin(true);
    else {
      setLogin(false);
      setupLog(r && r.error ? r.error : 'اللوجن فشل.');
    }
  } finally {
    busy = false;
    el('loginBtn').disabled = false;
    updateCreateBtn();
  }
};

el('createBtn').onclick = async () => {
  if (busy || !loggedIn) return;
  const domain = el('domInput').value.trim();
  if (!domain) return;
  busy = true;
  updateCreateBtn();
  el('createBtn').textContent = 'جاري الإنشاء…';
  el('setupLog').textContent = '';
  try {
    const r = await window.api.createTunnel({
      subdomain: el('subInput').value.trim(),
      domain,
      port: el('portInput').value.trim(),
    });
    if (r && r.ok) {
      setupLog('✓ اتعمل: ' + r.hostname);
      setTimeout(() => collapseSetup(true), 1500);
    } else {
      setupLog('✗ ' + (r && r.error ? r.error : 'فشل الإنشاء.'));
    }
  } finally {
    busy = false;
    el('createBtn').textContent = 'إنشاء وتشغيل';
    updateCreateBtn();
  }
};
