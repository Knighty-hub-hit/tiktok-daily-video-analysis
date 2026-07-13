# 飞书表格数据源

## 目标表

- 表格链接：`https://xinchimcn.feishu.cn/wiki/VUs4wyJ6Mi1MlHkhQkCcrx8hnvh`
- 工作表：`TikTok每日视频数据`
- 网站读取范围：只处理 `2026-07-01` 及之后的视频数据

`达人视频总表` 是嵌入的多维表格资源，不是普通电子表格网格；网站自动化读取使用同一个飞书文件中新建的普通工作表 `TikTok每日视频数据`。
导入脚本会在没有可用视频行时保留已有网站数据，不会把网站清空。

## 自动化写入字段

以后 TikTok 联盟导出或旧自动化写入飞书时，优先写下面这些字段。字段名按这里保持中文即可，网站脚本也兼容少量英文别名。

| 字段 | 说明 |
| --- | --- |
| 视频名称 | TikTok 视频标题或描述 |
| 视频链接 | `https://www.tiktok.com/@.../video/...` |
| 视频发布日期 | `YYYY-MM-DD` |
| 达人用户名 | 建议带 `@`，如 `@creator` |
| GMV | 视频总 GMV |
| 联盟带货视频 GMV | 联盟归因 GMV，优先用于网站展示 |
| 联盟订单量 | 订单数 |
| 联盟成交件数 | 成交商品件数 |
| 带货视频曝光次数 | 曝光/播放口径 |
| 带货视频点赞数 | 点赞数 |
| 带货视频评论数 | 评论数 |
| 联盟点击率 | 百分比数值，如 `2.24` |
| 带货视频平均订单金额 | 平均订单金额 |
| 带货视频千次曝光成交金额 | 千次曝光成交金额 |
| 预计佣金 | 预计佣金 |

至少需要 `视频链接`、`视频发布日期`、`达人用户名` 三列。指标列缺失时会按 `0` 处理，但网站分析价值会明显下降。

## 本地导入

```bash
FEISHU_READ_MODE=lark-cli npm run feishu:import
npm run data:validate
```

本地模式会使用当前机器已有的飞书连接。

## GitHub 云端配置

GitHub Actions 不依赖本机飞书登录态。需要在仓库 Secrets 里配置：

```text
FEISHU_SHEET_URL=https://xinchimcn.feishu.cn/wiki/VUs4wyJ6Mi1MlHkhQkCcrx8hnvh
FEISHU_SHEET_NAME=TikTok每日视频数据
FEISHU_APP_ID=<飞书应用 app id>
FEISHU_APP_SECRET=<飞书应用 app secret>
```

TikTok Excel 自动导出有三种来源，优先级从高到低：

```text
TIKTOK_REPORT_URL=<稳定 Excel 下载 URL，可选>
TIKTOK_STORAGE_STATE_B64=<TikTok 浏览器登录态，可选>
TIKTOK_LOGIN_USERNAME=<TikTok 联盟后台账号，可选>
TIKTOK_LOGIN_PASSWORD=<TikTok 联盟后台密码，可选>
```

如果没有稳定下载 URL，GitHub Actions 会用浏览器自动打开联盟后台导出 Excel。已配置登录态时优先复用登录态；登录态缺失或过期时，会尝试账号密码登录。验证码、二次验证或风控需要人工处理，workflow 会向飞书群报错，不会绕过。

如果 wiki 链接解析权限受限，可以额外配置：

```text
FEISHU_SPREADSHEET_TOKEN=<真实电子表格 token>
FEISHU_SHEET_ID=hlCeKL
```

建议生产环境直接配置 `FEISHU_SPREADSHEET_TOKEN` 和 `FEISHU_SHEET_ID`。这样 GitHub Actions 不需要先解析 wiki 节点，读取更稳定。

## 每日导出写入

TikTok 联盟中心导出的 Excel 需要先整理为飞书可直接批量写入的 18 列 CSV：

```bash
npm run feishu:prepare -- <TikTok导出.xlsx> <输出.csv>
```

云端自动任务使用 JSON 中间文件，随后通过飞书 OpenAPI 合并写入普通工作表：

```bash
npm run feishu:prepare -- <TikTok导出.xlsx> data/tiktok-feishu-latest.json
npm run feishu:sync -- data/tiktok-feishu-latest.json
```

默认每日模式会滚动读取 TikTok 导出文件里的最近 3 天视频，按视频链接/视频 ID 去重，并保留全部 18 个原始字段。同步时会先读取飞书现有数据，再用最新 Excel 覆盖同视频的指标；这样每日既能追加当天新视频，也能把前一天因时差或统计延迟补全的 GMV、订单、播放等指标更新进去，同时不会丢掉 `2026-07-01` 以来更早的历史行。

如果需要调整回看窗口，可以临时设置天数：

```bash
TIKTOK_IMPORT_MODE=rolling-days TIKTOK_ROLLING_LOOKBACK_DAYS=5 npm run feishu:prepare -- <TikTok导出.xlsx> data/tiktok-feishu-latest.json
```

需要历史补录时，可以临时使用全量模式：

```bash
TIKTOK_IMPORT_MODE=all-since-start npm run feishu:prepare -- <TikTok导出.xlsx> data/tiktok-feishu-latest.json
```

每日北京时间 09:13，GitHub Actions 会按 `TikTok Excel -> 最近 3 天滚动补写飞书 TikTok每日视频数据 -> data/site-videos.json -> 素材状态匹配 -> GitHub Pages -> 飞书群推送` 的顺序刷新。这一段不依赖本机飞书登录状态。选择 09:13 是为了避开 GitHub Actions 整点高峰，降低定时任务被延迟或丢弃的概率。

飞书群消息的主链接使用妙搭域名 `https://xinchimcn.aiforce.cloud/app/app_179t4tka49p`，用于避开飞书内置浏览器访问 `github.io` 不稳定的问题。当前妙搭版本是稳定 HTML 发布版，发布命令 `lark-cli apps +html-publish` 只支持用户身份，所以每日云端任务会自动刷新 GitHub Pages 和群消息；要让妙搭链接本身也每天自动实时更新，需要下一阶段改成妙搭全栈应用运行时读取飞书/站点数据，或在 CI 中配置可用的用户发布凭证。
