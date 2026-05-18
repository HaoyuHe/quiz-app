#!/bin/bash
# 智能学习助手 - 启动脚本
# 双击运行此脚本，或在终端执行 ./start.sh

echo "================================"
echo "    智能学习助手 启动中..."
echo "================================"
echo ""

# 获取脚本所在目录
cd "$(dirname "$0")"

# 检查 Python 版本并启动服务器
if command -v python3 &> /dev/null; then
    echo "正在启动本地服务器..."
    echo "请在浏览器中打开: http://localhost:8080"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    echo ""
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    echo "正在启动本地服务器..."
    echo "请在浏览器中打开: http://localhost:8080"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    echo ""
    python -m http.server 8080
else
    echo "错误: 未找到 Python，请先安装 Python"
    echo "或直接用浏览器打开 index.html 文件"
    read -p "按回车键退出..."
fi
