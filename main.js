/**
 * @description Electron 主进程文件
 */
const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const remote = require('@electron/remote/main');

// 初始化remote模块
remote.initialize();

// 尝试加载puppeteer
let puppeteer;
try {
  puppeteer = require('puppeteer');
  console.log('Puppeteer加载成功');
} catch (error) {
  console.warn('未安装puppeteer，某些网络搜索功能可能不可用。建议执行：npm install puppeteer');
  // 不打断程序运行
}

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
// 默认语言设置为中文
let currentLanguage = 'zh';

/**
 * @description 获取用户配置
 * @returns {Object} 用户配置
 */
function getUserConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (error) {
    console.error('获取用户配置失败:', error);
  }
  return {};
}

/**
 * @description 保存用户配置
 * @param {Object} configData - 配置数据
 * @returns {boolean} 是否保存成功
 */
function saveUserConfig(configData) {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    let existingConfig = {};
    
    // 如果配置文件已存在，读取它
    if (fs.existsSync(configPath)) {
      existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    // 合并配置
    const newConfig = { ...existingConfig, ...configData };
    
    // 保存回文件
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('保存用户配置失败:', error);
    return false;
  }
}

/**
 * @description 获取API密钥
 * @returns {string|null} API密钥或null
 */
function getApiKey() {
  const config = getUserConfig();
  return config.apiKey || null;
}

/**
 * @description 保存API密钥
 * @param {string} apiKey - API密钥
 * @returns {boolean} 是否保存成功
 */
function saveApiKey(apiKey) {
  return saveUserConfig({ apiKey });
}

/**
 * @description 获取语言设置
 * @returns {string} 语言代码
 */
function getLanguage() {
  const config = getUserConfig();
  return config.language || 'zh'; // 默认中文
}

/**
 * @description 保存语言设置
 * @param {string} language - 语言代码
 * @returns {boolean} 是否保存成功
 */
function saveLanguage(language) {
  return saveUserConfig({ language });
}

/**
 * @description 设置应用菜单
 * @param {string} language - 语言代码 ('zh' 或 'en')
 */
function setApplicationMenu(language) {
  currentLanguage = language;
  
  const menuTemplates = {
    zh: [
      {
        label: '文件',
        submenu: [
          { role: 'quit', label: '退出' }
        ]
      },
      {
        label: '编辑',
        submenu: [
          { role: 'undo', label: '撤销' },
          { role: 'redo', label: '恢复' },
          { type: 'separator' },
          { role: 'cut', label: '剪切' },
          { role: 'copy', label: '复制' },
          { role: 'paste', label: '粘贴' },
          { role: 'delete', label: '删除' },
          { role: 'selectAll', label: '全选' }
        ]
      },
      {
        label: '视图',
        submenu: [
          { role: 'reload', label: '重新加载' },
          { role: 'forceReload', label: '强制重新加载' },
          { role: 'toggleDevTools', label: '切换开发者工具' },
          { type: 'separator' },
          { role: 'resetZoom', label: '实际大小' },
          { role: 'zoomIn', label: '放大' },
          { role: 'zoomOut', label: '缩小' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: '切换全屏' }
        ]
      },
      {
        label: '窗口',
        submenu: [
          { role: 'minimize', label: '最小化' },
          { role: 'zoom', label: '缩放' },
          { role: 'close', label: '关闭' }
        ]
      },
      {
        label: '帮助',
        submenu: [
          {
            label: '语言/Language',
            submenu: [
              {
                label: '中文',
                type: 'radio',
                checked: language === 'zh',
                click: () => {
                  saveLanguage('zh');
                  setApplicationMenu('zh');
                  mainWindow.webContents.send('language-changed', 'zh');
                }
              },
              {
                label: 'English',
                type: 'radio',
                checked: language === 'en',
                click: () => {
                  saveLanguage('en');
                  setApplicationMenu('en');
                  mainWindow.webContents.send('language-changed', 'en');
                }
              }
            ]
          },
          { role: 'about', label: '关于' }
        ]
      }
    ],
    en: [
      {
        label: 'File',
        submenu: [
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'delete' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { role: 'close' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Language/语言',
            submenu: [
              {
                label: '中文',
                type: 'radio',
                checked: language === 'zh',
                click: () => {
                  saveLanguage('zh');
                  setApplicationMenu('zh');
                  mainWindow.webContents.send('language-changed', 'zh');
                }
              },
              {
                label: 'English',
                type: 'radio',
                checked: language === 'en',
                click: () => {
                  saveLanguage('en');
                  setApplicationMenu('en');
                  mainWindow.webContents.send('language-changed', 'en');
                }
              }
            ]
          },
          { role: 'about' }
        ]
      }
    ]
  };
  
  const menu = Menu.buildFromTemplate(menuTemplates[language]);
  Menu.setApplicationMenu(menu);
}

/**
 * @description 创建主窗口
 * @returns {void}
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'E-paper.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: true,
      // 允许安全访问剪贴板
      additionalArguments: ['--enable-features=SharedArrayBuffer,enable-clipboard-read'],
      // 确保WebSQL和LocalStorage在第一个窗口关闭后不会被清除
      backgroundThrottling: false,
      // 允许访问本地资源
      webSecurity: true
    }
  });

  // 启用远程模块
  remote.enable(mainWindow.webContents);

  // 设置内容安全策略，允许从cdnjs.cloudflare.com加载资源
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ["default-src 'self' http://export.arxiv.org https://export.arxiv.org https://api.siliconflow.cn; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data: http: https:; connect-src 'self' http://export.arxiv.org https://export.arxiv.org https://api.siliconflow.cn"]
      }
    });
  });

  mainWindow.loadFile('index.html');
  
  // 只在开发模式下自动打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 注册 F12 快捷键
  globalShortcut.register('F12', () => {
    mainWindow.webContents.toggleDevTools();
  });

  // 添加语音识别相关权限请求处理
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      // 允许访问摄像头和麦克风
      return callback(true);
    }
    
    // 默认行为
    callback(false);
  });
}

// 应用激活事件处理（macOS特有）
app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.whenReady().then(() => {
  // 获取保存的语言设置或默认使用中文
  currentLanguage = getLanguage();
  
  // 设置应用菜单
  setApplicationMenu(currentLanguage);
  
  createWindow();

  // 注册IPC事件处理程序
  ipcMain.handle('get-api-key', async () => {
    return getApiKey();
  });

  ipcMain.handle('save-api-key', async (_, apiKey) => {
    return saveApiKey(apiKey);
  });

  ipcMain.handle('get-language', async () => {
    return getLanguage();
  });

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('dialog:showInputBox', async (_, options) => {
    return await dialog.showMessageBox(mainWindow, options);
  });
  
  ipcMain.handle('open-external', async (_, url) => {
    try {
      await shell.openExternal(url);
      return true;
    } catch (error) {
      console.error('打开外部链接失败:', error);
      return false;
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