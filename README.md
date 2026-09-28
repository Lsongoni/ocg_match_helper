# OCG 比赛助手

面向 iPhone 的本地优先游戏王 OCG 比赛记录 PWA。赛事数据保存在设备的 IndexedDB；应用无需服务器或登录。

## 本地开发

```bash
npm ci
npm run dev
```

运行 `npm run build` 构建静态站点，`npm test` 执行针对性测试。

## 使用与数据

- iPhone Safari 打开站点后，通过分享菜单选择“添加到主屏幕”。首次联网打开完成缓存后，可断网使用记录、模拟、统计、战报和备份。
- 设置页的完整备份会产生 `OCG-Assistant-Backup-YYYY-MM-DD.zip`，其中包含 `data.json` 和 `images/`。把 ZIP 存入 Files / iCloud Drive；换设备后从设置页选择 ZIP 恢复。
- 战报 TXT 仅用于阅读和发布，不能用于恢复。浏览器网站数据被清理后，本机记录可能消失，请定期备份。

## GitHub Pages

将代码推送到公开的 `ocg_match_helper` 仓库，并在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。`main` 分支推送后运行测试、构建并发布 `dist/`。构建会从 `GITHUB_REPOSITORY` 自动设置 Vite 的项目子路径。

项目约定见 [AGENTS.md](AGENTS.md)。
