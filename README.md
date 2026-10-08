# OCG 比赛助手

面向 iPhone 的本地优先游戏王 OCG 比赛记录 PWA。赛事数据保存在设备的 IndexedDB；应用无需服务器或登录。

在线使用：[https://lsongoni.github.io/ocg_match_helper/](https://lsongoni.github.io/ocg_match_helper/)

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

## 在线卡查

- 卡查通过百鸽 API 在线搜索卡名、效果关键词或卡片密码，点击结果查看文字与卡图。卡查需要联网，其余已有功能仍支持离线使用。
- 不下载全量卡库，不将卡片资料或卡图写入 IndexedDB / Service Worker 缓存；搜索结果仅保留在当前页面内存中，卡图按需加载（浏览器可能使用普通 HTTP 缓存）。
- 条件筛选支持怪兽/魔法/陷阱、子类型、属性、种族、等级/阶级/连接值、攻守数值与连接箭头，所有已选条件必须同时满足。连接箭头默认包含全部选中方向，可切换为完全一致。
- 手机提交筛选时才联网加载精简索引，不包含效果全文或卡图；点击结果再在线获取详情。索引保留在当前卡查页面内存中，不写入 IndexedDB / Service Worker 缓存。
- 本地首次测试筛选前运行 `npm run update-card-index`，随后启动或构建应用。生成的 `public/card-filter-index.json` 不提交 Git。Pages 部署和每日定时任务生成索引，先核对百鸽 MD5，未变化时复用 Actions 缓存；下载或校验失败会停止部署，保留原来的线上版本。
