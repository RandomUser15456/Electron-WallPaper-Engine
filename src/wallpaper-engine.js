// wallpaper-engine.js
const { app, BrowserWindow, screen, ipcMain, Menu, Tray } = require('electron');
const path = require('path');
const koffi = require('koffi');

let wallpaperWindow = null;
let tray = null;
let currentTheme = 'bloom';
let settings = {
  speed: 5,
  intensity: 5,
  fps: 60
};

// --- Native Windows API bindings ---
const user32 = koffi.load('user32.dll');

const FindWindowA = user32.func('void* __stdcall FindWindowA(const char* lpClassName, const char* lpWindowName)');
const FindWindowExA = user32.func('void* __stdcall FindWindowExA(void* hWndParent, void* hWndChildAfter, const char* lpszClass, const char* lpszWindow)');
const SendMessageA = user32.func('uint64 __stdcall SendMessageA(void* hWnd, uint32 Msg, uint64 wParam, uint64 lParam)');
const SetParent = user32.func('void* __stdcall SetParent(void* hWndChild, void* hWndNewParent)');

const WM_COMMAND = 0x111;
const SetWindowPos = user32.func(
  'bool __stdcall SetWindowPos(uint64 hWnd, uint64 hWndInsertAfter, int X, int Y, int cx, int cy, uint32 uFlags)'
);


const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOACTIVATE = 0x0010;
const SWP_SHOWWINDOW = 0x0040;



function attachToDesktop(hwndBuf) {
  const progman = FindWindowA('Progman', null);
  SendMessageA(progman, WM_COMMAND, 0x052C, 0);

  setTimeout(() => {
    let shellViewWin = null;
    let workerw = null;
    let temp = FindWindowExA(null, null, 'WorkerW', null);

    while (temp) {
      const foundShell = FindWindowExA(temp, null, 'SHELLDLL_DefView', null);
      if (foundShell) {
        shellViewWin = foundShell;
        workerw = temp;
        break;
      }
      temp = FindWindowExA(null, temp, 'WorkerW', null);
    }

    if (!shellViewWin) {
      shellViewWin = FindWindowExA(progman, null, 'SHELLDLL_DefView', null);
      workerw = progman;
    }

    const hwnd = hwndBuf.readBigUInt64LE(0);
    const shellPtr = koffi.address(shellViewWin);
    SetParent(hwnd, workerw);
    SetWindowPos(hwnd, shellPtr, 0, 0, 0, 0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);

    console.log('Wallpaper window correctly between wallpaper and icons.');

  }, 800);
}



function createWallpaperWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  wallpaperWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: false,
    type: 'desktop',
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  wallpaperWindow.loadFile('src/wallpaper.html');
  wallpaperWindow.setIgnoreMouseEvents(true);

  wallpaperWindow.once('ready-to-show', () => {
    const hwndBuf = wallpaperWindow.getNativeWindowHandle();
    attachToDesktop(hwndBuf);
  });
  wallpaperWindow.setAlwaysOnTop(false);
  wallpaperWindow.setAlwaysOnTop(false, 'screen-saver', -1);
  wallpaperWindow.on('close', (e) => e.preventDefault());
}


function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Themes',
      submenu: [
        { label: 'Bloom', type: 'radio', checked: true, click: () => changeTheme('bloom') },
        { label: 'Aurora', type: 'radio', click: () => changeTheme('aurora') },
        { label: 'Abstract', type: 'radio', click: () => changeTheme('abstract') },
        { label: 'Dark', type: 'radio', click: () => changeTheme('dark') },
        { label: 'Particles', type: 'radio', click: () => changeTheme('particles') }
      ]
    },
    { type: 'separator' },
    {
      label: 'Speed',
      submenu: [
        { label: 'Slow', click: () => updateSettings({ speed: 2 }) },
        { label: 'Normal', click: () => updateSettings({ speed: 5 }) },
        { label: 'Fast', click: () => updateSettings({ speed: 8 }) }
      ]
    },
    {
      label: 'Intensity',
      submenu: [
        { label: 'Low', click: () => updateSettings({ intensity: 3 }) },
        { label: 'Medium', click: () => updateSettings({ intensity: 5 }) },
        { label: 'High', click: () => updateSettings({ intensity: 8 }) }
      ]
    },
    { type: 'separator' },
    { label: 'Pause/Resume', click: toggleAnimation },
    { type: 'separator' },
    { label: 'Exit', click: () => { wallpaperWindow.destroy(); app.quit(); } }
  ]);

  tray.setToolTip('Wallpaper Engine');
  tray.setContextMenu(contextMenu);

}

function changeTheme(theme) {
  currentTheme = theme;
  wallpaperWindow.webContents.send('change-theme', theme);
}

function updateSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  wallpaperWindow.webContents.send('update-settings', settings);
}

function toggleAnimation() {
  wallpaperWindow.webContents.send('toggle-animation');
}

app.whenReady().then(() => {
  createWallpaperWindow();
  createTray();
});

app.on('window-all-closed', (e) => e.preventDefault());
