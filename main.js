/**
 * @description Electron 主进程文件
 */
const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell, Menu } = require('electron');
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
  // 获取保存的语言设置或默认使用中文
  currentLanguage = getLanguage();
  
  // 设置应用菜单
  setApplicationMenu(currentLanguage);
  
  createWindow();

  // 设置IPC监听器
  ipcMain.handle('get-api-key', () => getApiKey());
  ipcMain.handle('save-api-key', (event, apiKey) => saveApiKey(apiKey));
  
  // 添加获取当前语言的IPC处理程序
  ipcMain.handle('get-language', () => currentLanguage);
  
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