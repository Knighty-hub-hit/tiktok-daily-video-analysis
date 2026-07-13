# TikTok 每日视频分析台

这是一个用于沉淀 TikTok Shop 每日带货视频数据、素材预览和拆解结论的内部分析台。当前网站会读取 `data/site-videos.json`，展示每日榜单、关键指标、视频预览、关键帧、字幕脚本和复盘要点。

## 当前能力

- 按日期浏览每日视频榜单
- 每日榜单按“有成单先按成单数从高到低；无成单按播放/曝光从高到低”排序
- 查看 GMV、订单、曝光、点击率、互动等核心指标
- 展示本地保存的视频 GIF 预览、字幕和关键帧
- 没有对应视频素材时显示待处理状态，不复用其他视频的封面、关键帧或脚本
- 对重点视频沉淀 Hook、卖点、CTA 和可复用脚本结构
- 从 TikTok 导出的 Excel 生成网站数据
- 保留 Sites 托管配置，可发布成团队可访问链接

## 关键目录

- `app/`: 网站页面和样式入口
- `data/site-videos.json`: 网站当前读取的视频分析数据
- `data/exports/`: TikTok 每日或周期导出的 Excel 原始文件
- `public/videos/`: 视频预览和字幕文件
- `public/keyframes/`: 每条视频的关键帧截图
- `scratch/export_tiktok_excel_to_site_data.mjs`: Excel 转网站数据脚本
- `scripts/refresh-site-data.mjs`: 导入 Excel 并校验网站数据
- `scripts/import-feishu-sheet-to-site-data.mjs`: 从飞书表格生成网站数据
- `scripts/download-tiktok-report.mjs`: 从云端下载每日 TikTok Excel 报表
- `scripts/capture-tiktok-session.mjs`: 本地打开浏览器保存 TikTok 登录态
- `scripts/export-tiktok-report-with-browser.mjs`: 云端用保存的登录态自动导出 TikTok Excel
- `scripts/prepare-feishu-excel-data.py`: 把 TikTok Excel 整理为飞书 18 列完整字段
- `scripts/sync-feishu-sheet-from-tiktok-report.mjs`: 用飞书 OpenAPI 合并写入 `TikTok每日视频数据`
- `scripts/enrich-tiktok-media.mjs`: 按视频 ID 匹配本地素材，并为缺失素材使用明确的待处理占位
- `scripts/validate-site-data.mjs`: 校验网站展示数据和素材路径
- `.openai/hosting.json`: Sites 托管项目配置
- `docs/phase-one-workflow.md`: 第一阶段网站展示链路
- `docs/phase-two-cloud-automation.md`: 第二阶段云端每日自动更新
- `docs/feishu-data-source.md`: 飞书表格数据源和完整字段规范
- `docs/production-workflow.md`: 上线、自动化和飞书链路说明

## 本地运行

```bash
npm install
npm run dev
```

## 生成网站数据

```bash
npm run data:import -- data/exports/tiktok-video-list-20260629-20260705.xlsx
```

默认会输出到 `data/site-videos.json`，并自动校验数据结构、重复视频、指标类型和素材路径。更新数据后重新构建或发布网站即可看到最新内容。

## 校验数据

```bash
npm run data:validate
```

## 从飞书生成网站数据

```bash
FEISHU_READ_MODE=lark-cli npm run feishu:import
```

云端自动任务会使用飞书应用密钥读取表格，不依赖本机登录态。目标表和字段规范见 `docs/feishu-data-source.md`。

## TikTok Excel 写入飞书并刷新网站

```bash
npm run local:refresh -- <TikTok导出.xlsx>
```

Codex 本机自动任务 `TikTok 每日视频内部站更新` 每天北京时间 09:13 会自动执行这条链路：下载 TikTok Excel、滚动解析导出文件里最近 3 天的视频、合并写入飞书 `TikTok每日视频数据`、读取飞书生成网站数据、发布飞书妙搭内部站，并通过“柯学的飞书 CLI”应用机器人推送到飞书群。业务数据不再发布到公开 GitHub Pages。

