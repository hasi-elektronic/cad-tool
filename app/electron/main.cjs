// HASI CAD desktop shell (Electron main process).
// Loads the built Vite bundle from dist/ and forwards OS "open with"
// file arguments (.dxf / .hasicad.json) to the renderer.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;

// A file passed on the command line (double-click / "Öffnen mit" on Windows).
function fileArgFrom(argv) {
  return argv
    .slice(1)
    .find((a) => /\.(dxf|json|hasicad)$/i.test(a) && fs.existsSync(a));
}

let mainWindow = null;
let pendingFile = fileArgFrom(process.argv);

function sendFileToRenderer(filePath) {
  if (!mainWindow || !filePath) return;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    mainWindow.webContents.send('hasi:open-file', {
      name: path.basename(filePath),
      content,
    });
  } catch (err) {
    console.error('Datei konnte nicht gelesen werden:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#101018',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFile) {
      sendFileToRenderer(pendingFile);
      pendingFile = null;
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (DEV_URL) mainWindow.loadURL(DEV_URL);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

// Single instance: a second launch (e.g. double-clicking another DXF)
// forwards its file to the already-running window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_ev, argv) => {
    const f = fileArgFrom(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      sendFileToRenderer(f);
    }
  });

  // macOS "open with".
  app.on('open-file', (ev, filePath) => {
    ev.preventDefault();
    if (mainWindow) sendFileToRenderer(filePath);
    else pendingFile = filePath;
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

ipcMain.handle('hasi:version', () => app.getVersion());
