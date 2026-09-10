import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";
import { articleMarkdown, errorText, text, type ArticleRow } from "../format";

const CHUNK = 40_000;

export default defineTool({
  name: "readgzh_get",
  title: "Get cached article by slug",
  description:
    "Read a cached WeChat article by its ReadGZH slug. Long articles are chunked at ~40,000 characters; pass part to page through them. Always free — no credits.",
  inputSchema: {
    slug: z.string().describe("Article slug, e.g. the value after /s/ in a ReadGZH link"),
    part: z.number().optional().describe("Chunk number starting at 1 for long articles"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug, part }) => {
    const raw = String(slug ?? "").trim();
    if (!raw) return errorText("Missing slug.");
    const bare = raw.replace(/^s\//, "");

    const anon = supabaseAnon();
    const { data, error } = await anon
      .from("articles")
      .select("title, author, content, publish_time, source_url, slug")
      .or(`slug.eq.${bare},slug.eq.s/${bare}`)
      .limit(1)
      .maybeSingle();

    if (error) return errorText(`Lookup failed: ${error.message}`);
    if (!data) return errorText(`No cached article with slug "${bare}". Try readgzh_search first.`);

    const article = data as ArticleRow;
    const content = article.content ?? "";
    const total = Math.max(1, Math.ceil(content.length / CHUNK));
    const index = Math.min(Math.max(Number(part) || 1, 1), total);

    if (total === 1) return text(articleMarkdown(article));

    const chunk = content.slice((index - 1) * CHUNK, index * CHUNK);
    const note = `part ${index} of ${total}${index < total ? ` — call readgzh_get again with part: ${index + 1}` : ""}`;
    return text(articleMarkdown({ ...article, content: chunk }, note));
  },
});
