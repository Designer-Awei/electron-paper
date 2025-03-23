/**
 * @description Electron 主进程文件
 */
const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell } = require('electron');
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
  
  // 添加打开外部链接的IPC处理程序
  ipcMain.handle('open-external', async (event, url) => {
    try {
      await shell.openExternal(url);
      return true;
    } catch (error) {
      console.error('打开外部链接失败:', error);
      return false;
    }
  });

  // 处理输入框对话框请求
  ipcMain.handle('dialog:showInputBox', async (event, options) => {
    // 获取当前窗口
    const focusedWindow = BrowserWindow.getFocusedWindow();
    
    // 确保文件名中含有扩展名
    const defaultFileName = options.defaultValue || 'arxiv-papers';
    const defaultPath = defaultFileName.endsWith('.json') ? defaultFileName : `${defaultFileName}.json`;
    
    // 使用保存文件对话框让用户输入文件名
    const result = await dialog.showSaveDialog(focusedWindow, {
      title: options.title || '保存文件',
      defaultPath: defaultPath,
      buttonLabel: '保存',
      filters: [
        { name: 'JSON文件', extensions: ['json'] }
      ]
    });
    
    if (result.canceled) {
      // 用户取消了保存操作
      return { canceled: true, value: '' };
    } else {
      // 用户选择了保存位置和文件名
      // 提取文件名（不含路径和扩展名）
      const fullPath = result.filePath;
      const fileName = path.basename(fullPath, '.json');
      return { canceled: false, value: fileName, fullPath: fullPath };
    }
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