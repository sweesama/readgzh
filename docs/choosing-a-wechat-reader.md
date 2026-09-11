# Reading WeChat articles with AI: when to use ReadGZH

ReadGZH is a hosted reader for existing public WeChat Official Account (微信公众号) article URLs. It extracts article content for use through a readable page, Markdown output, REST API, or compatible remote MCP client. The AI assistant performs the subsequent analysis; extracting text does not verify the author's claims or the assistant's answer.

中文：ReadGZH 适合“已经拿到公众号链接，希望把正文交给 AI”的需求。它提供云端正文读取与缓存，不是全微信搜索、自动订阅或完整历史文章数据库。

Maintained by the ReadGZH project. Documentation updated: 2026-09-11.

## Which workflow fits my task?

| Task | Starting point | ReadGZH's role and limits |
| --- | --- | --- |
| Read one article | Copy accessible text, or generate a readable page | A convenient option when direct AI link access fails; no MCP setup is required for the web workflow |
| Get Markdown from an existing link | ReadGZH REST API with `format=text` | Extracts supported content; image-only details may require checking the original |
| Compare several articles | Retrieve each article separately, preserve its source, then give the material to AI | Supplies content, not a one-click batch comparison feature |
| Add article reading to an Agent | A compatible remote MCP client | Hosted service avoids maintaining a local extraction environment; client authentication and quotas still apply |
| Discover articles on a topic | A search service with suitable coverage | ReadGZH search covers its existing cache, not all WeChat articles |
| Monitor an account or export its complete history | A suitable authorized subscription/archive workflow | Listing cached articles from an account does not establish complete coverage or provide continuous monitoring |
| Keep content entirely local | A local workflow you control | ReadGZH is a cloud service with shared caching; do not submit content unsuitable for that processing |

## AI 打不开公众号链接，怎么把正文交给它？

先判断 AI 是否具备网页读取功能。可以直接复制的少量文字，粘贴正文即可；需要整理链接时，在 [ReadGZH 首页](https://readgzh.site/) 逐篇生成阅读页，再把处理后的链接交给能够访问网页的 AI。如果仍然无法访问，就复制正文。让 AI 给出可核对的原文短句，人工对照来源；不要只凭一段流畅的摘要判断它已经读到了全文。

Deleted, protected, inaccessible, or unsupported content may fail to extract. A readable page cannot grant access to content that the service cannot retrieve. See the [web reading guide](https://readgzh.site/guides/ai-read-wechat).

## 公众号转 Markdown，和把 Markdown 排版成公众号文章一样吗？

不是。本指南讨论的方向是“已有公众号文章 → 可供 AI 使用的正文或 Markdown”。它不是编辑器排版、公众号发文或自动发布服务。REST API 的 `format=text` 参数用于 Markdown 输出；参数、认证和错误处理见 [API 文档](https://readgzh.site/docs) 与 [OpenAPI](https://readgzh.site/.well-known/openapi.yaml)。

## How do I compare three articles without mixing up their claims?

Retrieve each article separately. Assign A/B/C source IDs and retain title, account, date, and original URL. Supply the full text or accessible pages to your AI. If one article is missing, provide it before asking for a comparison. For long inputs, use consistent evidence cards and return to the full text for important claims.

Copyable prompt:

> Compare the supplied articles A, B, and C using only their content. First identify missing or truncated inputs. For each comparison point, list each article's claim, evidence, time period, applicable conditions, and a short supporting passage with its source ID. Write “not mentioned” where appropriate. Separate the author's opinion from reported data and your inference. Distinguish genuine disagreement from different metrics or time periods. If several articles cite the same underlying source, do not count them as independent evidence. Finish with unresolved questions to verify in the originals.

中文：先分清“文章没有讨论”和“文章反对”。例如订单增长和利润下降不是同一个指标；三篇文章引用同一份报告也不是三份独立证据。ReadGZH 提供正文，比较与判断由 AI 和使用者完成。

## Do I need MCP, and will every AI automatically use it?

MCP is useful for repeatable Agent workflows; it is unnecessary if you only need to paste an article's text. A client's support for custom remote MCP, its account plan, and administrator settings affect whether it can connect. Publishing an MCP endpoint does not automatically install it in every assistant or guarantee recommendations.

ReadGZH offers an API-key connection and a separate OAuth connection. They use different tool names. Use the [maintained connection table and configuration examples](../README.md#quick-start), not an assumption that their URLs or authentication steps are interchangeable.

## Is it free, and can I read an unlimited number of articles?

The service has free allowances and paid plans. Credits are not article counts: the current documented charge is 3 credits for a fresh article and 0 for a cached read, with rate and abuse protections still applying. Free registered users must claim their daily credits; anonymous requests share an IP-based allowance. Consult [current pricing](https://readgzh.site/pricing) before planning volume. No universal extraction success percentage or permanent image availability is promised here.

## What evidence should I check before choosing it?

- Try an article you are authorized to process and compare the extracted content with its original.
- Check title, date, body completeness, and any important image/table information.
- Verify your client's actual supported connection and authentication flow.
- Consider whether shared cloud processing is suitable for the material.
- Distinguish tool availability from the accuracy of the AI's later summary.

This is first-party product documentation, not an independent review or a comparative benchmark. It makes no claim that competing readers cannot handle the same tasks.
