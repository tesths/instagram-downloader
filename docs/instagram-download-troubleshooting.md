# Instagram 下载故障排查记录

这份记录用于下次出现下载失败、页面样式异常、接口返回非 JSON 时快速定位。

## 背景

最近两次提交前，下载失败的主要原因是 Instagram 的接口和返回结构变了。旧代码只依赖一条 GraphQL 路径，使用固定的 `doc_id`、`X-CSRFToken`、`X-FB-LSD` 和请求参数，只从 `data.xdt_shortcode_media` 读取媒体。Instagram 结构变化后，这条路径拿不到媒体数据，就会报 `No Content` 或 `Data Request Error`。

最近两次提交修复了这个问题：新增了 embed、`?__a=1&__d=1`、GraphQL、`/media/?size=l` 多种 fallback，并支持 v1 media payload 和 carousel 多图、多视频。

## 本次回归

这次出现了三个表面问题：

- 页面从黑色样式变成白色。
- 下载接口报 `Unexpected token 'T', "The page c"... is not valid JSON`。
- 点击 `Download` 后看起来没有反应。

根因分两层：

1. `public/sw.js` 会拦截并缓存所有请求，包括 `/api/ig`、HTML 和 Next 静态资源。旧缓存可能把错误页或旧页面返回给 API 请求，前端把页面文本当 JSON 解析，就会出现 `Unexpected token 'T'`。静态资源或主题脚本被旧缓存污染后，页面也可能退回白色主题。
2. 本地代理未连通时，服务端请求 `www.instagram.com:443` 会超时。按钮其实已经发起请求，但后端一直等外部请求，所以用户看到的是“没反应”。

## 修改方案

### Service Worker 清理

- `src/app/components/Content.tsx` 不再注册旧 service worker。
- 客户端启动时会注销已有 service worker。
- `public/sw.js` 改成自清理版本：删除所有旧 cache，注销自身，并刷新已打开页面。

这样可以让访问过旧版本的浏览器自动脱离旧缓存。

### API 缓存和超时

- `src/app/api/ig/route.ts` 给 `/api/ig` 响应加 `Cache-Control: no-store, max-age=0`。
- API 外层加整体超时保护，外部 Instagram 请求卡住时会返回明确错误。
- 前端 `IgForm` 请求加 20 秒超时，按钮 loading 文案改为 `Fetching...`。

### Instagram 抓取策略

- `src/core/Ig.ts` 的单次 Instagram 请求超时降为 5 秒。
- 按链接类型只尝试对应的 embed 路径，避免 post 链接还串行尝试 reel、tv 路径。
- A1 和 GraphQL 响应必须是对象型 JSON 才继续解析，HTML 或纯文本错误页会被跳过。
- `src/lib/utils.ts` 新增 `parseIgMediaType`，让 URL 类型解析和 shortcode 解析共用同一套校验。

### UI 和构建 warning

- 图片结果从 `<img>` 改为 `next/image`，并保留 `unoptimized`，避免 Next 代理优化 Instagram 临时资源。
- `IgForm` 的初始化请求和 hook 依赖已整理，清掉 `react-hooks/exhaustive-deps` warning。

## 下次排查步骤

### 1. 先确认是否是本机外网或代理问题

```bash
curl --connect-timeout 8 --max-time 20 -I -L https://www.instagram.com/p/<shortcode>/embed/
```

如果连接 `www.instagram.com:443` 超时，先修代理或网络。应用代码无法绕过这个问题。

### 2. 看本地 API 是否返回 JSON

```bash
curl -i "http://localhost:3000/api/ig?postUrl=<encoded-instagram-url>"
```

正常情况应该返回：

- `content-type: application/json`
- 成功时 body 是 `{ "data": [...] }`
- 失败时 body 是 `{ "message": "..." }`

如果 body 是 HTML 或 `"The page could..."`，优先检查 service worker 和缓存。

### 3. 检查浏览器旧缓存

如果样式变白、接口返回旧内容或页面表现和代码不一致，先检查：

- Chrome DevTools -> Application -> Service Workers
- Chrome DevTools -> Application -> Cache Storage
- 硬刷新页面

当前代码会自动清理旧 service worker，但旧页面第一次打开时仍可能需要刷新一次。

### 4. 跑回归验证

```bash
npm test
npm run build
```

当前回归测试覆盖：

- 支持带 query 参数的 Instagram URL。
- 支持 carousel 多媒体。
- 跳过无效媒体 URL。
- 跳过 Instagram 返回的非 JSON 页面。

## 当前验证结果

本次修复后验证结果：

- `npm test` 通过，17 个测试全部通过。
- `npm run build` 通过，已清掉原来的 `<img>` 和 hook dependency warning。
- 外网恢复后，本地 `/api/ig` 实测约 4.6 秒返回 200 和媒体资源。

如果后续再次不能下载，先确认网络和代理，再看 Instagram 返回结构是否又变化。
