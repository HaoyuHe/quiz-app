@echo off
chcp 65001 >nul
title 智能学习助手

echo ================================
echo     智能学习助手 启动中...
echo ================================
echo.

cd /d "%~dp0"

:: 检查 Python 并启动服务器
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 正在启动本地服务器...
    echo 请在浏览器中打开: http://localhost:8080
    echo.
    echo 按 Ctrl+C 停止服务器
    echo.
    python -m http.server 8080
) else (
    echo 错误: 未找到 Python，请先安装 Python
    echo 或直接用浏览器打开 index.html 文件
    echo.
    pause
)
