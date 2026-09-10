import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";
import { errorText, listMarkdown, text } from "../format";

export default defineTool({
  name: "readgzh_list",
  title: "List recent cached articles",
  description: "List the most recently cached WeChat articles on ReadGZH, newest first. Useful for browsing.",
  inputSchema: {
    limit: z.number().optional().describe("Number of articles, default 10, capped at 50"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }) => {
    const max = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const { data, error } = await supabaseAnon()
      .from("articles")
      .select("title, author, publish_time, slug")
      .order("created_at", { ascending: false })
      .limit(max);

    if (error) return errorText(`Could not list articles: ${error.message}`);
    if (!data || data.length === 0) return text("No cached articles found.");
    return text(listMarkdown("Recently cached articles", data));
  },
});
