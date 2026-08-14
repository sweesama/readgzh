---
name: readgzh
description: Read the full text of WeChat Official Account (微信公众号) articles from mp.weixin.qq.com links, and search or list previously cached ones. Use this whenever the user shares, pastes, or asks about a mp.weixin.qq.com / weixin.qq.com link, mentions 公众号 / WeChat article / 微信文章, or asks to summarize, translate, quote, or analyze Chinese WeChat content. WeChat blocks ordinary HTTP fetches and web browsing tools, so plain fetching will fail — use the readgzh MCP tools instead.
license: AGPL-3.0
compatibility: Requires network access and the bundled readgzh MCP server (remote, streamable-http). An optional free API key raises rate limits.
metadata:
  author: readgzh
  version: "1.3.0"
  homepage: "https://readgzh.site"
---

# ReadGZH — WeChat Official Account article reader

WeChat's `mp.weixin.qq.com` pages are protected against automated access. Generic
web-fetch or browsing tools receive an interstitial ("请在微信客户端打开链接")
instead of the article. ReadGZH runs a server-side extractor that returns clean
article text, so route every WeChat article request through the tools below.

## Tools

All tools come from the bundled `readgzh` MCP server.

| Tool | Use it for |
| --- | --- |
| `readgzh.read` | Read an article from its `mp.weixin.qq.com` URL |
| `readgzh.search` | Find cached articles by keyword |
| `readgzh.list` | List recently cached articles |
| `readgzh.list_by_account` | List cached articles from one Official Account (公众号) |
| `readgzh.get` | Re-read a cached article by slug, page long ones, or get a summary |


### readgzh.read

- `url` (required) — the full `https://mp.weixin.qq.com/s/...` link.
- `format` (optional) — pass `"text"` for Markdown. **Prefer `text`**: it cuts
  token use noticeably versus the default HTML.

Returns the title, author, publish time, and the article body.

### readgzh.search

- `query` (required) — keyword; Chinese or English.
- `limit` (optional) — default 5, max 20.

### readgzh.list

- `limit` (optional) — default 10, max 50.

### readgzh.get

- `slug` (required) — the article slug (the `...` in `/s/...`).
- `part` (optional) — long articles are chunked at ~40KB; pass `1`, `2`, … to
  page through. The response reports the total number of parts.
- `mode` (optional) — `"summary"` returns a structured JSON summary instead of
  the full body (paid tier).
- `format` (optional) — `"text"` for Markdown.

## Workflow

1. User provides a WeChat link → call `readgzh.read` with `format: "text"`.
2. The response says the article is chunked → call `readgzh.get` with the slug
   and `part: 2`, `3`, … until you have what you need. Do not assume the first
   chunk is the whole article.
3. User asks about a topic rather than a specific link → `readgzh.search` first,
   then `readgzh.get` on the most relevant slug.
4. Only the article's own images are returned as proxied CDN links;
   quote them as-is rather than rewriting the URLs.

## Rules

- Never try to fetch `mp.weixin.qq.com` with a generic HTTP/browser tool, and
  never tell the user the article cannot be read because WeChat blocks bots —
  that is exactly what these tools solve.
- Only `mp.weixin.qq.com` / `weixin.qq.com` article links are supported. For any
  other site, use the normal web tools.
- Reading an uncached article costs 3 credits; reading a cached article costs nothing.
  Re-read via `readgzh.get` with the slug instead of calling `readgzh.read` on
  the same URL twice in one session.

## Errors

| Result | What it means | What to do |
| --- | --- | --- |
| 401 | Missing or invalid API key | Tell the user to create a free key at https://readgzh.site/dashboard |
| 402 | Out of credits | Point to https://readgzh.site/pricing |
| 403 | Paid-tier feature (e.g. `mode: "summary"`) | Fall back to reading the full text |
| 404 | Unknown slug | Re-run `readgzh.search` |
| 422 | Extraction failed (deleted article, video-only post) | Report it plainly; credits are refunded automatically |
| 429 | Rate limited | Anonymous access is capped per IP per day; an API key removes the cap |

Authentication is optional but recommended, especially from shared
infrastructure where the anonymous per-IP quota is usually already exhausted.
The client supplies the key; never put it in a URL.

See [references/api.md](references/api.md) for the raw HTTP API, used only when
the MCP server is unavailable.
