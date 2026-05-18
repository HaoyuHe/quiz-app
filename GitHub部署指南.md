# GitHub Pages 部署指南

## 快速部署步骤

### 1. 创建 GitHub 仓库

1. 登录 GitHub (https://github.com)
2. 点击右上角 "+" → "New repository"
3. 仓库名称填写：`quiz-app`（或其他名称）
4. 选择 "Public"（公开）
5. 点击 "Create repository"

### 2. 上传代码

打开终端，进入项目目录，执行：

```bash
# 初始化 Git
git init

# 添加所有文件
git add .

# 提交
git commit -m "初始化智能学习助手"

# 设置主分支
git branch -M main

# 关联远程仓库（替换成你的用户名）
git remote add origin https://github.com/你的用户名/quiz-app.git

# 推送代码
git push -u origin main
```

### 3. 开启 GitHub Pages

1. 进入仓库页面
2. 点击 "Settings" → 左侧菜单 "Pages"
3. "Source" 选择 "Deploy from a branch"
4. "Branch" 选择 "main"，目录选择 "/ (root)"
5. 点击 "Save"

### 4. 访问网站

等待 1-2 分钟后，访问：

```
https://你的用户名.github.io/quiz-app/
```

如果仓库名不是 quiz-app，替换成你的仓库名。

---

## 手机端使用

### iOS (iPhone/iPad)

1. Safari 打开网址
2. 点击底部分享按钮 (方框向上箭头)
3. 向下滑动，点击 "添加到主屏幕"
4. 点击右上角 "添加"

之后桌面会出现"学习助手"图标，点击即可使用（支持离线）

### Android

1. Chrome 打开网址
2. 点击右上角菜单 (三个点)
3. 点击 "添加到主屏幕" 或 "安装应用"
4. 确认添加

---

## 更新代码

修改代码后，执行：

```bash
git add .
git commit -m "更新说明"
git push
```

GitHub Pages 会自动部署更新（约 1-2 分钟生效）。

---

## 注意事项

1. **首次访问需联网** - PWA 需要首次联网缓存资源
2. **之后可离线** - 缓存后可离线使用
3. **数据不互通** - 每个设备数据独立存储在本地浏览器
4. **清除浏览器数据会丢失** - 建议定期备份重要题目
