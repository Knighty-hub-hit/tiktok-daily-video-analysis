# 达人视频总表每日流程

这个流程用于每天北京时间 09:30 处理 TikTok Shop 联盟中心导出的 Excel，并准备写入飞书【达人视频总表】的数据。

规则：

- 只读取 TikTok 导出 Excel 里的现成字段，不打开或下载 TikTok 视频。
- 只处理“视频发布日期”晚于上次成功导入日期的新视频。
- 不额外去重；日期判断通过后按导出 Excel 的顺序继续写入。
- 写入字段对应关系：
  - “达人用户名” → 【达人ID】
  - 固定“梳子” → 【产品】
  - “视频链接” → 【视频链接】
- 写入位置必须是飞书【达人视频总表】最末尾。
- 不更新本地网站。

GitHub Actions 的定时入口是 `.github/workflows/daren-video-total.yml`，cron 为 `30 1 * * *`，对应北京时间每天 09:30。

注意：GitHub 云端不能直接使用本机已经登录的 Chrome/TikTok/飞书页面。仓库里的云端 workflow 会下载并解析 Excel，生成可导入 CSV；真正写入飞书 UI 表的动作仍由本机 Codex 自动任务完成，除非后续拿到【达人视频总表】可用的 Feishu API token/table id。

本地/云端均可用下面的命令把 TikTok 导出 Excel 转成待导入 CSV：

```bash
npm run daren:prepare -- path/to/export.xlsx data/daren-video-total-latest.csv data/daren-video-total-state.json
```
