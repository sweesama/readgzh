import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon, supabaseForUser, supabaseService, supabaseProjectUrl } from "../supabase";
import { articleMarkdown, errorText, text, type ArticleRow } from "../format";

const ARTICLE_FIELDS = "title, author, content, publish_time, source_url, slug";
const CREDIT_COST = 3;

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!/(^|\.)weixin\.qq\.com$/.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export default defineTool({
  name: "readgzh_read",
  title: "Read WeChat article",
  description:
    "Read the full text of a WeChat Official Account (微信公众号) article from its mp.weixin.qq.com URL. Returns title, author, publish time and clean Markdown content. Cached articles are free; a fresh extraction costs 3 credits from the signed-in user's ReadGZH balance.",
  inputSchema: {
    url: z.string().describe("Full WeChat article URL, e.g. https://mp.weixin.qq.com/s/xxxx"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  handler: async ({ url }, ctx) => {
    if (!ctx.isAuthenticated()) return errorText("Not authenticated. Reconnect the ReadGZH MCP server and sign in.");

    const target = normalizeUrl(url);
    if (!target) return errorText("Only mp.weixin.qq.com article links are supported.");

    const anon = supabaseAnon();
    const { data: cached } = await anon
      .from("articles")
      .select(ARTICLE_FIELDS)
      .eq("source_url", target)
      .maybeSingle();

    if (cached) return text(articleMarkdown(cached as ArticleRow, "cached — 0 credits"));

    // Not cached: charge the signed-in user's own ReadGZH API key balance.
    const { data: keys, error: keyError } = await supabaseForUser(ctx)
      .from("api_keys")
      .select("key_hash, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1);

    if (keyError) return errorText(`Could not load your ReadGZH account: ${keyError.message}`);
    if (!keys || keys.length === 0) {
      return errorText(
        "No active ReadGZH API key on this account. Create one (free, 30 credits/day) at https://readgzh.site/dashboard, then retry.",
      );
    }

    const service = supabaseService();
    const { data: quota, error: quotaError } = await service.rpc("validate_api_key", {
      p_key_hash: keys[0].key_hash,
      p_credit_cost: CREDIT_COST,
    });
    if (quotaError) return errorText(`Credit check failed: ${quotaError.message}`);

    const result = quota as { valid?: boolean; allowed?: boolean; remaining?: number } | null;
    if (!result?.valid) return errorText("Your ReadGZH API key is not valid or has been disabled.");
    if (!result.allowed) {
      return errorText(
        "Out of credits for today. Claim your daily free credits or upgrade at https://readgzh.site/pricing.",
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    let scrape: { success?: boolean; articleId?: string; error?: string; hint?: string };
    try {
      const response = await fetch(`${supabaseProjectUrl()}/functions/v1/wechat-reader`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
        },
        body: JSON.stringify({ url: target }),
        signal: controller.signal,
      });
      scrape = await response.json();
    } catch (err) {
      return errorText(
        `Extraction timed out or failed: ${err instanceof Error ? err.message : "unknown error"}. Please retry.`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!scrape?.success || !scrape.articleId) {
      return errorText(`Failed to read article: ${scrape?.error ?? "unknown error"}${scrape?.hint ? `\n${scrape.hint}` : ""}`);
    }

    const { data: article, error } = await anon
      .from("articles")
      .select(ARTICLE_FIELDS)
      .eq("id", scrape.articleId)
      .maybeSingle();

    if (error || !article) return errorText("Article was extracted but could not be loaded back. Please retry.");

    const remaining = typeof result.remaining === "number" ? `${CREDIT_COST} credits used, ${result.remaining} remaining` : undefined;
    return text(articleMarkdown(article as ArticleRow, remaining));
  },
});
