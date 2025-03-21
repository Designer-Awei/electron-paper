/**
 * @description Electron 主进程文件
 */
const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

/**
 * @description 开发环境下启用热重载
 */
try {
  require('electron-reloader')(module, {
    debug: true,
    watchRenderer: true
  });
} catch (_) { console.log('Error'); }

/**
 * @description 创建主窗口
 * @returns {void}
 */
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  
  // 打开开发者工具
  mainWindow.webContents.openDevTools();

  // 注册 F12 快捷键
  globalShortcut.register('F12', () => {
    mainWindow.webContents.toggleDevTools();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 当应用退出时注销所有快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
}); 