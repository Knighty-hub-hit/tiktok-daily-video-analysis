# 第一阶段：网站展示链路

这一阶段只做图里的上半部分：

```mermaid
flowchart LR
  A["TikTok 每日数据源"] --> B["标准化 Excel / 原始记录"]
  B --> C["生成 site-videos.json"]
  C --> D["更新网站展示数据"]
  D --> E["构建并发布网站"]
  E --> F["团队访问链接"]
```

暂时不接公司服务器、不接数据库、不写飞书表格、不做飞书群推送。数据和网站代码以 GitHub 仓库与 Sites 发布版本作为保存位置，本地电脑只作为操作台。

## 输入

第一阶段默认输入是 TikTok Shop 后台导出的 Excel：

```text
data/exports/*.xlsx
```

后续如果要接自动抓取，可以把抓到的原始记录先转成同样字段，再进入这一层。

## 生成网站数据

使用一键命令：

```bash
npm run data:import -- data/exports/tiktok-video-list-20260629-20260705.xlsx
```

它会完成两步：

1. 从 Excel 生成 `data/site-videos.json`
2. 校验 JSON 结构、重复视频、指标类型和本地素材路径

如果只想校验当前站点数据：

```bash
npm run data:validate
```

## 发布前检查

```bash
npm run workflow:check
```

这个命令会先校验展示数据，再执行网站构建。两步都通过后，才进入发布。

## 发布

当前项目已有 Sites 配置：

```text
.openai/hosting.json
```

第一阶段发布策略是：每次更新 `data/site-videos.json` 和素材后，重新构建并发布网站。这样不需要数据库，也不依赖公司服务器。

## 不进入第一阶段的内容

- 飞书表格写入
- 飞书日报摘要
- 飞书群定时推送
- 公司内网部署
- 长期数据库或对象存储
- TikTok 登录态托管和自动抓取服务

这些留到第二阶段，等网站展示链路稳定后再接。

## 验收标准

- `npm run data:validate` 通过
- `npm run workflow:check` 通过
- Sites 发布成功
- 团队能打开最新网站链接
- 网站展示数据来自最新 `data/site-videos.json`
