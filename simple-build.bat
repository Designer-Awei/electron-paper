@echo off
echo ===================================
echo 开始简化打包 Electron Paper 应用...
echo ===================================
echo.

echo 正在安装/更新依赖...
call npm install
if %ERRORLEVEL% neq 0 (
    echo 错误: 安装依赖失败
    pause
    exit /b 1
)
echo 依赖安装完成
echo.

echo 安装 electron-packager...
call npm install --save-dev electron-packager
if %ERRORLEVEL% neq 0 (
    echo 错误: 安装electron-packager失败
    pause
    exit /b 1
)
echo electron-packager已安装
echo.

echo 清理旧的构建文件...
if exist "dist" (
    rmdir /s /q "dist"
    echo 旧的dist目录已删除
)
echo.

echo 开始打包应用...
call npx electron-packager . "Electron Paper" --platform=win32 --arch=x64 --out=dist --icon=E-paper.ico --overwrite --electron-version=28.3.3
if %ERRORLEVEL% neq 0 (
    echo 错误: 打包应用失败
    pause
    exit /b 1
)
echo.

echo 检查输出文件...
if exist "dist" (
    dir "dist"
    echo.
    echo ===================================
    echo 打包成功!
    echo ===================================
    echo 你可以在dist目录中找到可执行文件
    echo.
) else (
    echo 错误: 打包失败，未找到输出目录
    pause
    exit /b 1
)

echo 按任意键退出...
pause 