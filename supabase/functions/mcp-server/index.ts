import { Hono } from "npm:hono@4";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Create MCP server
const mcp = new McpServer({
  name: "readgzh",
  version: "1.3.0",
});

// Tool 1: Read a WeChat article by URL
mcp.tool("readgzh.read", {
  description:
    "Read and extract the full text content of a WeChat Official Account (微信公众号) article via ReadGZH (readgzh.site). Provide a WeChat article URL and get back the title, author, publish time, and full article text in Markdown format. The article will be automatically cached for future reads.",
  inputSchema: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description:
          "The full URL of the WeChat article, e.g. https://mp.weixin.qq.com/s/xxxx",
      },
    },
    required: ["url"],
  },
  handler: async (args: { url: string }) => {
    const { url } = args;
    console.log(`[MCP] read_wechat_article called with url: ${url}`);

    try {
      const scrapeResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/wechat-reader`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ url }),
        }
      );

      const scrapeResult = await scrapeResponse.json();

      if (!scrapeResult.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to read article: ${scrapeResult.error || "Unknown error"}${scrapeResult.hint ? `\n\nHint: ${scrapeResult.hint}` : ""}`,
            },
          ],
        };
      }

      const { data: article, error } = await supabase
        .from("articles")
        .select("title, author, content, publish_time, source_url, slug")
        .eq("id", scrapeResult.articleId)
        .single();

      if (error || !article) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Article was scraped but could not be retrieved from database.",
            },
          ],
        };
      }

      const parts: string[] = [];
      parts.push(`# ${article.title}`);
      parts.push("");
      if (article.author) parts.push(`**Author:** ${article.author}`);
      if (article.publish_time) parts.push(`**Published:** ${article.publish_time}`);
      if (article.source_url) parts.push(`**Original URL:** ${article.source_url}`);
      if (article.slug) parts.push(`**Readable Link:** https://readgzh.site/${article.slug}`);
      parts.push("");
      parts.push("---");
      parts.push("");
      parts.push(article.content);
      parts.push("");
      parts.push("---");
      parts.push("_Powered by [ReadGZH](https://readgzh.site) · [开发者文档](https://readgzh.site/docs) · [升级套餐](https://readgzh.site/pricing)_");
      parts.push("");
      parts.push("💡 免费注册获取每天 30 积分 · Lite ¥9/月 · Pro ¥39/月 → [readgzh.site/dashboard](https://readgzh.site/dashboard)");

      return {
        content: [{ type: "text" as const, text: parts.join("\n") }],
      };
    } catch (err) {
      console.error("[MCP] Error:", err);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error reading article: ${err instanceof Error ? err.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
});

// Tool 2: List recent articles
mcp.tool("readgzh.list", {
  description:
    "List recently cached WeChat articles via ReadGZH. Returns titles, authors, and links. Useful for browsing what articles have been previously read and cached.",
  inputSchema: {
    type: "object" as const,
    properties: {
      limit: {
        type: "number",
        description: "Number of articles to return (default 10, max 50)",
      },
    },
    required: [],
  },
  handler: async (args: { limit?: number }) => {
    const limit = Math.min(args.limit || 10, 50);

    try {
      const { data: articles, error } = await supabase
        .from("articles")
        .select("id, title, author, publish_time, slug, source_url, view_count, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Database error: ${error.message}` }],
        };
      }

      if (!articles || articles.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No cached articles found." }],
        };
      }

      const lines: string[] = [`# Recent Articles (${articles.length})\n`];
      articles.forEach((a, i) => {
        lines.push(`## ${i + 1}. ${a.title}`);
        if (a.author) lines.push(`- **Author:** ${a.author}`);
        if (a.publish_time) lines.push(`- **Published:** ${a.publish_time}`);
        lines.push(`- **Views:** ${a.view_count}`);
        if (a.slug) lines.push(`- **Link:** https://readgzh.site/${a.slug}`);
        lines.push("");
      });

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (err) {
      return {
        content: [
          { type: "text" as const, text: `Error: ${err instanceof Error ? err.message : "Unknown"}` },
        ],
      };
    }
  },
});

// Tool 3: Search articles by keyword
mcp.tool("readgzh.search", {
  description:
    "Search cached WeChat articles by keyword via ReadGZH. Searches in article titles and content. Returns matching articles with snippets.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Search keyword to find in article titles or content",
      },
      limit: {
        type: "number",
        description: "Max results to return (default 5, max 20)",
      },
    },
    required: ["query"],
  },
  handler: async (args: { query: string; limit?: number }) => {
    const { query } = args;
    const limit = Math.min(args.limit || 5, 20);

    try {
      // Search in title first
      const { data: articles, error } = await supabase
        .from("articles")
        .select("id, title, author, publish_time, slug, source_url")
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Search error: ${error.message}` }],
        };
      }

      if (!articles || articles.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No articles found matching "${query}".` }],
        };
      }

      const lines: string[] = [`# Search Results for "${query}" (${articles.length})\n`];
      articles.forEach((a, i) => {
        lines.push(`## ${i + 1}. ${a.title}`);
        if (a.author) lines.push(`- **Author:** ${a.author}`);
        if (a.slug) lines.push(`- **Link:** https://readgzh.site/${a.slug}`);
        if (a.slug) lines.push(`  Use \`readgzh.get\` with slug "${a.slug.replace(/^s\//, "")}" to read full content.`);
        lines.push("");
      });

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    } catch (err) {
      return {
        content: [
          { type: "text" as const, text: `Error: ${err instanceof Error ? err.message : "Unknown"}` },
        ],
      };
    }
  },
});

