#!/bin/bash
# 智能学习助手 - Mac 启动脚本
# 双击运行此脚本即可启动

# 获取脚本所在目录
cd "$(dirname "$0")"

# 清屏并显示欢迎信息
clear
echo "╔══════════════════════════════════════╗"
echo "║       智能学习助手 启动中...         ║"
echo "╚══════════════════════════════════════╝"
echo ""

# 获取本机 IP 地址
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "未获取到")

echo "📱 电脑端访问: http://localhost:8080"
if [ "$IP" != "未获取到" ]; then
    echo "📱 手机端访问: http://$IP:8080 (需同一WiFi)"
fi
echo ""
echo "💡 提示:"
echo "   - 按 Ctrl+C 停止服务器"
echo "   - 手机和电脑需连接同一WiFi才能访问"
echo ""

# 启动服务器
python3 -m http.server 8080
