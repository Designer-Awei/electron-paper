@echo off
echo 正在打包 Electron Paper 应用...
echo.

REM 安装依赖（如果需要）
echo 检查并安装依赖...
call npm install
echo.

REM 构建应用
echo 开始构建应用...
call npm run dist
echo.

echo 打包完成！
echo 输出文件位于 dist 目录中
echo.
pause 