// Tool 4: Get article by slug
mcp.tool("readgzh.get", {
  description:
    "Get a cached WeChat article by its short slug/URL path via ReadGZH. Use when you have a slug like 'minicpm-o-4-5' from a previous read.",
  inputSchema: {
    type: "object" as const,
    properties: {
      slug: {
        type: "string",
        description: "The article slug, e.g. 'minicpm-o-4-5'",
      },
    },
    required: ["slug"],
  },
  handler: async (args: { slug: string }) => {
    try {
      const { data: article, error } = await supabase
        .from("articles")
        .select("title, author, content, publish_time, source_url, slug")
        .eq("slug", args.slug)
        .single();

      if (error || !article) {
        return {
          content: [{ type: "text" as const, text: `Article with slug "${args.slug}" not found.` }],
        };
      }

      const parts: string[] = [];
      parts.push(`# ${article.title}`);
      parts.push("");
      if (article.author) parts.push(`**Author:** ${article.author}`);
      if (article.publish_time) parts.push(`**Published:** ${article.publish_time}`);
      if (article.source_url) parts.push(`**Original URL:** ${article.source_url}`);
      parts.push(`**Readable Link:** https://readgzh.site/${article.slug}`);
      parts.push("");
      parts.push("---");
      parts.push("");
      parts.push(article.content);
      parts.push("");
      parts.push("---");
      parts.push("_Powered by [ReadGZH](https://readgzh.site) · [开发者文档](https://readgzh.site/docs) · [升级套餐](https://readgzh.site/pricing)_");
      parts.push("");
      parts.push("💡 免费注册获取每天 30 积分 · Lite ¥9/月 · Pro ¥39/月 → [readgzh.site/dashboard](https://readgzh.site/dashboard)");

      return {
        content: [{ type: "text" as const, text: parts.join("\n") }],
      };
    } catch (err) {
      return {
        content: [
          { type: "text" as const, text: `Error: ${err instanceof Error ? err.message : "Unknown"}` },
        ],
      };
    }
  },
});

// Bind MCP server to HTTP transport
const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);

// Anonymous MCP shares the same IP pool as Web anon (10/IP/day) to prevent abuse.
// Authenticated MCP (via API Key in Authorization header) bypasses IP rate limiting
// and uses the user's credit balance instead — handled by wechat-reader downstream.
const MCP_ANON_DAILY_LIMIT = 10;

async function checkMcpRateLimit(ip: string): Promise<{ allowed: boolean; current: number }> {
  try {
    // Use the SAME key as Web anon (no prefix) so MCP and Web share the IP quota.
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_ip: ip,
      p_daily_limit: MCP_ANON_DAILY_LIMIT,
    });
    if (error) return { allowed: true, current: 0 };
    const result = data as { allowed: boolean; current: number };
    return result;
  } catch {
    return { allowed: true, current: 0 };
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * Detect whether this MCP request carries a valid user-issued API Key.
 * Anonymous MCP traffic (no key, or only the anon/service key) is rate-limited.
 * The default Authorization header injected by MCP clients usually contains
 * the public anon key — we treat that as anonymous.
 */
function hasUserApiKey(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const token = auth.slice(7).trim();
  if (!token) return false;
  // Public/anon keys and service role JWTs start with "eyJ" (JWT). User API keys
  // issued by ReadGZH use a different format (e.g. "sk_live_..."). Reject JWTs.
  if (token.startsWith("eyJ")) return false;
  return true;
}

const app = new Hono();

app.all("/*", async (c) => {
  console.log(`[MCP] ${c.req.method} ${c.req.url}`);

  // Rate limit anonymous MCP requests; authenticated requests bypass IP limit.
  if (c.req.method === "POST" && !hasUserApiKey(c.req.raw)) {
    const ip = getClientIp(c.req.raw);
    if (ip !== "unknown") {
      const rateCheck = await checkMcpRateLimit(ip);
      if (!rateCheck.allowed) {
        console.log(`[MCP] Anon rate limit exceeded for IP: ${ip}, current: ${rateCheck.current}`);
        return c.json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: `Anonymous MCP limit reached (${MCP_ANON_DAILY_LIMIT}/IP/day). If you are calling from shared infrastructure (Replit, Vercel, Cloudflare Workers, etc.), the IP quota may already be exhausted by other users — use an API Key in the Authorization header (Bearer sk_live_...) to bypass IP limits. Get a free key at https://readgzh.site/dashboard.`,
            data: {
              dashboard_url: "https://readgzh.site/dashboard",
              retry_after_seconds: 86400,
            },
          },
          id: null,
        }, 429, { "Retry-After": "86400" });
      }
    }
  }

  const response = await httpHandler(c.req.raw);
  return response;
});

Deno.serve(app.fetch);
