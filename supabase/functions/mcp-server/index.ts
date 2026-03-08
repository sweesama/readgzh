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
      parts.push("_Powered by [ReadGZH](https://readgzh.site) · [开发者文档](https://readgzh.site/docs)_");

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
mcp.tool("list_recent_articles", {
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
mcp.tool("search_articles", {
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
        .select("id, title, author, content, publish_time, slug, source_url")
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
        
        // Extract a snippet around the keyword
        const contentLower = a.content.toLowerCase();
        const idx = contentLower.indexOf(query.toLowerCase());
        if (idx !== -1) {
          const start = Math.max(0, idx - 50);
          const end = Math.min(a.content.length, idx + query.length + 100);
          const snippet = (start > 0 ? "..." : "") + a.content.slice(start, end).replace(/\n/g, " ") + (end < a.content.length ? "..." : "");
          lines.push(`- **Snippet:** ${snippet}`);
        }
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
mcp.tool("get_article_by_slug", {
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
      parts.push("_Powered by [ReadGZH](https://readgzh.site) · [开发者文档](https://readgzh.site/docs)_");

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

const app = new Hono();

app.all("/*", async (c) => {
  console.log(`[MCP] ${c.req.method} ${c.req.url}`);
  const response = await httpHandler(c.req.raw);
  return response;
});

Deno.serve(app.fetch);
