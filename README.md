# Electron Paper Reader

基于Electron的论文阅读和管理工具。该工具可以帮助研究人员更高效地管理和阅读arXiv论文。

## 功能特性

- 📑 论文信息展示
  - 标题完整显示
  - 作者信息完整展示
  - 摘要内容自适应显示
  - 支持直接访问PDF链接
  - 分类标签清晰展示
- 🔍 高级搜索功能
  - 通过关键词或arXiv ID精确搜索论文
  - 支持按标题、作者、摘要、分类搜索
  - 日期范围过滤
  - 结果排序选项
  - 高级筛选和条件组合
  - 搜索历史记录保存
  - 批量选择功能
- 📂 用户界面
  - 响应式设计
  - 优雅简洁的界面
  - 移动设备自适应
  - 开发者工具支持(F12快捷键)
  - 多标签页管理
- 🤖 AI桌面助手
  - 集成SiliconFlow LLM大模型
  - 快捷检索和智能推荐功能
  - 支持文本输入查询
  - 语音输入功能(开发中)
  - 实时响应用户请求
  - 提供学术相关信息辅助
  - 优化的回复格式，包含分析和关键词提取
  - 智能识别学术问题并提供快捷检索选项
- 🔄 实用功能
  - 支持复制论文信息
  - 直接下载论文PDF
  - 一键访问官方页面
  - 添加收藏夹
  - 搜索历史记录
  - 批量导出功能
- 🌍 翻译功能
  - 集成SiliconFlow AI接口
  - 论文标题和摘要一键翻译
  - 多种翻译模型选择
  - 记忆翻译结果，避免重复翻译
  - 支持整批次论文翻译
- 📚 知识库管理
  - 导出论文到个人知识库
  - 中英文双语存储
  - 添加个人笔记和阅读状态
  - 标记已读/未读状态
  - 支持导出为JSON格式
  - 转换为Excel格式
  - 卡片式布局直观管理

## 技术实现

- 使用arXiv API获取论文数据
- XML解析与数据处理
- 基于Electron的跨平台桌面应用
- 安全的预加载脚本设计
- 集成SiliconFlow大模型API
  - 文本翻译和处理
  - AI助手对话与交互
  - 学术问题智能识别与分析
- 模块化代码结构
- 响应式移动适配
- 优化的Markdown和代码块渲染

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
   - 可设置每页显示结果数量
   - 搜索结果将显示在界面中

2. **查看论文详情**：
   - 点击搜索结果中的论文标题展开详细信息
   - 详情包括完整摘要、作者列表、发布日期和分类
   - 支持查看和访问论文分类

3. **使用AI助手**：
   - 点击界面右上角的"召唤Awei"按钮打开对话框
   - 通过文本输入框输入您的学术问题或需求
   - AI助手将基于当前上下文和SiliconFlow LLM生成回答
   - 学术问题回复会自动包含分析部分和关键词提取
   - 提供快捷检索选项，帮助快速找到相关论文
   - 支持代码块和Markdown格式的显示
   - 语音输入功能正在开发中，交互组件已部署

4. **翻译功能**：
   - 在设置中配置SiliconFlow API密钥
   - 点击"翻译"按钮将论文标题和摘要翻译成中文
   - 点击"显示原文"可以切换回英文原文
   - 支持批量翻译多篇论文

5. **知识库管理**：
   - 将感兴趣的论文添加到知识库
   - 添加个人笔记和阅读状态
   - 支持中英文双语存储和切换
   - 卡片式布局直观管理论文
   - 导出为JSON或转换为Excel

6. **下载和访问**：
   - 点击"PDF"按钮直接下载或在浏览器中打开论文PDF
   - 点击"arXiv"按钮访问论文在arXiv的官方页面
   - 批量选择和导出多篇论文

7. **批量操作**：
   - 使用顶部复选框选择/取消选择所有论文
   - 单独选择需要的论文
   - 批量导出所选论文到知识库或JSON文件

## 翻译功能与AI助手配置

1. 访问 [SiliconFlow](https://cloud.siliconflow.cn/account/ak) 获取API密钥
2. 在应用的"设置"选项卡中填入API密钥
3. 选择合适的翻译模型和AI助手模型
4. 保存设置后即可使用翻译功能和AI助手功能

## 打包说明

本项目提供打包脚本，可以轻松创建便携版和安装版应用。

### 一键打包（推荐）

使用打包脚本可同时生成便携版和安装版：

```bash
# 以管理员身份运行打包脚本
.\package.bat
```

此脚本会自动：
1. 结束可能运行的应用程序进程
2. 清理旧版本和已安装的应用
3. 安装或更新必要的依赖
4. 直接使用electron-builder创建便携版应用和自定义安装程序

### 手动打包

如果需要单独执行打包步骤：

```bash
# 创建便携版和支持自定义安装路径的NSIS安装程序
npm run build-nsis
```

此命令会：
1. 清理旧版本和已安装的应用
2. 使用electron-builder直接创建便携版应用和Windows安装程序

输出：
- 便携版：`dist/win-unpacked/` (包含 `Electron Paper.exe`)
- 安装程序：`dist/Electron Paper Setup 1.0.0.exe`

### 单独打包便携版

如果只需要便携版，可以使用：

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
├── installer.nsh   # NSIS安装程序自定义配置
├── package.bat     # 打包脚本
├── start-dev.bat   # 开发模式启动脚本
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
- markdown-it (Markdown渲染支持)

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

- **AI助手回复格式问题？**
  如果遇到分隔线或快捷检索选项显示异常，可尝试重启应用解决

## 未来计划

- 🎤 语音交互功能
  - 完善语音输入交互功能
  - 支持语音命令控制应用
  - 实现语音识别的本地处理能力
  
- 🌐 联网搜索功能
  - 实现通过AI助手进行实时网络搜索
  - 整合多种学术搜索引擎资源
  - 提供更全面的文献参考信息
  
- 📄 文档解析功能
  - 增加PDF文件上传和解析功能
  - 支持Word文档导入和内容提取
  - 自动生成文献概要和关键词

- 🤖 AI 辅助功能增强
  - 增强论文内容分析能力
  - 添加更多自定义提示词选项
  
- 📊 数据分析与可视化
  - 添加论文数据统计功能
  - 研究热点趋势分析
  - 个人阅读习惯数据可视化
  
- 🔗 引文网络分析
  - 相关论文推荐
  - 引用关系图谱
  - 作者合作网络
  
- 📱 移动端同步功能
  - 支持知识库云端同步
  - 多设备数据互通

## 社交媒体

### 小红书

🔍 搜小红书号: 1884581633

📱 关注获取:
- 使用教程
- 功能更新
- 应用技巧分享
- 用户交流群

### 交流群

欢迎加入我们的用户交流群:
- QQ群: 456248329

在群内您可以:
- 获取最新版本更新
- 反馈使用问题
- 交流学术经验
- 结识志同道合的朋友

## 贡献与反馈

欢迎通过GitHub Issues提交反馈和建议。

## 许可证

本项目采用MIT许可证。详情请参阅LICENSE文件。 