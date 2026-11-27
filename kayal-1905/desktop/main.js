// Kayal 1957 — the desktop shell. Opens the game in its own window
// (fullscreen by default), on the fast GPU, with saves kept on this computer.
const { app, BrowserWindow, ipcMain, Menu, shell, session, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// the game is served from app://kayal/ rather than file://, so its texture files count as the
// page's own (WebGL refuses images it considers foreign) and saves have a stable home
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const GAME = path.join(__dirname, 'game');

// prefer the discrete GPU on laptops. Chromium's GPU blocklist is respected, exactly as in Chrome or
// Edge: overriding it (ignore-gpu-blocklist, enable-gpu-rasterization) switched on driver features
// Chromium knows to be broken on some Radeon integrated GPUs, and every canvas came out blank white.
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

if (!app.requestSingleInstanceLock()) { app.quit(); }

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function loadSettings() { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return { fullscreen: true }; } }
function saveSettings(s) { try { fs.writeFileSync(settingsFile(), JSON.stringify(s)); } catch { /* not fatal */ } }

let win = null;
function createWindow() {
  const settings = loadSettings();
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540,
    fullscreen: settings.fullscreen !== false,
    backgroundColor: '#000000', show: false, autoHideMenuBar: true,
    title: 'Kayal — Kerala, 1957',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false, spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.loadURL('app://kayal/index.html');

  const tellFull = () => { const on = win.isFullScreen(); settings.fullscreen = on; saveSettings(settings); win.webContents.send('kayal:fullscreenChanged', on); };
  win.on('enter-full-screen', tellFull);
  win.on('leave-full-screen', tellFull);
  // F11 and Alt+Enter toggle fullscreen, as in most PC games
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  // the game never navigates away or opens windows; anything that tries goes to the system browser
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://kayal/')) e.preventDefault(); });
  win.on('closed', () => { win = null; });
}

ipcMain.on('kayal:quit', () => app.quit());
ipcMain.on('kayal:fullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); });
ipcMain.handle('kayal:isFullscreen', () => !!(win && win.isFullScreen()));

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
    const file = path.normalize(path.join(GAME, rel));
    if (!file.startsWith(GAME + path.sep)) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  // mouse capture for the camera is the only permission the game needs
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'pointerLock' || perm === 'fullscreen'));
  createWindow();
  app.on('activate', () => { if (!win) createWindow(); });
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
