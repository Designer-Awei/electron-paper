@echo off
echo ===================================
echo Electron Paper 完整打包流程
echo ===================================
echo.

REM 增加强制结束可能在运行的Electron进程
echo 正在结束可能运行的Electron应用程序进程...
taskkill /F /IM "Electron Paper.exe" /T 2>nul
timeout /t 2 /nobreak >nul
echo.

REM 第一步：清理环境和已安装版本
echo 清理旧的构建目录...
if exist "dist" (
    echo 正在尝试删除dist目录...
    rd /s /q "dist" 2>nul
    
    REM 如果删除失败，给出更详细的错误信息
    if exist "dist" (
        echo 无法删除dist目录，可能有文件被占用。
        echo 请确保没有应用程序在运行，并关闭所有相关窗口。
        pause
        exit /b 1
    ) else (
        echo 旧的dist目录已删除
    )
)

echo 清理已安装的旧版本...
set "appData=%LOCALAPPDATA%\ElectronPaper"
if exist "%appData%" (
    echo 正在删除已安装的应用程序...
    rd /s /q "%appData%" 2>nul
    echo 已安装的应用程序已删除
)

REM 检查并删除已安装的AppData目录和开始菜单快捷方式
set "startMenu=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Electron Paper"
if exist "%startMenu%" (
    echo 正在删除开始菜单快捷方式...
    rd /s /q "%startMenu%" 2>nul
    echo 快捷方式已删除
)
echo.

REM 第二步：打包应用
echo 打包应用...
call .\simple-build.bat
if %ERRORLEVEL% neq 0 (
    echo 错误: 打包应用失败
    pause
    exit /b 1
)
echo 应用打包完成
echo.

REM 第三步：创建安装程序
echo 创建安装程序...
call .\create-squirrel-installer.bat
if %ERRORLEVEL% neq 0 (
    echo 错误: 创建安装程序失败
    pause
    exit /b 1
)
echo 安装程序创建完成
echo.

echo ===================================
echo 打包过程全部完成!
echo ===================================
echo.
echo 你现在可以分发以下文件:
echo.
echo 1. 便携版应用 (整个文件夹):
echo    dist\Electron Paper-win32-x64\
echo.
echo 2. 安装程序:
echo    dist\installer\Setup.exe
echo.
echo 感谢使用!
echo.

pause 