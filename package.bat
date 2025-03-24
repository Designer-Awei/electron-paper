@echo off
chcp 936 > nul

:: 切换到脚本所在目录
cd /d "%~dp0"

:: 检查是否以管理员身份运行
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ===================================
    echo Electron Paper 完整打包工具
    echo ===================================
    echo.
    echo 此脚本需要管理员权限才能创建完整的安装程序
    echo 请右键点击此脚本并选择"以管理员身份运行"
    echo.
    pause
    exit /b 1
)

echo ===================================
echo Electron Paper 完整打包工具（管理员模式）
echo ===================================
echo.

:: 设置国内镜像（环境变量方式）
echo [设置] 配置国内镜像加速下载...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
set ELECTRON_CUSTOM_DIR=28.3.3
set npm_config_electron_mirror=https://npmmirror.com/mirrors/electron/
set npm_config_electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
set npm_config_electron_custom_dir=28.3.3

:: 创建或更新.npmrc文件
echo 创建.npmrc配置文件...
echo registry=https://registry.npmmirror.com/ > .npmrc
echo electron_mirror=https://npmmirror.com/mirrors/electron/ >> .npmrc
echo electron-builder-binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/ >> .npmrc
echo electron_custom_dir=28.3.3 >> .npmrc
echo 镜像配置完成
echo.

echo [步骤1/6] 结束运行中的应用程序进程...
taskkill /F /IM "Electron Paper.exe" /T 2>nul
taskkill /F /IM "electron-paper.exe" /T 2>nul
timeout /t 2 /nobreak > nul
echo 完成
echo.

echo [步骤2/6] 清理旧的构建目录...
if exist "dist" (
    echo 正在删除dist目录...
    rd /s /q "dist" 2>nul
    if %ERRORLEVEL% neq 0 (
        echo 警告: 无法完全删除dist目录，可能有文件被锁定
    ) else (
        echo 旧的dist目录已删除
    )
)
echo 完成
echo.

echo [步骤3/6] 安装或更新依赖...
echo 设置npm国内镜像...
call npm config set registry https://registry.npmmirror.com

echo 安装依赖包...
call npm install
if %ERRORLEVEL% neq 0 (
    echo 警告: npm install失败，尝试使用cnpm...
    call npm install -g cnpm --registry=https://registry.npmmirror.com
    call cnpm install
    if %ERRORLEVEL% neq 0 (
        echo 错误: 安装依赖失败
        pause
        exit /b 1
    )
)
echo 依赖安装完成
echo.

echo [步骤4/6] 创建便携版应用...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo 错误: 创建便携版失败
    pause
    exit /b 1
)
echo 便携版创建完成
echo.

echo [步骤5/6] 预下载electron二进制文件...
echo 正在预下载electron二进制文件...
if not exist "%USERPROFILE%\.electron\electron-v28.3.3-win32-x64.zip" (
    echo 创建目录...
    mkdir "%USERPROFILE%\.electron" 2>nul
    
    echo 使用curl下载electron二进制文件...
    curl -L -o "%USERPROFILE%\.electron\electron-v28.3.3-win32-x64.zip" "https://npmmirror.com/mirrors/electron/28.3.3/electron-v28.3.3-win32-x64.zip"
    if %ERRORLEVEL% neq 0 (
        echo 警告: curl下载失败，尝试使用备用下载方式...
        powershell -Command "& {Invoke-WebRequest -Uri 'https://npmmirror.com/mirrors/electron/28.3.3/electron-v28.3.3-win32-x64.zip' -OutFile '%USERPROFILE%\.electron\electron-v28.3.3-win32-x64.zip'}"
        if %ERRORLEVEL% neq 0 (
            echo 警告: 无法预下载electron二进制文件，继续尝试...
        ) else (
            echo 预下载完成
        )
    ) else (
        echo 预下载完成
    )
) else (
    echo electron二进制文件已存在，跳过下载
)
echo.

