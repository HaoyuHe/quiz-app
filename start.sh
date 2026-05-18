#!/bin/bash
# 智能学习助手 - 服务器版启动脚本
# 所有设备共享同一份数据
# 双击运行此脚本，或在终端执行 ./start.sh

echo "================================"
echo "    智能学习助手 启动中..."
echo "================================"
echo ""
echo " [新模式] 所有设备共享同一份数据"
echo ""

# 获取脚本所在目录
cd "$(dirname "$0")"

# 检查 Node.js 并启动服务器
if command -v node &> /dev/null; then
    echo "正在启动服务器..."
    echo ""
    node server.js
else
    echo "错误: 未找到 Node.js"
    echo "请访问 https://nodejs.org/ 下载安装"
    echo "或使用 Homebrew 安装: brew install node"
    read -p "按回车键退出..."
fi
