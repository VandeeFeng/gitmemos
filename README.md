# GitMemos

一个基于 GitHub Issues 的Memos 替代。配合 [VandeeFeng/gitmemo](https://github.com/VandeeFeng/gitmemo)，提供一个简单的页面。

代码由 cursor 协助生成。

由于 Memos 总是不太稳定，而 GitHub Issues 基本上可以满足我所有记录 Memos 的需求，因此做了这个页面。

部署到 Vercel 时填写必要的环境变量即可默认显示自己仓库的 issues 数据。

如果想显示其他仓库，现在只是提供了一个 简单的 GitHub Config 来配置仓库和 API，数据保存在 LocalStorage。会优先获取环境变量的账号数据，其次是 config 。具体的登录功能没有继续往下了。

## 技术栈

- Next.js 13+ (App Router)
- Tailwind CSS
- shadcn/ui
- TypeScript

## 主要功能

- 📝 基于 GitHub Issues 的笔记管理
- 🎨 支持亮色/暗色主题
- ✨ Markdown 编辑和实时预览
- 🏷️ 标签管理和筛选
- 🔗 反链

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
2. 生成新的 token，找到仓库，勾选 `issue` 读写权限
3. 将 token 添加到 `.env.local` 文件中

## TODO
- [ ] 搜索功能
- [ ] 数据库
- [ ] 登录功能
- [ ] 日历