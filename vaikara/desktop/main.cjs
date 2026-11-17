// Vaikara desktop app (Electron). Serves the built game from a private,
// secure custom protocol so fetch, WebGPU and pointer lock all work exactly as
// on the web, without a local server.
const { app, BrowserWindow, protocol, Menu, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEV = process.argv.includes('--dev') || process.env.VAIKARA_DEV === '1';
const ROOT = path.join(__dirname, '..', 'dist');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.gz': 'application/octet-stream', '.bin': 'application/octet-stream', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary',
  '.md': 'text/markdown', '.wasm': 'application/wasm',
};

// GPU: prefer the discrete GPU, allow WebGPU everywhere Chromium can run it.
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan,WebGPUDeveloperFeatures');
if (process.env.VAIKARA_SWIFTSHADER) { // testing without a GPU: core-mode WebGPU on SwiftShader Vulkan
  app.commandLine.appendSwitch('use-vulkan', 'swiftshader');
  app.commandLine.appendSwitch('use-webgpu-adapter', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'vaikara', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

function serve() {
  protocol.handle('vaikara', async (req) => {
    const url = new URL(req.url);
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) return new Response('forbidden', { status: 403 });
    try {
      const stat = await fs.promises.stat(file);
      const body = fs.createReadStream(file);
      return new Response(require('node:stream').Readable.toWeb(body), {
        headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'content-length': String(stat.size) },
      });
    } catch {
      return new Response('not found', { status: 404 });
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540,
    backgroundColor: '#0b0907', title: 'Vaikara — Malabar Coast, 1905',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  const SELFTEST = process.env.VAIKARA_SELFTEST; // path of a screenshot to write, then quit
  win.loadURL(DEV ? 'http://localhost:5173/' : `vaikara://app/index.html${SELFTEST ? '?' + (process.env.VAIKARA_Q || 'shot&frames=4&q=low&at=vaikara_town&hour=10') : ''}`);
  if (SELFTEST) {
    const seen = new Set();
    win.webContents.on('console-message', (e) => { const m = (e.message || '').slice(0, 300); if (!seen.has(m) && seen.size < 40) { seen.add(m); console.log('[page]', m); } });
    const poll = setInterval(async () => {
      const done = await win.webContents.executeJavaScript('!!(window.__vaikara && window.__vaikara.done) || document.getElementById("err").textContent').catch(() => false);
      if (!done) return;
      clearInterval(poll);
      const info = await win.webContents.executeJavaScript('JSON.stringify({ backend: window.__vaikara && window.__vaikara.G.backend, err: document.getElementById("err").textContent })');
      fs.writeFileSync(SELFTEST, (await win.webContents.capturePage()).toPNG());
      console.log('[selftest]', info);
      app.quit();
    }, 1000);
  }
  // F11 fullscreen, F12 devtools, Ctrl+R reload
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F12') { win.webContents.toggleDevTools(); e.preventDefault(); }
    if (input.key.toLowerCase() === 'r' && input.control) { win.reload(); e.preventDefault(); }
  });
  // open external links in the system browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  serve();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
