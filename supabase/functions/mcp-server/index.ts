import { Hono } from "npm:hono@4";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Create MCP server
const mcp = new McpServer({
  name: "wechat-reader",
  version: "1.0.0",
});

// Tool: Read a WeChat article by URL
mcp.tool("read_wechat_article", {
  description:
    "Read and extract the full text content of a WeChat Official Account (微信公众号) article. Provide a WeChat article URL and get back the title, author, publish time, and full article text. The article will be cached for future reads.",
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
      // Call the existing wechat-reader edge function to scrape/cache the article
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
      console.log("[MCP] Scrape result:", JSON.stringify(scrapeResult));

      if (!scrapeResult.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to read article: ${scrapeResult.error || "Unknown error"}`,
            },
          ],
        };
      }

      // Fetch the full article from the database
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: article, error } = await supabase
        .from("articles")
        .select("title, author, content, publish_time, source_url, slug")
        .eq("id", scrapeResult.articleId)
        .single();

      if (error || !article) {
        console.error("[MCP] DB fetch error:", error);
        return {
          content: [
            {
              type: "text" as const,
              text: "Article was scraped but could not be retrieved from database.",
            },
          ],
        };
      }

      // Format a readable response for the AI
      const parts: string[] = [];
      parts.push(`# ${article.title}`);
      parts.push("");
      if (article.author) parts.push(`**Author:** ${article.author}`);
      if (article.publish_time)
        parts.push(`**Published:** ${article.publish_time}`);
      if (article.source_url)
        parts.push(`**Source:** ${article.source_url}`);
      parts.push("");
      parts.push("---");
      parts.push("");
      parts.push(article.content);

      return {
        content: [
          {
            type: "text" as const,
            text: parts.join("\n"),
          },
        ],
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

// Bind MCP server to HTTP transport
const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);

// Hono app
const app = new Hono();

app.all("/*", async (c) => {
  console.log(`[MCP] ${c.req.method} ${c.req.url}`);
  const response = await httpHandler(c.req.raw);
  return response;
});

Deno.serve(app.fetch);
