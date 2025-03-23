@echo off
echo ===================================
echo Electron Paper 完整打包流程
echo ===================================
echo.

REM 第一步：清理环境
echo 清理旧的构建目录...
if exist "dist" (
    rmdir /s /q "dist"
    echo 旧的dist目录已删除
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