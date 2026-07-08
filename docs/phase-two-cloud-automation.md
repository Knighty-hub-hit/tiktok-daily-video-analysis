# 第二阶段：云端每日自动更新

这一阶段的目标是让每日更新不依赖本机电脑。当前已加入 GitHub Actions 云端任务：

```text
.github/workflows/daily-refresh.yml
```

它会在 GitHub 云端按北京时间每天 09:15 执行，也可以在 GitHub Actions 页面手动触发。

## 已经接好的部分

云端任务当前会做这些事：

1. 检查是否已配置每日 TikTok 报表来源。
2. 从云端 URL 下载 TikTok 导出的 `.xlsx` 文件。
3. 执行 `npm run data:import`，生成并校验 `data/site-videos.json`。
4. 执行 `npm run pages:build`，生成公开网站静态产物。
5. 如果数据有变化，提交更新后的 `data/site-videos.json`。
6. 部署 GitHub Pages 公开网站。

如果没有配置报表来源，任务会安全跳过，不会把错误页面写入网站数据。

## 现在还缺的关键输入

要让它真正每天自动更新，需要先确定“TikTok 每日数据源”从哪里来。至少需要以下一种：

### 方案 A：稳定的 Excel 下载地址

这是最快落地的方式。需要提供 GitHub 仓库 Secret：

```text
TIKTOK_REPORT_URL
```

要求：

- URL 每天打开时能拿到最新 `.xlsx`
- 文件字段结构和当前 `data/exports/tiktok-video-list-20260629-20260705.xlsx` 一致
- 如果 URL 需要登录，还需要提供下面其中一种 Secret：

```text
TIKTOK_REPORT_AUTHORIZATION
TIKTOK_REPORT_COOKIE
```

### 方案 B：TikTok Shop 官方 API

这是最稳的长期方式，但需要先拿到 TikTok Shop / Partner API 权限，并确认接口能返回当前 Excel 里的这些字段：

- 视频链接
- 视频发布日期
- 视频名称
- 达人用户名
- GMV
- 联盟订单量
- 联盟成交件数
- 曝光
- 点赞
- 评论
- 联盟点击率
- 预计佣金

需要你提供：

```text
TikTok Shop API 应用权限
app key / app secret 或等价凭据
店铺/联盟账号授权方式
接口文档或后台里可见的 API 页面
```

拿到后再把 `scripts/download-tiktok-report.mjs` 替换或扩展成 API 拉取脚本。

### 方案 C：飞书表格作为中间数据源

如果飞书电子表格已经每天自动录入完整 TikTok 数据，也可以让 GitHub Actions 每天从飞书导出或读取表格，再生成网站数据。

需要你提供：

```text
飞书应用 app_id / app_secret
目标电子表格 URL
可读取表格的机器人或应用权限
```

这条路线的好处是 TikTok 登录问题留在飞书/现有链路里，网站只读飞书里的标准化数据。

## 不建议的兜底方式

用云端浏览器自动登录 TikTok 后台并点击导出也能做，但不建议作为长期主链路，因为它容易受验证码、二次验证、页面改版、账号风控影响。只有在官方 API 和稳定导出地址都不可用时再考虑。

## GitHub Pages 的前置条件

当前仓库是私有仓库，GitHub Pages 设置页提示：

```text
Upgrade or make this repository public to enable Pages
```

因此公开网站需要二选一：

1. 把仓库改成 Public，走免费 GitHub Pages。
2. 保持仓库私有，改走 Cloudflare/Vercel 等平台，或升级 GitHub 计划支持私有仓库 Pages。

## 验收标准

- 访问公开 URL 不需要登录。
- GitHub Actions 每天自动运行。
- `data/site-videos.json` 的 `generatedAt` 每天更新。
- 网站展示最新日期数据。
- 任务失败时能在 GitHub Actions 日志里看到失败步骤。
- 后续接飞书群推送时，失败原因可以同步到群里。
