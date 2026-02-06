import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("s");
    const articleId = url.searchParams.get("id");

    if (!slug && !articleId) {
      return new Response("Missing article identifier. Use ?s=slug or ?id=uuid", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase.from("articles").select("*");
    if (slug) {
      query = query.eq("slug", `s/${slug}`);
    } else if (articleId) {
      query = query.eq("id", articleId);
    }

    const { data: article, error } = await query.single();

    if (error || !article) {
      return new Response("Article not found.", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // Increment view count (fire and forget)
    supabase.rpc("increment_view_count", { article_id: article.id }).then(() => {});

    // Build a clean, simple HTML page that AI can read without JavaScript
    const publishInfo = article.publish_time ? `<p><strong>发布时间：</strong>${escapeHtml(article.publish_time)}</p>` : "";
    const sourceLink = article.source_url ? `<p><strong>原文链接：</strong><a href="${escapeHtml(article.source_url)}">${escapeHtml(article.source_url)}</a></p>` : "";

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(article.title)}</title>
  <meta name="description" content="${escapeHtml(article.content.substring(0, 160))}">
  <meta name="author" content="${escapeHtml(article.author || '公众号文章')}">
  <meta property="og:title" content="${escapeHtml(article.title)}">
  <meta property="og:description" content="${escapeHtml(article.content.substring(0, 200))}">
  <meta property="og:type" content="article">
  <style>
    body { max-width: 800px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.8; color: #333; }
    h1 { font-size: 1.8em; margin-bottom: 0.5em; }
    .meta { color: #666; margin-bottom: 2em; border-bottom: 1px solid #eee; padding-bottom: 1em; }
    .meta p { margin: 0.3em 0; }
    .content { font-size: 1.05em; }
    .content img { max-width: 100%; height: auto; }
    .footer { margin-top: 3em; padding-top: 1em; border-top: 1px solid #eee; color: #999; font-size: 0.9em; }
    a { color: #1a73e8; }
  </style>
</head>
<body>
  <article>
    <h1>${escapeHtml(article.title)}</h1>
    <div class="meta">
      <p><strong>作者：</strong>${escapeHtml(article.author || '未知作者')}</p>
      ${publishInfo}
    </div>
    <div class="content">
      ${formatContent(article.content)}
    </div>
    <div class="footer">
      ${sourceLink}
      <p>由微信公众号 AI 阅读器提供 · 本页面专为 AI 助手优化</p>
    </div>
  </article>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("read function error:", err);
    return new Response("Internal server error", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatContent(text: string): string {
  // Convert plain text content to HTML paragraphs
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");
}
