# OAuth MCP 读文计费链路核验（只读结论 + 待授权修复方案）

本轮只做代码只读核验，未编辑任何文件、未部署、未做任何扣款测试。

## 你的三点判断是否成立

1. **重复计费/双重扣费路径成立（但比预期轻）**
   - `src/lib/mcp/tools/read.ts`：先用 service role 调 `validate_api_key(p_key_hash, 3)` 扣 3 积分，然后带 **service-role Bearer** 调 `wechat-reader`。
   - `wechat-reader` 的 `checkApiKeyAuth` 只接受 `Authorization: Bearer sk_live_` 开头的请求头，service-role token 不匹配 → 返回 null → `checkRateLimit` 落到 **匿名 IP 限流**分支，`keyHash` 为 `undefined`。成立。
   - 但不会二次扣积分：匿名分支只查 `check_rate_limit`，不扣 credits。所以是「扣一次 + 走匿名配额」，不是扣两次。

2. **匿名限流会挡住新 MCP 抓新文章：成立，且这是最高风险项**
   - 函数间调用时 `x-forwarded-for` 若为空，`getClientIp` 返回 `unknown` → 直接放行（此时无限制）；若上游带了 IP，则整个新 MCP 共用同一个桶，`DAILY_LIMIT = 10`，约 3 篇新文章后所有 OAuth 用户一起被 429。行为取决于运行时是否透传 IP，属于不确定的隐性故障。

3. **失败不退款、未处理 `cached` / `creditCost`：成立**
   - `wechat-reader` 内部的 `refundCredits(keyHash, 3)` 只在 `keyHash` 存在时生效；新 MCP 传的是 service-role，`keyHash` 为空 → 抓取失败、视频文、微信验证拦截等场景全部**不退款**。
   - `read.ts` 只看 `scrape.success && scrape.articleId`，忽略响应里的 `cached: true` 与 `creditCost: 0`。
   - 你**遗漏的一层已有保护**：`read.ts` 在扣费前先用匿名客户端按 `source_url` 查过缓存；`wechat-reader` POST 路径在扣费前也再查一次 slug + source_url 缓存。所以常见的「已缓存文章」不会被扣费。真正会白扣 3 分的是：并发抓取被别人先写入（返回 `cached:true`）、以及抓取/保存失败这两类。另注意 `read.ts` 缓存预检按 `source_url` 精确匹配，带 UTM 参数的链接会漏掉缓存，落到扣费路径后才由 slug 命中。

## 线上与仓库是否一致

平台没有「读取线上函数源码」的只读能力，无法逐行 diff。可确认的是仓库里 `supabase/config.toml` 已把 `wechat-reader`、`mcp-server` 设为 `verify_jwt = false`，且这两个函数最近一次修改都已部署过。要在不扣款前提下做行为核验，可用只读探针：对**已缓存**文章调 `POST /functions/v1/wechat-reader`，观察是否返回 `X-Cache: HIT` 与 `creditCost: 0`（0 积分、不写数据）。需要你点头我才执行。

## 文档现状（只读确认）

- `public/llms.txt`：只写了 `POST https://api.readgzh.site/mcp-server` 与 `readgzh.*` 点号工具名，**没有** OAuth MCP 地址、`readgzh_*` 下划线工具名、也没有「首次抓取前需要有效 API Key」这条前置条件。
- `src/pages/DocsPage.tsx`：MCP 章节同样只有 API-key 接入（含 Cursor deeplink），**无** OAuth 接入说明。
- 二者都缺，且 README 已更新，出现文档不一致。

## 最小修复方案（待你明确授权后再做，当前不实施）

范围仅限 `src/lib/mcp/tools/read.ts`（外加可选的一个 `wechat-reader` 小改动）：

1. **抓取改用用户自己的 API Key 计费，而不是先扣再匿名调用**（首选）
   - 障碍：库里只存 `key_hash`（SHA-256），拿不到明文 `sk_live_`，所以无法直接把用户 Key 转发给 `wechat-reader`。
   - 因此实际最小改法是方案 2。
2. **保留现有「先扣后调」，但补齐失败与缓存回退**
   - `read.ts` 读取 `scrape.cached === true` 或 `creditCost === 0` 时，调用 `refund_credits(key_hash, 3)` 退还本次扣费。
   - `scrape.success !== true`（含 HTTP 非 2xx、超时、abort）时同样退款，再返回错误文案。
   - 给内部调用加一个显式标记（如请求头 `X-ReadGZH-Internal: mcp-oauth`），让 `wechat-reader` 跳过匿名 IP 限流分支，避免共享桶 429；`wechat-reader` 侧只在 service-role 授权成立时接受该标记。
3. **缓存预检对齐**：`read.ts` 先按 URL 中的 `s/xxx` slug 查一次缓存，再按 `source_url` 查，减少带参数链接的误扣。

## 需要的回归场景

1. 已缓存文章（普通链接）→ 0 积分、返回正文。
2. 已缓存文章 + 带 UTM 参数 → 0 积分（验证 slug 预检）。
3. 未缓存文章正常抓取 → 恰好扣 3 积分，余额减 3。
4. 并发两个客户端读同一篇未缓存文章 → 总共只净扣 3 分，后到者退款。
5. 抓取失败（已删除文章 / 视频文 / 微信验证拦截）→ 净扣 0 分。
6. 连续抓取 5 篇以上新文章 → 不出现 429 匿名限流。
7. 无有效 API Key 的 OAuth 用户 → 明确提示去控制台创建 Key，不扣分。
8. 积分不足 → 返回升级提示，且不触发抓取。
9. 旧 API-key MCP（`/mcp-server`）与 `/rd` 行为不回退。

## 授权确认

以上均未实施。请明确回复要不要动 `src/lib/mcp/tools/read.ts`（以及是否允许给 `wechat-reader` 加内部调用标记），我再执行；文档补 OAuth 接入说明也需要单独授权。
