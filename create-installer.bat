@echo off
echo ===================================
echo 创建 Electron Paper 安装包...
echo ===================================
echo.

echo 安装 electron-installer-windows...
call npm install --save-dev electron-installer-windows
if %ERRORLEVEL% neq 0 (
    echo 错误: 安装electron-installer-windows失败
    pause
    exit /b 1
)
echo electron-installer-windows已安装
echo.

echo 创建安装程序配置文件...
echo {
echo   "src": "dist/Electron Paper-win32-x64",
echo   "dest": "dist/installers",
echo   "icon": "E-paper.ico",
echo   "name": "Electron Paper",
echo   "productName": "Electron Paper",
echo   "authors": "Your Name",
echo   "exe": "Electron Paper.exe",
echo   "noMsi": true,
echo   "setupExe": "Electron-Paper-Setup.exe",
echo   "setupIcon": "E-paper.ico",
echo   "description": "Electron Paper Application"
echo } > installer-config.json

echo 创建安装程序...
call npx electron-installer-windows --config installer-config.json
if %ERRORLEVEL% neq 0 (
    echo 错误: 创建安装程序失败
    pause
    exit /b 1
)
echo.

echo 检查安装程序...
if exist "dist\installers" (
    dir "dist\installers"
    echo.
    echo ===================================
    echo 安装程序创建成功!
    echo ===================================
    echo 你可以在dist\installers目录中找到安装程序
    echo.
) else (
    echo 错误: 创建安装程序失败，未找到输出目录
    pause
    exit /b 1
)

echo 按任意键退出...
pause 