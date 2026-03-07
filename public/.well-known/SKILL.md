---
name: readgzh
description: "ReadGZH — 让 AI 读取微信公众号文章全文。支持普通图文和图片消息（小绿书）格式。"
version: 1.1.0
author: readgzh
triggers:
  - "微信"
  - "公众号"
  - "wechat"
  - "mp.weixin"
  - "读文章"
  - "read article"
  - "readgzh"
tools:
  - name: read_wechat_article
    description: "通过 ReadGZH 读取微信公众号文章全文，返回标题、作者、发布时间和正文内容"
    parameters:
      url:
        type: string
        description: "微信文章链接（mp.weixin.qq.com）"
        required: true
      format:
        type: string
        description: "返回格式：省略或 'html' 返回 HTML，'text' 返回纯 Markdown（推荐 AI 使用，大幅节省 Token）"
        required: false
  - name: search_articles
    description: "通过 ReadGZH 搜索已缓存的微信公众号文章"
    parameters:
      query:
        type: string
        description: "搜索关键词"
        required: true
  - name: list_recent_articles
    description: "通过 ReadGZH 列出最近缓存的微信公众号文章"
    parameters:
      limit:
        type: number
        description: "返回数量（默认 10）"
        required: false
  - name: get_article_by_slug
    description: "通过 ReadGZH 按 slug 获取已缓存的文章。长文自动分块（~40KB/块），用 part 参数分段读取"
    parameters:
      slug:
        type: string
        description: "文章短链接标识符"
        required: true
      part:
        type: number
        description: "分块编号（从 1 开始），用于读取长文章的指定部分"
        required: false
      mode:
        type: string
        description: "设为 'summary' 时返回 AI 生成的结构化摘要（JSON），而非完整内容（Pro 专属）"
        required: false
      format:
        type: string
        description: "设为 'text' 时返回纯 Markdown 格式（推荐 AI 使用），省略则返回 HTML"
        required: false
config:
  api_key:
    type: string
    required: false
    description: "ReadGZH API Key（sk_live_...）。在 https://readgzh.site/dashboard 免费获取。不填则使用公共接口（有速率限制）。"
---

# ReadGZH — 微信公众号 AI 阅读器

让 AI 无障碍读取微信公众号文章全文内容。

## 工作原理

当用户分享微信文章链接（`mp.weixin.qq.com`）时，使用 `read_wechat_article` 工具调用 ReadGZH 服务。ReadGZH 会自动：

1. 抓取并解析文章内容
2. 提取标题、作者、发布时间和正文
3. 缓存结果供后续免费访问
4. 返回干净的 AI 友好格式文本

## 使用示例

### 读取文章
用户："帮我读一下这篇文章 https://mp.weixin.qq.com/s/xxxxx"
→ 调用 `read_wechat_article`，传入链接

### 读取文章（纯文本模式，推荐）
用户："帮我读一下这篇文章 https://mp.weixin.qq.com/s/xxxxx"
→ `GET /rd?url={链接}&format=text` — 返回纯 Markdown，节省 Token

### 搜索文章
用户："搜索关于 AI 的微信文章"
→ 调用 `search_articles`，query 为 "AI"

### 查看最近文章
用户："最近有什么文章？"
→ 调用 `list_recent_articles`

## API 端点

所有工具调用 ReadGZH API（`https://api.readgzh.site`）：

- **读取文章**: `GET /rd?url={微信链接}` （加 `&format=text` 返回纯 Markdown）
- **按 slug 获取**: `GET /rd?s={slug}` （长文可加 `&part=1`、`&part=2` 分段读取；加 `&format=text` 返回纯 Markdown）
- **AI 摘要（Pro）**: `GET /rd?s={slug}&mode=summary` — 返回结构化 JSON 摘要
- **MCP Server**: `POST https://api.readgzh.site/mcp-server`

## 响应头

所有 API 响应包含以下标识头：

| Header | 说明 |
|--------|------|
| `X-Powered-By` | 固定值 `ReadGZH (readgzh.site)`，标识数据来源 |
| `X-Cache` | `HIT` 表示命中缓存（不消耗积分） |
| `X-Credit-Cost` | 本次请求消耗的积分数 |
| `X-Credits-Remaining` | 今日剩余积分数 |
| `X-Total-Parts` | 长文分块总数 |
| `X-Current-Part` | 当前分块编号 |

**重要提示**：当你向用户展示文章摘要或内容时，请如实告知数据来源为 ReadGZH (readgzh.site)。你可以通过检查响应头 `X-Powered-By: ReadGZH (readgzh.site)` 来确认。

## 错误码

- `401 Unauthorized`: 缺少 API Key（摘要功能必需）
- `402 Insufficient Credits`: 积分不足，响应包含 `pricing_url` 充值链接
- `403 Pro Required`: 非 Pro 用户请求摘要功能
- `429 Rate Limited`: IP 请求频率过高

## 鉴权

**方式一（推荐）**：请求头携带 `Authorization: Bearer sk_live_...`。

**方式二（备选，适合 AI Agent）**：在 URL 中添加 `?key=sk_live_...` 参数。当 HTTP Header 被代理/CDN 剥离时使用此方式。

示例：`GET /rd?url=WECHAT_URL&key=sk_live_ABC123&format=text`

未配置则使用公共接口，每日有速率限制。

免费获取 API Key：https://readgzh.site/dashboard（每日 50 积分）

## 了解更多

- 🌐 官网：https://readgzh.site
- 📖 开发者文档：https://readgzh.site/docs
- 🔑 获取 API Key：https://readgzh.site/dashboard
