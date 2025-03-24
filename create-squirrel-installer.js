/**
 * 此脚本用于创建Windows安装程序
 */
const electronInstaller = require('electron-winstaller');
const path = require('path');

// 安装包配置
const config = {
  appDirectory: path.resolve(__dirname, './dist/Electron Paper-win32-x64'),
  outputDirectory: path.resolve(__dirname, './dist/installer'),
  authors: 'Your Company',
  exe: 'Electron Paper.exe',
  name: 'ElectronPaper',
  title: 'Electron Paper',
  description: 'Electron Paper Application',
  iconUrl: path.resolve(__dirname, './E-paper.ico'),
  setupIcon: path.resolve(__dirname, './E-paper.ico'),
  noMsi: true,
  // 启用自定义安装位置
  allowElevation: true,
  // 修改安装包名称
  setupExe: 'Electron Paper-Setup.exe',
  // 允许用户选择安装位置
  noMsi: true
};

console.log('开始创建安装程序...');
console.log('使用配置:', config);

// 创建安装包
async function createInstaller() {
  try {
    await electronInstaller.createWindowsInstaller(config);
    console.log('安装程序创建成功！');
    console.log('安装程序位于:', path.resolve(__dirname, './dist/installer'));
    console.log('安装包名称:', config.setupExe);
  } catch (error) {
    console.error('创建安装程序失败:', error.message);
  }
}

createInstaller(); 