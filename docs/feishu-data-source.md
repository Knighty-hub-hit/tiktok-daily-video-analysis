# 飞书表格数据源

## 目标表

- 表格链接：`https://xinchimcn.feishu.cn/wiki/VUs4wyJ6Mi1MlHkhQkCcrx8hnvh`
- 工作表：`达人视频总表`
- 网站读取范围：只处理 `2026-07-01` 及之后的视频数据

当前这张工作表还是空表。导入脚本会在没有可用视频行时保留已有网站数据，不会把网站清空。

## 旧自动化写入字段

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
FEISHU_SHEET_NAME=达人视频总表
FEISHU_APP_ID=<飞书应用 app id>
FEISHU_APP_SECRET=<飞书应用 app secret>
```

如果 wiki 链接解析权限受限，可以额外配置：

```text
FEISHU_SPREADSHEET_TOKEN=<真实电子表格 token>
FEISHU_SHEET_ID=bhU7vA
```

每日任务会优先使用手动传入的 TikTok Excel URL；没有 URL 时，使用飞书表格作为数据源。
