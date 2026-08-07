# ReadGZH — Agent Plugin

An [Agent Plugins 1.0.0](https://agent-plugins.org/) package that lets any
compatible AI coding agent read full-text WeChat Official Account
(微信公众号) articles.

WeChat blocks automated access to `mp.weixin.qq.com`, so built-in web-fetch
tools return an interstitial instead of the article. This plugin ships the
ReadGZH remote MCP server plus a skill that teaches the agent when and how to
use it.

## Contents

```text
readgzh/
├── plugin.json                       # Agent Plugins manifest
├── mcp.json                          # remote MCP server (streamable-http)
└── skills/readgzh/
    ├── SKILL.md
    └── references/api.md
```

## Install

Point your client's plugin installer at this directory, or fetch it from
`https://readgzh.site/plugin/`.

The MCP server is remote — nothing runs locally:
`https://api.readgzh.site/mcp-server`

## Tools

| Tool | Description |
| --- | --- |
| `readgzh.read` | Read an article by `mp.weixin.qq.com` URL |
| `readgzh.search` | Search cached articles by keyword |
| `readgzh.list` | List recently cached articles |
| `readgzh.get` | Read a cached article by slug, chunked or summarized |

## Auth and pricing

Works anonymously with a per-IP daily cap. A free API key
(https://readgzh.site/dashboard) removes the cap and adds a monthly credit
allowance; paid tiers at https://readgzh.site/pricing. Articles already in the
shared cache cost nothing for everyone.

Licensed AGPL-3.0. Support: support@readgzh.site
