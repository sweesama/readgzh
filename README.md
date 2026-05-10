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

WeChat articles can't be read by Claude, ChatGPT, Cursor, or other AI tools — `mp.weixin.qq.com` blocks bots. ReadGZH solves this with a cloud reader you can call from any AI client.

- ☁️ **Cloud-based** — no WeChat desktop install, no local script
- 💰 **Shared cache** — previously read articles cost 0 credits for everyone
- 🖼️ **CDN image proxy** — permanent image links, no expiry
- 📱 **Image-post (图文) support** — full coverage of WeChat's gallery format
- 🤖 **AI summaries** — structured JSON via `?mode=summary` (Pro)
- 🔌 **MCP, OpenAPI, REST** — works with Claude Desktop, Cursor, ChatGPT, custom agents

## Quick Start

### Use it from your AI client (MCP)

ReadGZH is a remote MCP server — no install. Add to your MCP client config:

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
      "headers": { "Authorization": "Bearer rgz_..." }
    }
  }
}
```

### Use it from code (REST)

```bash
curl -X POST https://api.readgzh.site/rd \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer rgz_..." \
  -d '{"url":"https://mp.weixin.qq.com/s/xxxx"}'
```

Full API spec: <https://readgzh.site/.well-known/openapi.yaml>

## Tools (MCP)

| Tool | Purpose |
| --- | --- |
| `readgzh.read` | Read & extract a WeChat article from a URL |
| `readgzh.search` | Search cached articles by keyword |
| `readgzh.list` | List recently cached articles |
| `readgzh.get` | Fetch a cached article by slug |

## Pricing

- **Free** — 30 credits/day for registered users · 10/IP/day anonymous
- **Lite** — ¥9/month · 300 reads/month
- **Pro** — ¥39/month · 2000 reads/month + AI summary

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