每日写入不是只看 Excel 最新日期，而是默认回看最近 3 天并按视频链接覆盖更新旧行。这样如果 TikTok 因时差或统计延迟导致昨天早上数据偏少，第二天刷新时会自动把昨天补全后的 GMV、订单、播放等指标同步进飞书和网站。

如果定时任务在数据源检查、导出、写表、构建或发布阶段失败，会在本次 Codex 自动任务里报告失败阶段；能连接飞书时会向群里发送简短失败提示。

## TikTok 浏览器自动导出

没有稳定 XLSX 下载 URL 时，可以用 Playwright 模拟人工导出。推荐先在本机保存一次 TikTok 登录态：

```bash
npx playwright install chromium
npm run tiktok:session
```

登录成功后会生成 `.auth/tiktok-storage-state.json`。把它转成 GitHub Secret：

```bash
base64 -i .auth/tiktok-storage-state.json | tr -d '\n' | pbcopy
```

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 里新增：

- `TIKTOK_STORAGE_STATE_B64`: 上面复制的 base64 内容
- `TIKTOK_LOGIN_USERNAME`: 可选，TikTok 联盟后台登录账号
- `TIKTOK_LOGIN_PASSWORD`: 可选，TikTok 联盟后台登录密码
- `TIKTOK_EXPORT_PAGE_URL`: 可选，默认是墨西哥店铺的联盟视频数据页

每日 workflow 会优先使用 `TIKTOK_REPORT_URL`；如果没有这个 URL，但配置了 `TIKTOK_STORAGE_STATE_B64` 或 `TIKTOK_LOGIN_USERNAME` / `TIKTOK_LOGIN_PASSWORD`，就会自动打开 TikTok 联盟中心、点击“导出数据”、下载 Excel、写入飞书、刷新网站并推送飞书群。登录态过期时会尝试账号密码登录；如果遇到验证码、二次验证或风控，workflow 会失败提醒，需要人工验证后再重跑。

本机自动任务可以使用同样的账号密码兜底。把下面内容放在不会提交的 `.env.local`：

```text
TIKTOK_LOGIN_USERNAME=<TikTok 联盟后台账号>
TIKTOK_LOGIN_PASSWORD=<TikTok 联盟后台密码>
```

## 验证构建

```bash
npm run workflow:check
```

这个命令会先校验 `data/site-videos.json`，再构建网站。

## 公开网站构建

```bash
npm run pages:check
```

这个命令只保留给代码验证或临时公开演示。当前生产链路不使用 GitHub Pages 发布业务数据。

## 飞书内可打开版本

```bash
npm run miaoda:publish
```

这个命令会生成飞书内稳定打开的静态站点，并发布到飞书妙搭应用 `app_179t4tka49p`：`https://xinchimcn.aiforce.cloud/app/app_179t4tka49p`。这个链接已经放开给飞书群 `墨区小组` 访问，用于解决飞书内置浏览器打不开 `github.io` 的问题。

当前每日自动任务会在本机用用户身份重新发布妙搭 HTML，并把访问范围锁定为飞书群 `墨区小组`。

## 生产化方向

第一阶段现在做数据自动更新链路：

1. 下载 TikTok 每日 Excel
2. 只解析最新日期的新视频，并保留 18 列完整字段
3. 合并写入飞书 `TikTok每日视频数据`
4. 读取飞书生成 `site-videos.json`
5. 构建并发布飞书妙搭内部站
6. 发布成功后推送飞书群 `墨区小组`
7. 交付团队访问链接

完整链路见 `docs/production-workflow.md`。第二阶段再继续接入：

- 更完整的视频下载、关键帧、字幕和脚本拆解
- 云服务器或妙搭全栈运行时读取最新数据，逐步摆脱本机依赖

第二阶段云端任务说明见 `docs/phase-two-cloud-automation.md`。
