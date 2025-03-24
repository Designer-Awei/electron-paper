# Electron Paper Reader

基于Electron的论文阅读和管理工具。该工具可以帮助研究人员更高效地管理和阅读arXiv论文。

## 功能特性

- 📑 论文信息展示
  - 标题完整显示
  - 作者信息完整展示
  - 摘要内容自适应显示
  - 支持直接访问PDF链接
- 🔍 高级搜索功能
  - 通过关键词或arXiv ID精确搜索论文
  - 支持按标题、作者、摘要、分类搜索
  - 日期范围过滤
  - 结果排序选项
  - 高级筛选和条件组合
  - 搜索历史记录保存
- 📂 用户界面
  - 响应式设计
  - 优雅简洁的界面
  - 移动设备自适应
  - 开发者工具支持(F12快捷键)
- 🔄 实用功能
  - 支持复制论文信息
  - 直接下载论文PDF
  - 一键访问官方页面
  - 添加收藏夹
  - 搜索历史记录
- 🌍 翻译功能
  - 集成SiliconFlow AI接口
  - 论文标题和摘要一键翻译
  - 多种翻译模型选择
  - 记忆翻译结果，避免重复翻译
- 📚 知识库管理
  - 导出论文到个人知识库
  - 中英文双语存储
  - 添加个人笔记
  - 标记已读/未读状态
  - 支持导出为JSON格式
  - 转换为Excel格式

## 技术实现

- 使用arXiv API获取论文数据
- XML解析与数据处理
- 基于Electron的跨平台桌面应用
- 安全的预加载脚本设计
- 集成SiliconFlow大模型API
- 模块化代码结构
- 响应式移动适配

## 安装方式

### 方式一：使用安装包（推荐）

1. 下载最新的 `Electron Paper-Setup.exe` 安装包
2. 运行安装程序，选择您想要的安装目录
3. 应用将安装到您选择的位置并创建开始菜单快捷方式
4. 从开始菜单或桌面快捷方式启动应用

### 方式二：使用便携版

1. 下载便携版应用文件夹
2. 解压到任意位置
3. 运行目录中的 `Electron Paper.exe` 启动应用

### 方式三：开发环境运行

确保您已安装 [Node.js](https://nodejs.org/)。

```bash
# 克隆项目
git clone https://github.com/yourusername/electron-paper.git

# 进入项目目录
cd electron-paper

# 安装依赖
npm install

# 开发模式启动（支持热重载）
npm run dev

# 或直接启动
npm start
```

## 使用说明

1. **搜索论文**：
   - 在搜索框中输入关键词或arXiv ID（如"2502.14776"）
   - 点击搜索按钮或按回车键开始搜索
   - 支持多条件组合搜索
   - 搜索结果将显示在界面中

2. **查看论文详情**：
   - 点击搜索结果中的论文标题展开详细信息
   - 详情包括完整摘要、作者列表、发布日期和分类

3. **翻译功能**：
   - 在设置中配置SiliconFlow API密钥
   - 点击"翻译"按钮将论文标题和摘要翻译成中文
   - 点击"显示原文"可以切换回英文原文

4. **知识库管理**：
   - 将感兴趣的论文添加到知识库
   - 添加个人笔记和阅读状态
   - 支持中英文双语存储和切换
   - 导出为JSON或转换为Excel

5. **下载和访问**：
   - 点击"PDF"按钮直接下载或在浏览器中打开论文PDF
   - 点击"arXiv"按钮访问论文在arXiv的官方页面

## 翻译功能配置

1. 访问 [SiliconFlow](https://cloud.siliconflow.cn/account/ak) 获取API密钥
2. 在应用的"设置"选项卡中填入API密钥
3. 选择合适的翻译模型
4. 保存设置后即可使用翻译功能

## 打包说明

本项目提供完整的打包脚本，可以轻松创建便携版和安装版应用。

### 一键打包（推荐）

使用一键打包脚本可同时生成便携版和安装版：

```bash
# CMD方式运行一键打包脚本
.\build-script.bat

# 或使用PowerShell脚本(颜色提示更友好)
PowerShell -ExecutionPolicy Bypass -File .\build-package.ps1
```

此脚本会自动：
1. 结束可能运行的应用程序进程
2. 清理旧版本和已安装的应用
3. 安装或更新必要的依赖
4. 打包便携版应用并创建支持自定义安装路径的安装程序

### 手动打包

如果需要单独执行打包步骤：

```bash
# 创建便携版和支持自定义安装路径的NSIS安装程序
npm run build-nsis
```

此命令会：
1. 清理旧版本和已安装的应用
2. 打包便携版应用
3. 创建支持自定义安装路径的Windows安装程序

输出：
- 便携版：`dist/win-unpacked/`
- 安装程序：`dist/Electron Paper-Setup.exe`

### 单独打包便携版

```bash
# 仅打包便携版
npm run dist:simple
```

## 项目结构

```
electron-paper/
├── main.js         # Electron主进程
├── preload.js      # 预加载脚本(API安全暴露)
├── renderer.js     # 渲染进程脚本
├── index.html      # 主界面
├── renderer.css    # 渲染器样式
├── package.json    # 项目配置和依赖
├── E-paper.ico     # 应用图标
├── build/
│   └── installer.nsh  # NSIS安装程序自定义配置
├── build-script.bat   # CMD一键打包脚本
├── build-package.ps1  # PowerShell一键打包脚本
├── start-dev.bat      # 开发模式启动脚本
└── README.md       # 项目说明
```

## 技术栈

- Electron v28.3.3
- Node.js
- axios (API请求)
- xml2js (XML解析)
- electron-reloader (开发热重载)
- electron-packager (应用打包)
- electron-builder (NSIS安装程序创建)

## 常见问题

- **安装时如何更改安装路径？**
  在安装程序界面中，可以点击"浏览"按钮选择自定义安装位置

- **安装后找不到应用？**
  查看开始菜单中的"Electron Paper"文件夹

- **打包过程中报错？**
  确保没有应用实例在运行，关闭所有相关进程后重试

- **无法删除旧版本？**
  手动结束所有"Electron Paper.exe"进程后再尝试打包
  
- **翻译功能无法使用？**
  确保已正确配置SiliconFlow API密钥，并选择了合适的翻译模型

- **链接无法打开？**
  应用使用系统默认浏览器打开外部链接，确保系统已正确配置默认浏览器

## 未来计划

- 🤖 AI 辅助功能增强
  - 论文内容智能总结
  - 相关论文智能推荐
  - 关键点自动提取
  - 跨语言搜索支持

- 📊 数据分析
  - 论文关联分析
  - 研究趋势可视化
  - 作者网络图谱
  
- 💾 数据管理优化
  - 自动同步云端
  - 批量导入导出
  - 知识图谱构建
  - 多设备同步

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目。

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/your-feature`)
3. 提交更改 (`git commit -m 'Add your feature'`)
4. 推送到分支 (`git push origin feature/your-feature`)
5. 创建Pull Request

## 系统要求

- Windows 7 或更高版本
- 4GB RAM 以上
- 500MB 可用磁盘空间
- 互联网连接（用于搜索论文和翻译功能）

## 许可证

MIT License 