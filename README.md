# Git Memo

GIt Memo 是一个基于 GitHub Issues 的笔记应用，它提供了一个简洁优雅的界面来管理和编写你的笔记。通过利用 GitHub Issues 的强大功能，你可以轻松地组织、标记和搜索你的笔记内容。

配合仓库的 main 分支，提供一个简单的页面。

## 特性

- 🎨 现代化的用户界面
  - 支持亮色/暗色主题
  - GitHub 风格的设计
  - 响应式布局

- 📝 Markdown 编辑器
  - 实时预览
  - 支持完整的 Markdown 语法
  - GitHub 风格的渲染

- 🏷️ 标签管理
  - 自定义标签颜色
  - 标签分类和筛选
  - 快速创建和编辑标签

- 🔄 GitHub 集成
  - 直接与 GitHub Issues 同步
  - 支持多仓库配置
  - 实时保存和更新

## 技术栈

- **框架**: Next.js 13+ (App Router)
- **样式**: Tailwind CSS
- **UI 组件**: shadcn/ui
- **Markdown**: @uiw/react-md-editor
- **主题**: next-themes
- **API**: Octokit (GitHub API)
- **类型**: TypeScript

## 开始使用

1. 克隆仓库：
   ```bash
   git clone --branch mp --single-branch git@github.com:VandeeFeng/gitmemo.git
   cd gitmemo
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 配置环境变量：
   创建 `.env.local` 文件并添加以下内容：
   ```
   NEXT_PUBLIC_GITHUB_TOKEN=your_github_token
   NEXT_PUBLIC_GITHUB_OWNER=your_github_username
   NEXT_PUBLIC_GITHUB_REPO=your_repository_name
   ```

4. 启动开发服务器：
   ```bash
   npm run dev
   ```

5. 在浏览器中打开 [http://localhost:3000](http://localhost:3000)

## GitHub Token 配置

1. 访问 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. 点击 "Generate new token (classic)"
3. 勾选以下权限：
   - `issue`
4. 生成并复制 token
5. 将 token 粘贴到 `.env.local` 文件中

## 使用说明

1. **创建笔记**
   - 点击右上角的 "New Issue" 按钮
   - 输入标题和内容
   - 可选择添加标签
   - 点击 "Create" 保存

2. **管理标签**
   - 点击 "Labels" 按钮查看所有标签
   - 可以创建新标签，设置颜色和描述
   - 点击标签可以筛选相关笔记

3. **编辑笔记**
   - 点击笔记右上角的编辑按钮
   - 修改内容后点击 "Update" 保存

4. **主题切换**
   - 点击右上角的主题切换按钮
   - 支持亮色/暗色主题
   - 自动跟随系统主题

## 贡献

欢迎提交 Pull Request 或创建 Issue 来帮助改进这个项目。

## 许可

MIT License
