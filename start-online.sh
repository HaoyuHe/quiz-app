#!/bin/bash
# 智能学习助手 - 公网版启动脚本（服务器 + 公网隧道）
# 启动后，所有设备（包括公网）都可以访问
# 
# 使用方式:
#   1. 双击此脚本，或在终端运行 ./start-online.sh
#   2. 等待看到 "your url is:" 或 "tunneled with tls termination"
#   3. 复制出现的 https://xxx.lhr.life 地址发给需要访问的人
#
# 依赖: Node.js（需要先安装）
# 隧道方式: 自动使用 localhost.run（免费，无需注册）

echo "========================================="
echo "    智能学习助手 - 公网版启动"
echo "========================================="
echo ""

# 获取脚本所在目录
cd "$(dirname "$0")"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js"
    echo "请访问 https://nodejs.org/ 下载安装"
    read -p "按回车键退出..."
    exit 1
fi

echo "正在启动本地服务器..."
echo ""

# 启动后端服务器（后台运行）
node server.js &
SERVER_PID=$!

# 等待服务器启动
sleep 2

# 检查服务器是否启动成功
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "错误: 服务器启动失败"
    read -p "按回车键退出..."
    exit 1
fi

echo "========================================="
echo ""
echo "  本地地址:   http://localhost:3000"
echo "  局域网地址: http://$(ifconfig 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1):3000"
echo ""
echo "  正在启动公网隧道..."
echo "  请稍候，正在获取公网地址..."
echo ""

# 启动公网隧道
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -R 80:localhost:3000 nokey@localhost.run 2>&1

# 如果隧道退出，也关闭服务器
kill $SERVER_PID 2>/dev/null
