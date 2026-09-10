import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";
import { errorText, listMarkdown, text } from "../format";

export default defineTool({
  name: "readgzh_search",
  title: "Search cached articles",
  description:
    "Search WeChat articles already cached by ReadGZH, by keyword in title or content (Chinese or English). Returns matching titles and slugs; read one with readgzh_get.",
  inputSchema: {
    query: z.string().describe("Search keyword"),
    limit: z.number().optional().describe("Maximum results, default 5, capped at 20"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    const keyword = String(query ?? "").trim().slice(0, 100);
    if (!keyword) return errorText("Missing search keyword.");
    const max = Math.min(Math.max(Number(limit) || 5, 1), 20);

    const { data, error } = await supabaseAnon().rpc("search_public_articles", {
      p_query: keyword,
      p_limit: max,
    });
    if (error) return errorText(`Search failed: ${error.message}`);

    const rows = ((data as { articles?: Array<Record<string, string>> } | null)?.articles ?? []) as Array<{
      title: string | null;
      author: string | null;
      slug: string | null;
    }>;
    if (rows.length === 0) return text(`No cached articles match "${keyword}".`);

    return text(listMarkdown(`Search results for "${keyword}"`, rows));
  },
});
