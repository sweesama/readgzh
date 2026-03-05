---
name: readgzh
description: "ReadGZH — 让 AI 读取微信公众号文章全文。支持普通图文和图片消息（小绿书）格式。"
version: 1.0.0
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
        description: "设为 'summary' 时返回 AI 生成的结构化摘要（JSON），而非完整 HTML"
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

### 搜索文章
用户："搜索关于 AI 的微信文章"
→ 调用 `search_articles`，query 为 "AI"

### 查看最近文章
用户："最近有什么文章？"
→ 调用 `list_recent_articles`

## API 端点

所有工具调用 ReadGZH API（`https://api.readgzh.site`）：

- **读取文章**: `GET /rd?url={微信链接}`
- **按 slug 获取**: `GET /rd?s={slug}` （长文可加 `&part=1`、`&part=2` 分段读取）
- **MCP Server**: `POST https://api.readgzh.site/mcp-server`

## 错误码

- `402 Insufficient Credits`: 积分不足，响应包含 `pricing_url` 充值链接
- `429 Rate Limited`: IP 请求频率过高

## 鉴权

如配置了 API Key，请求头携带 `Authorization: Bearer sk_live_...`。
未配置则使用公共接口，每日有速率限制。

免费获取 API Key：https://readgzh.site/dashboard（每日 50 积分）

## 了解更多

- 🌐 官网：https://readgzh.site
- 📖 开发者文档：https://readgzh.site/docs
- 🔑 获取 API Key：https://readgzh.site/dashboard
