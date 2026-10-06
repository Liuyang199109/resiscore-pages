# ResiScore GitHub Pages 发布目录

`dist/` 是已经整理好的纯静态网页版发布目录。仓库不需要 Node.js 构建步骤，GitHub Actions 会把 `dist/` 的内容直接发布到 GitHub Pages。

## 首次发布

1. 在 GitHub 新建一个仓库，例如 `resiscore-pages`。如果使用 GitHub Free，建议选择公开仓库。
2. 在本目录执行：

   ```powershell
   cd "D:\New software\ResiScore\site-publish"
   if (-not (Test-Path .git)) { git init -b main }
   git branch -M main
   git add .
   git commit -m "chore: prepare ResiScore for GitHub Pages"
   git remote add origin https://github.com/<你的用户名>/resiscore-pages.git
   git push -u origin main
   ```

3. 打开 GitHub 仓库的 **Settings → Pages**，在 **Build and deployment → Source** 选择 **GitHub Actions**。
4. 打开 **Actions**，等待 `Deploy ResiScore to GitHub Pages` 成功。网址通常是：

   ```text
   https://<你的用户名>.github.io/resiscore-pages/
   ```

## 后续更新

把新的网页文件放入 `dist/` 后执行：

```powershell
cd "D:\New software\ResiScore\site-publish"
git add dist
git commit -m "chore: update ResiScore web assets"
git push
```

推送到 `main` 会自动重新发布。`dist/` 内使用相对路径加载脚本和数据，因此可以放在项目站点的 `/resiscore-pages/` 子路径下。

## 发布前检查

- 不要把项目根目录的抓取缓存、PDF、临时文件或原始数据目录上传到这个仓库。
- GitHub Pages 是公开网页；`dist/` 中的前端数据会被访问者下载。
- 本版本是纯前端应用，结果和用户输入保存在浏览器本地，没有服务器端数据库或鉴权。
