@echo off
chcp 65001 >nul
title 智能学习助手 - 服务器版

echo ================================
echo     智能学习助手 启动中...
echo ================================
echo.
echo  [新模式] 所有设备共享同一份数据
echo.
cd /d "%~dp0"

:: 检查 Node.js 并启动服务器
where node >nul 2>&1
if %errorlevel% equ 0 (
    echo 正在启动服务器...
    echo.
    node server.js
) else (
    echo 错误: 未找到 Node.js
    echo 请访问 https://nodejs.org/ 下载安装
    echo.
    pause
)
