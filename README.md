# GitMemos

一个基于 GitHub Issues 的简洁笔记应用，提供优雅的界面来管理和编写你的笔记。

配合 [VandeeFeng/gitmemo](https://github.com/VandeeFeng/gitmemo)，提供一个简单的页面。
## 主要功能

- 📝 基于 GitHub Issues 的笔记管理
- 🎨 支持亮色/暗色主题
- ✨ Markdown 编辑和实时预览
- 🏷️ 标签管理和筛选

## 快速开始

1. 克隆仓库并安装依赖：
   ```bash
   git clone git@github.com:VandeeFeng/gitmemos.git
   cd gitmemos
   npm install
   ```

2. 配置环境变量：
   创建 `.env.local` 文件：
   ```
   NEXT_PUBLIC_GITHUB_TOKEN=your_github_token
   NEXT_PUBLIC_GITHUB_OWNER=your_github_username
   NEXT_PUBLIC_GITHUB_REPO=your_repository_name
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

## GitHub Token 设置

1. 访问 [GitHub Token 设置页面](https://github.com/settings/tokens)
2. 生成新的 token，勾选 `issue` 权限
3. 将 token 添加到 `.env.local` 文件中

## 技术栈

- Next.js 13+ (App Router)
- Tailwind CSS
- shadcn/ui
- TypeScript

## 许可

MIT License
