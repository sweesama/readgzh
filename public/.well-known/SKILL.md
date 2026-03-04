---
name: readgzh
description: Read and extract full content from WeChat Official Account (微信公众号) articles. Supports text articles and image-based posts.
version: 1.0.0
author: readgzh
triggers:
  - "微信"
  - "公众号"
  - "wechat"
  - "mp.weixin"
  - "读文章"
  - "read article"
tools:
  - name: read_wechat_article
    description: Read and extract the full content of a WeChat Official Account article given its URL. Returns title, author, publish time, and full text content.
    parameters:
      url:
        type: string
        description: The WeChat article URL (must be from mp.weixin.qq.com)
        required: true
  - name: search_articles
    description: Search cached WeChat articles by keyword
    parameters:
      query:
        type: string
        description: Search keyword
        required: true
  - name: list_recent_articles
    description: List recently cached WeChat articles
    parameters:
      limit:
        type: number
        description: Number of articles to return (default 10)
        required: false
  - name: get_article_by_slug
    description: Get a cached article by its slug identifier
    parameters:
      slug:
        type: string
        description: The article's short identifier
        required: true
config:
  api_key:
    type: string
    required: false
    description: "API Key (sk_live_...) for authenticated access. Get one free at https://readgzh.site/dashboard. Without a key, the skill uses the public endpoint with rate limits."
---

# ReadGZH — 微信公众号文章阅读器

This skill allows you to read, search, and retrieve WeChat Official Account (微信公众号) articles.

## How It Works

When a user shares a WeChat article link (`mp.weixin.qq.com`), use the `read_wechat_article` tool to fetch the full article content. The service automatically:

1. Detects and scrapes the article content
2. Extracts title, author, publish time, and body text
3. Caches the result for future free access
4. Returns clean, AI-friendly text content

## Usage Examples

### Reading an article
User: "帮我读一下这篇文章 https://mp.weixin.qq.com/s/xxxxx"
→ Use `read_wechat_article` with the provided URL

### Searching cached articles
User: "搜索关于 AI 的微信文章"
→ Use `search_articles` with query "AI"

### Listing recent articles
User: "最近有什么文章？"
→ Use `list_recent_articles`

## API Endpoints

All tools call the ReadGZH API at `https://api.readgzh.site`:

- **Read article**: `GET /rd?url={wechat_url}`
- **Get by slug**: `GET /rd?s={slug}`
- **MCP Server**: `POST /mcp-server` (for MCP-compatible clients)

## Authentication

If an API key is configured, include it as `Authorization: Bearer sk_live_...` header. Without a key, the public endpoint is used with daily rate limits.

Get a free API key at https://readgzh.site/dashboard (50 credits/day).
