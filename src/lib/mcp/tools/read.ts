import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon, supabaseForUser, supabaseService, supabaseProjectUrl } from "../supabase";
import { articleMarkdown, errorText, text, type ArticleRow } from "../format";

const ARTICLE_FIELDS = "title, author, content, publish_time, source_url, slug";
const CREDIT_COST = 3;

function serviceRoleKey(): string {
  return (
    (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    ) ?? ""
  );
}

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!/(^|\.)weixin\.qq\.com$/.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** WeChat article slug, e.g. "s/AbCdEf" — stable across UTM/query variations. */
function slugFromUrl(target: string): string | null {
  const match = target.match(/\/(s\/[^?#]+)/);
  return match ? match[1] : null;
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

    // Cache pre-check: by slug first (survives UTM/query differences), then by exact URL.
    const slug = slugFromUrl(target);
    let cached: unknown = null;
    if (slug) {
      const { data } = await anon.from("articles").select(ARTICLE_FIELDS).eq("slug", slug).maybeSingle();
      cached = data;
    }
    if (!cached) {
      const { data } = await anon.from("articles").select(ARTICLE_FIELDS).eq("source_url", target).maybeSingle();
      cached = data;
    }

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

    const keyHash = keys[0].key_hash as string;
    const service = supabaseService();
    const { data: quota, error: quotaError } = await service.rpc("validate_api_key", {
      p_key_hash: keyHash,
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

    // Best-effort refund so a failed or racing extraction never costs credits.
    const refund = async () => {
      const { error } = await service.rpc("refund_credits", { p_key_hash: keyHash, p_amount: CREDIT_COST });
      if (error) console.error("[readgzh_read] refund failed:", error.message);
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    let scrape: { success?: boolean; articleId?: string; cached?: boolean; creditCost?: number; error?: string; hint?: string };
    try {
      const response = await fetch(`${supabaseProjectUrl()}/functions/v1/wechat-reader`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey()}`,
          "X-ReadGZH-Internal": "mcp-oauth",
        },
        body: JSON.stringify({ url: target }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        await refund();
        return errorText(`Failed to read article (HTTP ${response.status}). No credits were charged.${detail ? `\n${detail.slice(0, 500)}` : ""}`);
      }
      scrape = await response.json();
    } catch (err) {
      await refund();
      return errorText(
        `Extraction timed out or failed: ${err instanceof Error ? err.message : "unknown error"}. No credits were charged. Please retry.`,
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!scrape?.success || !scrape.articleId) {
      await refund();
      return errorText(
        `Failed to read article: ${scrape?.error ?? "unknown error"}. No credits were charged.${scrape?.hint ? `\n${scrape.hint}` : ""}`,
      );
    }

    // Another reader cached the same article first (or the backend served a cache
    // hit): the read was free, so give the 3 credits back.
    const wasFree = scrape.cached === true || scrape.creditCost === 0;
    if (wasFree) await refund();

    const { data: article, error } = await anon
      .from("articles")
      .select(ARTICLE_FIELDS)
      .eq("id", scrape.articleId)
      .maybeSingle();

    if (error || !article) {
      if (!wasFree) await refund();
      return errorText("Article was extracted but could not be loaded back. No credits were charged. Please retry.");
    }

    const note = wasFree
      ? "cached — 0 credits"
      : typeof result.remaining === "number"
        ? `${CREDIT_COST} credits used, ${result.remaining} remaining`
        : undefined;
    return text(articleMarkdown(article as ArticleRow, note));
  },
});
