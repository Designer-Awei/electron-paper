# Electron Paper Reader

基于Electron的论文阅读和管理工具。该工具可以帮助研究人员更高效地管理和阅读arXiv论文。

## 功能特性

- 📑 论文信息展示
  - 标题完整显示
  - 作者信息完整展示
  - 摘要内容自适应显示
  - 支持直接访问PDF链接
- 🔍 高级搜索功能
  - 多字段组合搜索
  - 支持按标题、作者、摘要、分类搜索
  - 日期范围过滤
  - 结果排序选项
- 📂 用户界面
  - 响应式设计
  - 优雅简洁的界面
  - 开发者工具支持(F12快捷键)

## 技术实现

- 使用arXiv API获取论文数据
- XML解析与数据处理
- 基于Electron的跨平台桌面应用
- 安全的预加载脚本设计
- 模块化代码结构

## 安装和运行

确保您已安装 [Node.js](https://nodejs.org/)。

```bash
# 克隆项目
git clone https://github.com/Designer-Awei/electron-paper.git

# 进入项目目录
cd electron-paper

# 安装依赖
npm install

# 启动应用
npm start
```

## 项目结构

```
electron-paper/
├── main.js         # Electron主进程
├── preload.js      # 预加载脚本(API安全暴露)
├── renderer.js     # 渲染进程脚本
├── index.html      # 主界面
├── package.json    # 项目配置和依赖
└── README.md       # 项目说明
```

## 技术栈

- Electron v28.0.0
- Node.js
- axios v1.8.4 (API请求)
- xml2js v0.6.2 (XML解析)
- electron-reloader (开发热重载)

## 未来计划

- 🤖 AI 辅助功能
  - 快速论文解读
  - 智能摘要生成
  - 相关论文推荐
  - 关键点提取

- 📊 数据分析
  - 论文关联分析
  - 研究趋势可视化
  - 作者网络图谱
  
- 💾 数据管理
  - 本地收藏功能
  - 论文分类管理
  - 批量下载与导出

## 贡献指南

欢迎提交 Issue 和 Pull Request 来帮助改进这个项目。

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/your-feature`)
3. 提交更改 (`git commit -m 'Add your feature'`)
4. 推送到分支 (`git push origin feature/your-feature`)
5. 创建Pull Request

## 许可证

MIT License 