echo [步骤6/6] 创建可自定义安装路径的安装程序...
echo 尝试从国内镜像下载资源...
call npm run build-nsis
if %ERRORLEVEL% neq 0 (
    echo 第一次尝试创建安装程序失败，正在重试...
    
    :: 清理缓存并重试
    echo 清理npm缓存...
    call npm cache clean --force
    
    echo 重新尝试创建安装程序...
    set ELECTRON_BUILDER_OFFLINE=true
    call npm run build-nsis
    
    if %ERRORLEVEL% neq 0 (
        echo 第二次尝试失败，使用离线方式创建安装程序...
        
        echo 创建目标文件夹...
        mkdir dist\Electron-Paper-portable 2>nul
        
        echo 复制便携版文件...
        xcopy "dist\electron-paper-win32-x64\*" "dist\Electron-Paper-portable\" /E /I /H /Y
        
        :: 手动创建简易安装程序
        echo 创建简易安装程序脚本...
        echo @echo off > "dist\安装Electron Paper.bat"
        echo chcp 936 ^> nul >> "dist\安装Electron Paper.bat"
        echo echo 正在安装Electron Paper... >> "dist\安装Electron Paper.bat"
        echo set "INSTALL_DIR=%%ProgramFiles%%\Electron Paper" >> "dist\安装Electron Paper.bat"
        echo set /p INSTALL_DIR=请输入安装路径[默认:%%INSTALL_DIR%%]: >> "dist\安装Electron Paper.bat"
        echo mkdir "%%INSTALL_DIR%%" 2^>nul >> "dist\安装Electron Paper.bat"
        echo echo 正在复制文件... >> "dist\安装Electron Paper.bat"
        echo xcopy "Electron-Paper-portable\*" "%%INSTALL_DIR%%\" /E /I /H /Y >> "dist\安装Electron Paper.bat"
        echo echo 创建桌面快捷方式... >> "dist\安装Electron Paper.bat"
        echo powershell -Command "& {$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.Environment]::GetFolderPath('Desktop') + '\Electron Paper.lnk'); $Shortcut.TargetPath = '%%INSTALL_DIR%%\electron-paper.exe'; $Shortcut.Save()}" >> "dist\安装Electron Paper.bat"
        echo echo 创建开始菜单快捷方式... >> "dist\安装Electron Paper.bat"
        echo mkdir "%%APPDATA%%\Microsoft\Windows\Start Menu\Programs\Electron Paper" 2^>nul >> "dist\安装Electron Paper.bat"
        echo powershell -Command "& {$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([System.Environment]::GetFolderPath('Programs') + '\Electron Paper\Electron Paper.lnk'); $Shortcut.TargetPath = '%%INSTALL_DIR%%\electron-paper.exe'; $Shortcut.Save()}" >> "dist\安装Electron Paper.bat"
        echo echo 安装完成! >> "dist\安装Electron Paper.bat"
        echo pause >> "dist\安装Electron Paper.bat"
        
        echo.
        echo ===================================
        echo 打包过程完成（使用备用方案）!
        echo ===================================
        echo.
        echo 由于网络原因无法创建标准安装程序，但已成功创建备用方案：
        echo.
        echo 1. 便携版应用:
        echo    dist\Electron-Paper-portable\
        echo.
        echo 2. 简易安装脚本:
        echo    dist\安装Electron Paper.bat
        echo.
        echo 你可以将整个dist目录分发给用户，用户运行"安装Electron Paper.bat"
        echo 即可安装应用程序并创建快捷方式。
        echo.
        pause
        exit /b 0
    )
)
echo 安装程序创建完成
echo.

echo ===================================
echo 打包过程全部完成!
echo ===================================
echo.
echo 你现在可以分发以下文件:
echo.
echo 1. 便携版应用:
echo    dist\electron-paper-win32-x64\electron-paper.exe
echo.
echo 2. 支持自定义安装路径的安装程序:
echo    dist\Electron Paper Setup*.exe
echo.

pause 