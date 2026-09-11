# ReadGZH — WeChat Article Reader for AI

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Website](https://img.shields.io/badge/site-readgzh.site-299e7a)](https://readgzh.site)
[![MCP](https://img.shields.io/badge/MCP-compatible-7c3aed)](https://readgzh.site/.well-known/server.json)

**Let AI read full-text WeChat Official Account (微信公众号) articles.** Cloud-based, zero-install. Returns title, author, publish time, and clean Markdown content. Supports standard articles and image-post (图文) formats.

- 🌐 Site: <https://readgzh.site>
- 📖 Docs: <https://readgzh.site/docs>
- 💳 Pricing: <https://readgzh.site/pricing>
- 🔑 Dashboard / API Key: <https://readgzh.site/dashboard>

## Why ReadGZH

AI tools may fail to retrieve the body of a public WeChat Official Account article directly. ReadGZH provides a hosted reader for an existing article URL. Use its readable page with a browsing-capable AI, copy the extracted text, or connect through a compatible MCP client.

- ☁️ **Cloud-based** — no WeChat desktop install, no local script
- 💰 **Shared cache** — previously read articles cost 0 credits for everyone
- 🖼️ **CDN image proxy** — proxies article images for off-platform access; availability is not guaranteed indefinitely
- 📱 **Image-post (图文) support** — extracts supported image-post content; verify important image details against the original
- 🤖 **AI summaries** — structured JSON via `?mode=summary` (Pro)
- 🔌 **MCP, OpenAPI, REST** — integration options for compatible clients; availability depends on client features and configuration

## Choose the right workflow / 按需求选择

[Read the bilingual use-case and limitations guide](docs/choosing-a-wechat-reader.md) for direct answers about reading existing links, Markdown, comparing multiple articles, hosted MCP, and the difference between cache search and discovering new articles.

ReadGZH retrieves article content. It is not a complete WeChat search engine, an account subscription service, or a guarantee that an AI assistant will read every supplied link.

## 中文指南：AI 打不开公众号文章怎么办？

ReadGZH 适合这样的需求：你已经有一篇公开微信公众号文章的链接，希望把正文交给 AI 阅读，又不想安装和维护本地抓取程序。

### 偶尔读一篇：从网页开始

1. 打开 [ReadGZH](https://readgzh.site/?utm_source=github&utm_medium=referral&utm_campaign=readgzh_intent_202609&utm_content=readme_quickstart)，粘贴公众号文章链接。
2. 获取转换后的页面，把页面链接交给支持网页访问的 AI。
3. 如果你的 AI 不能打开链接，复制转换页面的正文；重要数字、引用和结论仍需回原文核对。

单篇阅读不需要先配置 MCP。能直接复制原文时，也可以直接把文字交给 AI。

### 给 Agent 使用：从远程 MCP 开始

ReadGZH 提供远程 MCP 和 REST API，适合不想自行维护浏览器与抓取环境的用户。接入示例见下方 [Quick Start](#quick-start) 和[开发者文档](https://readgzh.site/docs?utm_source=github&utm_medium=referral&utm_campaign=readgzh_intent_202609&utm_content=readme_mcp)。不同客户端的配置方式可能不同，请按对应客户端说明接入。

### 哪些情况应考虑其他方案？

- 希望全过程在本地运行、自己控制读取环境：评估本地读取工具。
- 想发现尚未提供链接的新文章、追踪公众号更新：先明确搜索或订阅需求。ReadGZH 的缓存搜索不等同于搜索微信全部文章。
- 内容不适合经过第三方服务或进入共享缓存：不要提交到 ReadGZH。

### 多篇文章怎么比较？

分别转换每篇文章，保留标题与原文链接，再把正文或可访问页面交给 AI。可以使用：

> 请先确认你能读取每篇文章的正文。按文章 A、B、C 列出核心结论、证据、适用条件和未回答的问题；每一项注明来自哪篇，未提及就写未提及。不要把不同作者的观点合并成同一个结论。

如果无法读取其中一篇，先补充该篇正文，再开始比较。

### 使用边界与费用

仅处理你有权使用的公开可访问内容。已经删除、需要授权或读取受限的文章不保证成功。转换成功也不代表 AI 的总结准确。服务有免费额度及付费方案，具体计费以[定价页](https://readgzh.site/pricing)为准。

## Quick Start

### Use it from your AI client (MCP)

ReadGZH offers two remote MCP connections. Choose the one your client supports:

| Connection | Server URL | Authentication |
| --- | --- | --- |
| OAuth (Lovable integration) | `https://jhnnmmwgdrquwjytvvwu.supabase.co/functions/v1/mcp` | Sign in to ReadGZH and approve the requested access in the Chinese authorization page |
| Existing API-key connection | `https://api.readgzh.site/mcp-server` | ReadGZH API key in the `Authorization` header; anonymous access has shared-IP limits |

**中文：新 OAuth 接入**适用于支持远程 MCP 与 OAuth 的客户端。在客户端添加上表 OAuth 地址，按页面提示登录并授权。各客户端、账号套餐和管理员设置可能限制自定义 MCP 接入；支持 MCP 不等于所有 AI 都会自动发现或使用 ReadGZH。

OAuth 连接提供 `readgzh_read`、`readgzh_search`、`readgzh_list`、`readgzh_list_by_account`、`readgzh_get` 五个工具。首次抓取前，账号需在 [控制台](https://readgzh.site/dashboard) 创建有效 API Key；新文章抓取消耗 3 积分，已缓存文章读取为 0 积分。搜索与按公众号列表仅覆盖 ReadGZH 缓存，不是全微信搜索或完整历史。

The following JSON examples use the existing API-key connection and its dot-separated tool names:

```json
{
  "mcpServers": {
    "readgzh": {
      "url": "https://api.readgzh.site/mcp-server"
    }
  }
}
```

Then ask your AI: *"Read this for me: https://mp.weixin.qq.com/s/..."*

Optional API key (higher quota, bypasses anonymous IP limits):

```json
{
  "mcpServers": {
    "readgzh": {
      "url": "https://api.readgzh.site/mcp-server",
      "headers": { "Authorization": "Bearer sk_live_..." }
    }
  }
}
```

### Use it from code (REST)

```bash
curl -X POST https://api.readgzh.site/rd \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_live_..." \
  -d '{"url":"https://mp.weixin.qq.com/s/xxxx"}'
```

Full API spec: <https://readgzh.site/.well-known/openapi.yaml>

## Tools (MCP)

| Tool | Purpose |
| --- | --- |
| `readgzh.read` | Read & extract a WeChat article from a URL |
| `readgzh.search` | Search cached articles by keyword |
| `readgzh.list` | List recently cached articles |
| `readgzh.list_by_account` | List cached articles from an account (not a complete archive) |
| `readgzh.get` | Fetch a cached article by slug |

## Pricing

- **Free** — 30 credits/day for registered users (claim daily) · 10 credits/IP/day anonymous
- **Lite** — ¥9/month · 300 credits/month
- **Pro** — ¥39/month · 2000 credits/month + AI summary

Each fresh read = 3 credits. Cached re-reads = 0. Details: <https://readgzh.site/pricing>

## Tech Stack

- React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- Lovable Cloud (Supabase: Postgres, Auth, Edge Functions, Storage)
- Cloudflare Worker proxy (`api.readgzh.site`)
- Stripe subscriptions
- MCP via [`mcp-lite`](https://www.npmjs.com/package/mcp-lite)

## License

[AGPL-3.0](./LICENSE). If you self-host or fork ReadGZH as a network service, you must release your modifications under the same license. For commercial licensing without AGPL obligations, contact <support@readgzh.site>.

## Contact

- Support: <support@readgzh.site>
- Issues: GitHub Issues
- Built with ❤️ on [Lovable](https://lovable.dev)
