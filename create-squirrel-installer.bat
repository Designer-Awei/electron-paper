@echo off
echo ===================================
echo 创建 Electron Paper 安装包...
echo ===================================
echo.

echo 安装所需依赖...
call npm install --save-dev electron-winstaller
if %ERRORLEVEL% neq 0 (
    echo 错误: 安装electron-winstaller失败
    pause
    exit /b 1
)
echo electron-winstaller已安装
echo.

echo 创建安装目录...
if not exist "dist\installer" (
    mkdir "dist\installer"
)
echo.

echo 开始构建安装程序...
call node create-squirrel-installer.js
if %ERRORLEVEL% neq 0 (
    echo 错误: 创建安装程序失败
    pause
    exit /b 1
)
echo.

echo 检查安装程序是否创建成功...
if exist "dist\installer\Setup.exe" (
    echo 安装程序创建成功!
    echo 你可以在dist\installer目录中找到安装程序：Setup.exe
) else (
    echo 未找到安装程序文件，请检查错误信息
)
echo.

echo 按任意键退出...
pause 