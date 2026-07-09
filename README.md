# TikTok 每日视频分析台

这是一个用于沉淀 TikTok Shop 每日带货视频数据、素材预览和拆解结论的内部分析台。当前网站会读取 `data/site-videos.json`，展示每日榜单、关键指标、视频预览、关键帧、字幕脚本和复盘要点。

## 当前能力

- 按日期浏览每日视频榜单
- 查看 GMV、订单、曝光、点击率、互动等核心指标
- 展示本地保存的视频 GIF 预览、字幕和关键帧
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
- `scripts/prepare-feishu-excel-data.py`: 把 TikTok Excel 整理为飞书 18 列完整字段
- `scripts/sync-feishu-sheet-from-tiktok-report.mjs`: 用飞书 OpenAPI 合并写入 `TikTok每日视频数据`
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
npm run report:download
npm run feishu:prepare -- data/exports/tiktok-report.xlsx data/tiktok-feishu-latest.json
npm run feishu:sync -- data/tiktok-feishu-latest.json
npm run feishu:import
npm run pages:build
```

GitHub Actions 每天北京时间 12:00 会自动执行这条链路：下载 TikTok Excel、合并写入飞书 `TikTok每日视频数据`、读取飞书生成网站数据、发布 GitHub Pages，并通过“柯学的飞书 CLI”应用机器人推送到飞书群。群消息里的主链接使用飞书妙搭版本，备用链接使用 GitHub Pages。

## 验证构建

```bash
npm run workflow:check
```

这个命令会先校验 `data/site-videos.json`，再构建网站。

## 公开网站构建

```bash
npm run pages:check
```

这个命令会校验数据并生成 GitHub Pages 可发布的静态站点。GitHub 云端发布配置在 `.github/workflows/pages.yml`。

## 飞书内可打开版本

```bash
npm run miaoda:publish
```

这个命令会生成根路径静态站点，并发布到飞书妙搭应用 `app_179t4tka49p`：`https://xinchimcn.aiforce.cloud/app/app_179t4tka49p`。这个链接已经放开给飞书群 `墨区小组` 访问，用于解决飞书内置浏览器打不开 `github.io` 的问题。

## 生产化方向

第一阶段现在做数据自动更新链路：

1. 下载 TikTok 每日 Excel
2. 解析并保留 18 列完整字段
3. 合并写入飞书 `TikTok每日视频数据`
4. 读取飞书生成 `site-videos.json`
5. 构建并发布 GitHub Pages
6. 按需发布飞书妙搭访问版本
7. 发布成功后推送飞书群 `墨区小组`
8. 交付团队访问链接

完整链路见 `docs/production-workflow.md`。第二阶段再继续接入：

- 长期自动化调度和告警
- 视频素材下载、关键帧、字幕和脚本拆解

第二阶段云端任务说明见 `docs/phase-two-cloud-automation.md`。
