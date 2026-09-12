# 微信公众号文章怎么转 Markdown，再交给 AI？

已有公众号文章链接，希望提取正文给 AI、存成 `.md` 文件，或者放进自己的笔记，可以使用 ReadGZH 的 `format=text` 输出。这里的方向是“公众号文章 → Markdown 正文”，不是把 Markdown 排版后发布到公众号。

ReadGZH 是云端提取工具，负责提供文章内容；摘要、比较和事实判断由后续使用的 AI 与使用者完成。本文由 ReadGZH 项目维护，示例于 2026-09-12 验证。

## 只读一篇文章，需要配置 MCP 吗？

不需要。如果能直接复制所需文字，粘贴给 AI 就可以。需要从链接取得正文时，在 [ReadGZH 首页](https://readgzh.site/) 粘贴公开公众号链接并生成阅读页，再复制结果链接。持续集成到 Agent 时才需要考虑 [API / MCP 接入](https://readgzh.site/docs)。

## 已有 ReadGZH 阅读链接，如何取得 Markdown？

结果链接形如：

```text
https://api.readgzh.site/rd?s=文章标识
```

在后面添加 `&format=text`：

```text
https://api.readgzh.site/rd?s=文章标识&format=text
```

这里已有 `?s=...`，所以新增参数用 `&`，不要再加一个 `?`。浏览器显示文本后，可以复制保存为 UTF-8 编码的 `.md` 文件，再粘贴给 AI，或上传给支持文件读取的客户端。

### 一个可复核的输出例子

使用已缓存的公开文章 [GEO还没搞明白，同行已经在做AEO了](https://api.readgzh.site/rd?s=0oYf5WLZHdLpBoNUO1tePQ&format=text)，本次请求返回 HTTP 200。开头为：

```markdown
# GEO还没搞明白，同行已经在做AEO了

**作者：** 阿然的奇思妙想
**发布时间：** 2026-09-08 17:57
```

这是格式示例，不代表我们认可文章中的 AEO/GEO 结论，也不是提取成功率测试。该响应的 Content-Type 实测为 `text/plain; charset=utf-8`，正文使用 Markdown 语法；集成时不要仅因它不是 `text/markdown` 就判定失败。

## 开发者如何从原始微信链接取得正文？

使用 GET 请求，并让 HTTP 客户端编码原始 URL，避免微信链接中的 `&` 被误解析成 ReadGZH 参数：

```bash
curl --fail-with-body --get 'https://api.readgzh.site/rd' \
  --data-urlencode "url=$WECHAT_ARTICLE_URL" \
  --data-urlencode 'format=text' \
  --header "Authorization: Bearer $READGZH_API_KEY" \
  --output article.md
```

这是 Bash 示例：先在本地设置自己的 `WECHAT_ARTICLE_URL` 和 `READGZH_API_KEY` 环境变量。API Key 只放请求头，不放公开链接、笔记或截图。命令报错时应检查状态码与响应内容，不要把错误信息当作成功提取的文章。

已有缓存标识时，可以直接请求 `s` 与 `format=text`，无需重新提交原始链接。额度和认证以 [开发文档](https://readgzh.site/docs) 与 [定价页](https://readgzh.site/pricing) 为准；“积分”不等于“篇数”。

## 保存成功后，检查什么？

| 检查项 | 具体做法 |
| --- | --- |
| 是否是目标文章 | 对照标题、作者、日期，同时在笔记中保留原始微信链接 |
| 正文是否完整 | 对照原文开头、结尾及关键段落；长文出现分块提示时，按提示取得其余部分 |
| 图表是否包含关键证据 | 图片链接不等于图片内容已转成文字，图中文字和复杂表格需回原文检查 |
| 是否残留来源格式 | 实测样例中仍有来源标记，导入笔记前按需要清理，不保证输出完全无杂质 |
| AI 是否真的取得材料 | 先让它列出标题、收到的内容范围及原文短句；这只是核对手段，不是完整性的证明 |

可复制的阅读提示：

> 以下是文章正文和来源信息。先说明你实际收到的内容范围；若出现缺段、分块提示或仅有图片链接，请明确指出。只依据提供的正文总结，每个主要结论附一条可核对的原文短句。把作者观点、文中数据与你自己的推断分开；不要补写原文没有提供的信息。

## 能直接导入 Obsidian、Notion 或知识库吗？

可以把输出保存为 Markdown，再按目标工具支持的方式导入或粘贴。这是手动工作流，不代表 ReadGZH 提供这些产品的自动同步集成。图片、附件、标题层级与复杂表格的展示效果，需要在目标工具中检查。

处理多篇文章时，每篇保留独立文件与来源编号，再交给 AI 比较。不要先把不同文章拼成一个无来源的大段落。参见 [多文章比较流程](choosing-a-wechat-reader.md#how-do-i-compare-three-articles-without-mixing-up-their-claims)。

## 哪些情况不适合？

ReadGZH 使用云端处理与共享缓存，生成的文章页面公开可访问，不适合内部资料或不宜公开处理的内容。删除、受限或不支持的文章可能无法提取；Markdown 转换不能恢复无权访问的正文，也不能保证图片长期可用。请保留出处并遵守原作者的使用授权。

需要全量历史导出、持续订阅或全微信搜索时，应另选对应的授权工作流；ReadGZH 的缓存不是完整公众号数据库。
