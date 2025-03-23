/**
 * @description Electron 主进程文件
 */
const { app, BrowserWindow, globalShortcut, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const remote = require('@electron/remote/main');

// 初始化remote模块
remote.initialize();

/**
 * @description 开发环境下启用热重载
 */
const isDev = process.env.NODE_ENV === 'development';
if (isDev) {
  try {
    require('electron-reloader')(module, {
      debug: true,
      watchRenderer: true,
      ignore: [
        'node_modules/**/*',
        'package.json',
        'package-lock.json'
      ]
    });
    // 恢复中文消息
    console.log('热重载已启用，正在监听文件变化...');
  } catch (err) { 
    console.error('热重载配置失败:', err); 
  }
}

// 存储窗口的引用
let mainWindow;

/**
 * @description 获取API密钥
 * @returns {string|null} API密钥或null
 */
function getApiKey() {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return configData.apiKey || null;
    }
  } catch (error) {
    console.error('获取API密钥失败:', error);
  }
  return null;
}

/**
 * @description 保存API密钥
 * @param {string} apiKey - API密钥
 * @returns {boolean} 是否保存成功
 */
function saveApiKey(apiKey) {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    let configData = {};
    
    // 如果配置文件已存在，读取它
    if (fs.existsSync(configPath)) {
      configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    // 更新API密钥
    configData.apiKey = apiKey;
    
    // 保存回文件
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('保存API密钥失败:', error);
    return false;
  }
}

/**
 * @description 创建主窗口
 * @returns {void}
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 启用远程模块
  remote.enable(mainWindow.webContents);

  mainWindow.loadFile('index.html');
  
  // 只在开发模式下自动打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 注册 F12 快捷键
  globalShortcut.register('F12', () => {
    mainWindow.webContents.toggleDevTools();
  });
}

app.whenReady().then(() => {
  createWindow();

  // 设置IPC监听器
  ipcMain.handle('get-api-key', () => getApiKey());
  ipcMain.handle('save-api-key', (event, apiKey) => saveApiKey(apiKey));
  
  // 添加选择目录的IPC处理程序
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择导出文件保存位置'
    });
    
    if (result.canceled) {
      return null;
    }
    
    return result.filePaths[0];
  });

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