const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow = null;

// Load UI from Vite dev server when explicitly in dev mode; otherwise from built dist
const isDev = process.env.ELECTRON_DEV === '1' && !app.isPackaged;

// When running from source (unpackaged), use repo paths. When packaged, use app bundle.
const isPackaged = app.isPackaged;

function getTemplatePath() {
  if (!isPackaged) {
    return path.join(__dirname, '..', 'resources', 'template.json');
  }
  return path.join(process.resourcesPath, 'resources', 'template.json');
}

function getProcessorPath() {
  if (!isPackaged) {
    return path.join(__dirname, '..', 'processor', 'run_processor.py');
  }
  const exe = process.platform === 'win32' ? 'processor.exe' : 'processor';
  // Universal: processor (arm64), processor-x64 (x64). On x64 never use processor/ (arm64) or we get EBADARCH -86.
  if (process.arch === 'x64') {
    const x64Path = path.join(process.resourcesPath, 'processor-x64', exe);
    if (fs.existsSync(x64Path)) return x64Path;
    return path.join(process.resourcesPath, 'processor', exe); // x64-only build has only processor/
  }
  const arm64Path = path.join(process.resourcesPath, 'processor', exe);
  if (fs.existsSync(arm64Path)) return arm64Path;
  return path.join(process.resourcesPath, 'processor-x64', exe);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 560,
    minHeight: 560,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'GoodPhotographer',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Open file picker for adding photos
ipcMain.handle('select-photos', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
  });
  return canceled ? [] : filePaths;
});

// Create timestamped export folder: ~/Downloads/GoodPhotographer/YYYY-MM-DD_HHMMSS/
ipcMain.handle('get-export-dir', () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const dir = path.join(os.homedir(), 'Downloads', 'GoodPhotographer', `${date}_${time}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
});

// Open folder in Finder
ipcMain.handle('open-export-folder', (_, dir) => {
  shell.showItemInFolder(path.join(dir, '.'));
});

// Run Python processor (dev: python run_processor.py; prod: bundled binary)
ipcMain.handle('run-processor', async (_, payload) => {
  const { exportDir, photos, formats } = payload;
  const templatePath = getTemplatePath();
  const configPath = path.join(exportDir, '_config.json');
  const config = {
    template_path: templatePath,
    export_dir: exportDir,
    photos,
    formats,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const processorPath = getProcessorPath();
  const isPython = String(processorPath).endsWith('.py');
  const cwd = path.dirname(processorPath);

  return new Promise((resolve, reject) => {
    const args = isPython ? [processorPath, configPath] : [configPath];
    const proc = spawn(isPython ? 'python3' : processorPath, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const progress = { current: 0, total: photos.length, errors: [] };

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      const lines = chunk.split('\n');
      for (const line of lines) {
        const m = line.match(/^PROGRESS\s+(\d+)\s+(\d+)/);
        if (m) {
          progress.current = parseInt(m[1], 10);
          progress.total = parseInt(m[2], 10);
          mainWindow?.webContents.send('processor-progress', progress);
        }
        if (line.startsWith('ERROR:')) {
          progress.errors.push(line.slice(6).trim());
          mainWindow?.webContents.send('processor-progress', { ...progress });
        }
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const errors = progress.errors.slice();
      if (code !== 0 && stderr.trim()) {
        const tail = stderr.trim().split('\n').slice(-5).join(' ');
        if (tail) errors.push(`Processor exit ${code}: ${tail}`);
      }
      resolve({
        success: code === 0,
        exportDir,
        errors,
      });
    });

    proc.on('error', (err) => {
      const msg = err.message || '';
      const isBadArch = msg.includes('-86') || err.code === 'EBADARCH' || msg.includes('Bad CPU type');
      if (isBadArch && process.arch === 'x64') {
        reject(new Error('This install does not include the Intel processor. On an Intel Mac, use the "Intel" download from the GoodPhotographer README (GoodPhotographer-0.1.0-x64.dmg).'));
      } else if (isBadArch) {
        reject(new Error('Processor architecture mismatch. Use the Universal or Intel download that matches your Mac.'));
      } else {
        reject(err);
      }
    });
  });
});
