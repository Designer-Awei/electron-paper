@echo off
setlocal enabledelayedexpansion

echo ===================================
echo 开始构建 Electron Paper 应用...
echo ===================================
echo.

REM 检查Node.js和npm
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo 错误: 未找到Node.js，请先安装Node.js
    goto :error
)

echo 当前Node.js版本:
node -v
echo 当前NPM版本:
npm -v
echo.

REM 安装/更新依赖
echo 正在安装/更新依赖...
call npm install
if %ERRORLEVEL% neq 0 (
    echo 错误: 安装依赖失败
    goto :error
)
echo 依赖安装完成
echo.

REM 安装electron-builder
echo 确保electron-builder已安装...
call npm install --save-dev electron-builder
if %ERRORLEVEL% neq 0 (
    echo 错误: 安装electron-builder失败
    goto :error
)
echo electron-builder已就绪
echo.

REM 清理旧的构建
echo 清理旧的构建文件...
if exist "dist" (
    rmdir /s /q "dist"
    echo 旧的dist目录已删除
)
echo.

REM 构建应用
echo 开始构建应用(这可能需要几分钟时间)...
echo 正在执行: npx electron-builder --win
call npx electron-builder --win
if %ERRORLEVEL% neq 0 (
    echo 错误: 构建应用失败
    goto :error
)
echo.

REM 检查输出
echo 检查构建输出...
if not exist "dist" (
    echo 错误: 没有找到dist目录
    goto :error
)

dir "dist"
echo.

REM 构建成功
echo ===================================
echo 构建成功!
echo ===================================
echo 你可以在dist目录中找到以下文件:
echo 1. Electron Paper Setup 1.0.0.exe - 安装包
echo 2. Electron Paper 1.0.0.exe - 便携版
echo.
goto :end

:error
echo.
echo ===================================
echo 构建过程中出现错误!
echo ===================================
echo.
exit /b 1

:end
echo 按任意键退出...
pause >nul 