@echo off
echo 请求管理员权限...

:: 检查 UAC
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

:: 如果没有管理员权限，请求提升权限
if '%errorlevel%' NEQ '0' (
    echo 请求管理员权限...
    goto UACPrompt
) else (
    goto gotAdmin
)

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" (
        del "%temp%\getadmin.vbs"
    )
    pushd "%CD%"
    CD /D "%~dp0"

echo ===================================
echo 开始构建 Electron Paper 应用...
echo ===================================
echo.

echo 当前Node.js版本:
node -v
echo 当前NPM版本:
npm -v
echo.

echo 正在安装/更新依赖...
call npm install
if %ERRORLEVEL% neq 0 (
    echo 错误: 安装依赖失败
    goto :error
)
echo 依赖安装完成
echo.

echo 确保electron-builder已安装...
call npm install --save-dev electron-builder
if %ERRORLEVEL% neq 0 (
    echo 错误: 安装electron-builder失败
    goto :error
)
echo electron-builder已就绪
echo.

echo 开始使用国内镜像打包应用(这可能需要几分钟时间)...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
call npx electron-builder --win --config.win.target=portable
if %ERRORLEVEL% neq 0 (
    echo 错误: 构建应用失败
    goto :error
)
echo.

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
echo 你可以在dist目录中找到输出文件
echo.
goto :end

:error
echo.
echo ===================================
echo 构建过程中出现错误!
echo ===================================
echo.
pause
exit /b 1

:end
echo 按任意键退出...
pause 