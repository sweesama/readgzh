# ReadGZH HTTP API (fallback)

Use these endpoints only when the `readgzh` MCP server is unavailable. Prefer
the MCP tools described in `SKILL.md`.

Base URL: `https://api.readgzh.site`

| Endpoint | Description |
| --- | --- |
| `GET /rd?url={wechat_url}&format=text` | Extract an article by URL, Markdown output |
| `GET /rd?s={slug}&format=text` | Read a cached article by slug |
| `GET /rd?s={slug}&part=N` | Read chunk N of a long article |
| `GET /rd?s={slug}&mode=summary` | Structured JSON summary (paid tier) |
| `GET /articles-api/search?q={query}&limit={n}` | Search cached articles |
| `GET /articles-api/recent?limit={n}` | List recent cached articles |

## Authentication

Send the key in the header, never in the query string:

```
Authorization: Bearer sk_live_...
```

Free keys: https://readgzh.site/dashboard

## Response headers

`X-Cache` (HIT/MISS), `X-Credit-Cost`, `X-Credits-Remaining`,
`X-Total-Parts`, `X-Current-Part`, `X-Powered-By`.

## Status codes

400 bad params · 401 unauthorized · 402 no credits · 403 paid tier required ·
404 not found · 422 extraction failed · 429 rate limited.

OpenAPI: https://readgzh.site/.well-known/openapi.yaml
