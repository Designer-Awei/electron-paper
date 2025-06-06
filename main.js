/**
 * @description Electron 主进程文件
 */
const { app, BrowserWindow, globalShortcut, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const remote = require('@electron/remote/main');
const os = require('os');
const dataAgent = require('./dataAgent.js');

// 初始化remote模块
remote.initialize();

// 尝试加载puppeteer
let puppeteer;
try {
  puppeteer = require('puppeteer');
  console.log('Puppeteer loaded successfully');
} catch (error) {
  console.warn('Puppeteer is not installed. Some web search features may be unavailable. Please run: npm install puppeteer');
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
        'package-lock.json',
        'python_env/**/*',
        'dist/**/*'
      ]
    });
    // 恢复中文消息
    console.log('Hot reload enabled, watching file changes...');
  } catch (err) { 
    console.error('Hot reload configuration failed:', err);
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
 * 获取系统和运行环境信息
 * @returns {string} 详细信息字符串
 */
function getSystemInfo() {
  const appVersion = app.getVersion();
  const electronVersion = process.versions.electron;
  const nodeVersion = process.versions.node;
  const v8Version = process.versions.v8;
  const platform = os.platform();
  const arch = os.arch();
  const osVersion = os.release();
  return [
    `Electron Paper`,
    `版本: ${appVersion}`,
    `Electron: ${electronVersion}`,
    `Node.js: ${nodeVersion}`,
    `V8: ${v8Version}`,
    `OS: ${platform} ${arch} ${osVersion}`,
    '作者: zhangweiwei3099@gmail.com',
    'GitHub: https://github.com/Designer-Awei/electron-paper'
  ].join('\n');
}

/**
 * @description 设置应用菜单
 * @param {string} language - 语言代码 ('zh' 或 'en')
 */
function setApplicationMenu(language) {
  currentLanguage = language;

  // 组件化内容
  const ENV_INFO = getSystemInfo();

  const USAGE_INFO = [
    '【系统主要用法】',
    '1. 文献检索：在"文献检索"标签页输入关键词或arXiv ID，支持多条件组合搜索、结果排序、日期过滤。',
    '2. 查看详情：点击论文标题可展开详细信息，包括摘要、作者、分类、笔记等。',
    '3. AI助手：点击右上角"召唤Awei"按钮，输入学术问题，AI助手将智能分析并推荐相关文献。',
    '4. 翻译功能：在"系统设置"中配置SiliconFlow API密钥，点击"翻译"按钮可一键翻译标题和摘要。',
    '5. 收藏与历史：可将论文加入收藏夹，历史检索自动保存，便于快速复用。',
    '6. 本地知识库：支持导出论文到本地知识库，添加个人笔记、标记已读/未读，支持中英文切换。',
    '7. 批量操作：支持批量选择、导出、收藏、删除等操作。',
    '8. 下载与访问：可直接下载PDF或跳转arXiv官网。',
    '',
    '【常见问题】',
    '- 安装时如何更改安装路径？安装程序界面可自定义。',
    '- 安装后找不到应用？请在开始菜单"Electron Paper"文件夹查找。',
    '- 打包或运行报错？请关闭所有实例后重试。',
    '- 翻译功能无法使用？请检查API密钥配置和网络。',
    '- 链接无法打开？请确保系统已设置默认浏览器。',
    '- AI助手回复异常？可尝试重启应用。'
  ].join('\n');

  const FEEDBACK_INFO = [
    '1. 通过GitHub Issues反馈：',
    '   https://github.com/Designer-Awei/electron-paper/issues',
    '2. 加入QQ群: 456248329',
    '3. 邮箱: zhangweiwei3099@gmail.com'
  ].join('\n');

  // 封装带复制按钮的弹窗
  function showCopyableDialog(options) {
    dialog.showMessageBox({
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      detail: options.detail,
      buttons: ['复制', '确定'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    }).then(result => {
      if (result.response === 0) {
        // 复制内容到剪贴板
        require('electron').clipboard.writeText(
          [options.message, options.detail].filter(Boolean).join('\n')
        );
      }
    });
  }

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
            label: '关于系统',
            click: () => {
              showCopyableDialog({
                title: '关于系统',
                message: '本项目运行环境',
                detail: ENV_INFO
              });
            }
          },
          {
            label: '使用说明',
            click: () => {
              showCopyableDialog({
                title: '使用说明',
                message: '系统用法与常见问题',
                detail: USAGE_INFO
              });
            }
          },
          {
            label: '问题反馈',
            click: () => {
              showCopyableDialog({
                title: '问题反馈',
                message: '反馈途径',
                detail: FEEDBACK_INFO
              });
            }
          },
          { type: 'separator' },
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
          }
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
            label: 'About System',
            click: () => {
              showCopyableDialog({
                title: 'About System',
                message: 'Required Environment',
                detail: ENV_INFO
              });
            }
          },
          {
            label: 'Usage',
            click: () => {
              showCopyableDialog({
                title: 'Usage',
                message: 'Usage & FAQ',
                detail: USAGE_INFO
              });
            }
          },
          {
            label: 'Feedback',
            click: () => {
              showCopyableDialog({
                title: 'Feedback',
                message: 'How to feedback',
                detail: FEEDBACK_INFO
              });
            }
          },
          { type: 'separator' },
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
          }
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
    title: 'Electron Paper',
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
      webSecurity: true,
      // 设置CSP (Content Security Policy)
      contentSecurityPolicy: {
        'default-src': ["'self'", 'https://fonts.googleapis.com'],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'media-src': ["'self'", 'data:', 'blob:'],
        'connect-src': [
          "'self'", 
          'https://api.siliconflow.cn',
          'https://fonts.googleapis.com',
          'http://export.arxiv.org'
        ],
      }
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
  mainWindow.setTitle('Electron Paper');
  
  // 只在开发模式下自动打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // 注册 F12 快捷键
  globalShortcut.register('F12', () => {
    mainWindow.webContents.toggleDevTools();
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
    try {
      // 处理不同类型的对话框请求
      if (options.type === 'file-open') {
        const result = await dialog.showOpenDialog(mainWindow, options.options);
        return { canceled: result.canceled, filePath: result.filePaths?.[0] };
      }
      else if (options.type === 'file-save') {
        const result = await dialog.showSaveDialog(mainWindow, options.options);
        return { canceled: result.canceled, filePath: result.filePath };
      }
      else if (options.type === 'confirm') {
        const result = await dialog.showMessageBox(mainWindow, options.options);
        return result.response;
      }
      else {
        // 默认使用showMessageBox
        return await dialog.showMessageBox(mainWindow, options);
      }
    } catch (err) {
      console.error('显示对话框错误:', err);
      throw err;
    }
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

  // 智能体主流程
  ipcMain.on('data-agent:run', async (event, params) => {
    let apiKey = params.apiKey;
    if (!apiKey) {
      apiKey = getApiKey();
    }
    try {
      await dataAgent.mainAgent({
        ...params,
        apiKey,
        onStatus: (msg) => event.sender.send('data-agent:status', msg)
      }).then(result => {
        event.sender.send('data-agent:result', result);
      }).catch(err => {
        event.sender.send('data-agent:error', { error: err.message });
      });
    } catch (err) {
      event.sender.send('data-agent:error', { error: err.message });
    }
  });

  // 摘要API
  ipcMain.handle('data-agent:summary', async (event, { messages, model, apiKey }) => {
    if (typeof dataAgent.callLLM !== 'function') throw new Error('dataAgent.callLLM未导出');
    const summary = await dataAgent.callLLM({
      model,
      apiKey,
      messages,
      temperature: 0.3,
      max_tokens: 512
    });
    return summary;
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