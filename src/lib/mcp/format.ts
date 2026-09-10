export type ArticleRow = {
  title: string | null;
  author: string | null;
  content: string | null;
  publish_time: string | null;
  source_url: string | null;
  slug: string | null;
};

export const FOOTER =
  "_Powered by [ReadGZH](https://readgzh.site) · [开发者文档](https://readgzh.site/docs)_";

export function bareSlug(slug: string | null | undefined): string {
  return String(slug ?? "").replace(/^s\//, "");
}

export function articleMarkdown(article: ArticleRow, note?: string): string {
  const parts: string[] = [`# ${article.title ?? "Untitled"}`, ""];
  if (article.author) parts.push(`**Author:** ${article.author}`);
  if (article.publish_time) parts.push(`**Published:** ${article.publish_time}`);
  if (article.source_url) parts.push(`**Original URL:** ${article.source_url}`);
  if (article.slug) parts.push(`**Readable link:** https://readgzh.site/${article.slug}`);
  if (note) parts.push(`**Note:** ${note}`);
  parts.push("", "---", "", article.content ?? "", "", "---", FOOTER);
  return parts.join("\n");
}

export function listMarkdown(
  heading: string,
  rows: Array<{ title: string | null; author?: string | null; publish_time?: string | null; slug: string | null }>,
): string {
  const lines: string[] = [`# ${heading} (${rows.length})`, ""];
  rows.forEach((row, index) => {
    lines.push(`## ${index + 1}. ${row.title ?? "Untitled"}`);
    if (row.author) lines.push(`- **Author:** ${row.author}`);
    if (row.publish_time) lines.push(`- **Published:** ${row.publish_time}`);
    if (row.slug) {
      lines.push(`- **Link:** https://readgzh.site/${row.slug}`);
      lines.push(`- **Read it:** call \`readgzh_get\` with slug "${bareSlug(row.slug)}"`);
    }
    lines.push("");
  });
  lines.push(FOOTER);
  return lines.join("\n");
}

export function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}

export function errorText(value: string) {
  return { content: [{ type: "text" as const, text: value }], isError: true };
}
