import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";
import { errorText, listMarkdown, text } from "../format";

export default defineTool({
  name: "readgzh_list_by_account",
  title: "List cached articles by account",
  description:
    "List cached WeChat articles from one Official Account (公众号), newest first. Only covers articles already cached by ReadGZH — WeChat has no public archive API, so the result is never exhaustive; say so when presenting it.",
  inputSchema: {
    account: z.string().describe("Official Account name (author); partial match supported"),
    limit: z.number().optional().describe("Number of articles, default 10, capped at 50"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ account, limit }) => {
    const name = String(account ?? "").trim().slice(0, 100).replace(/[%_,]/g, "");
    if (!name) return errorText("Missing account name.");
    const max = Math.min(Math.max(Number(limit) || 10, 1), 50);

    const { data, error } = await supabaseAnon()
      .from("articles")
      .select("title, author, publish_time, slug")
      .ilike("author", `%${name}%`)
      .order("publish_time", { ascending: false, nullsFirst: false })
      .limit(max);

    if (error) return errorText(`Could not list articles: ${error.message}`);
    if (!data || data.length === 0) {
      return text(
        `No cached articles found for "${account}". ReadGZH only indexes articles that were read at least once through the service.`,
      );
    }
    return text(
      `${listMarkdown(`Cached articles from "${account}"`, data)}\n\n_Cached articles only — not the account's full archive._`,
    );
  },
});
