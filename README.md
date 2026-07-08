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
- `.openai/hosting.json`: Sites 托管项目配置
- `docs/production-workflow.md`: 上线、自动化和飞书链路说明

## 本地运行

```bash
npm install
npm run dev
```

## 生成网站数据

```bash
node scratch/export_tiktok_excel_to_site_data.mjs data/exports/tiktok-video-list-20260629-20260705.xlsx
```

默认会输出到 `data/site-videos.json`。更新数据后重新构建或发布网站即可看到最新内容。

## 验证构建

```bash
npm run build
```

## 生产化方向

完整链路见 `docs/production-workflow.md`。核心目标是每天自动完成：

1. 获取 TikTok 每日视频数据
2. 生成或更新网站数据
3. 写入飞书电子表格
4. 发布或刷新网站
5. 推送飞书群日报
6. 记录日志并在失败时告警
