import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Check if content indicates a verification/captcha page
function isVerificationPage(html: string): boolean {
  const patterns = [
    "环境异常",
    "完成验证",
    "去验证",
    "验证码",
    "请完成安全验证",
    "访问过于频繁",
  ];
  const lowerHtml = html.toLowerCase();
  return patterns.some((p) => lowerHtml.includes(p.toLowerCase()));
}

// Allowed tags for sanitization
const ALLOWED_TAGS = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s",
  "blockquote", "ul", "ol", "li",
  "img", "figure", "figcaption",
  "section", "div", "span",
  "table", "thead", "tbody", "tr", "th", "td",
  "a", "sup", "sub", "hr",
]);

// Clean and extract formatted HTML from WeChat content
function extractFormattedContent(html: string): { contentHtml: string; textContent: string } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return { contentHtml: "", textContent: "" };

  const contentEl = doc.querySelector("#js_content");
  if (!contentEl) return { contentHtml: "", textContent: "" };

  // Get inner HTML
  let contentHtml = (contentEl as Element).innerHTML || "";

  // Convert data-src to src for images (WeChat lazy loading)
  contentHtml = contentHtml.replace(/data-src="([^"]+)"/g, 'src="$1"');
  
  // Remove data-* attributes except src
  contentHtml = contentHtml.replace(/\s+data-\w+(?:-\w+)*="[^"]*"/g, "");

  // Remove script and style tags and their content
  contentHtml = contentHtml.replace(/<script[\s\S]*?<\/script>/gi, "");
  contentHtml = contentHtml.replace(/<style[\s\S]*?<\/style>/gi, "");
  contentHtml = contentHtml.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Remove onclick and other event handlers
  contentHtml = contentHtml.replace(/\s+on\w+="[^"]*"/g, "");

  // Remove WeChat-specific noise
  contentHtml = contentHtml.replace(/visibility:\s*hidden[^;]*;?/g, "");
  contentHtml = contentHtml.replace(/opacity:\s*0[^;]*;?/g, "");

  // Remove empty spans with only nbsp
  contentHtml = contentHtml.replace(/<span[^>]*>\s*(&nbsp;|\s)*\s*<\/span>/gi, "");

  // Remove excessive inline styles but keep basic ones
  // Keep: text-align, font-weight, font-style, color, font-size, line-height, margin, padding
  // This is a simplified cleanup - keep style attribute but strip dangerous values
  contentHtml = contentHtml.replace(/javascript:/gi, "");

  // Get plain text for AI consumption
  const textContent = (contentEl as Element).textContent?.trim() || "";

  return { contentHtml: contentHtml.trim(), textContent };
}

// Extract metadata from WeChat HTML
function extractMetadata(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return { title: "无标题", author: "公众号文章", publishTime: null };

  // Title
  let title = "";
  const titleEl = doc.querySelector("#activity-name");
  if (titleEl) title = (titleEl as Element).textContent?.trim() || "";
  if (!title) {
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle) title = (ogTitle as Element).getAttribute("content") || "";
  }
  if (!title) {
    const titleTag = doc.querySelector("title");
    if (titleTag) {
      title = (titleTag as Element).textContent?.trim() || "";
      title = title.replace(/\s*[-|_]\s*微信公众平台.*$/, "").trim();
    }
  }

  // Author
  let author = "";
  const authorEl = doc.querySelector("#js_name");
  if (authorEl) author = (authorEl as Element).textContent?.trim() || "";
  if (!author) {
    const ogAuthor = doc.querySelector('meta[property="og:article:author"]');
    if (ogAuthor) author = (ogAuthor as Element).getAttribute("content") || "";
  }

  // Publish time
  let publishTime = null;
  const pubTimeEl = doc.querySelector("#publish_time");
  if (pubTimeEl) publishTime = (pubTimeEl as Element).textContent?.trim() || null;

  return {
    title: title || "无标题",
    author: author || "公众号文章",
    publishTime,
  };
}

// Direct fetch with browser-like headers
async function tryDirectFetch(url: string): Promise<string | null> {
  console.log("Attempting direct fetch with browser headers");
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      console.log("Direct fetch failed:", response.status);
      return null;
    }

    const html = await response.text();
    console.log("Direct fetch HTML length:", html.length);
    return html;
  } catch (error) {
    console.error("Direct fetch error:", error);
    return null;
  }
}

// Firecrawl fallback
async function tryFirecrawl(url: string, apiKey: string): Promise<string | null> {
  console.log("Attempting Firecrawl fallback");
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["html"],
        onlyMainContent: false,
        waitFor: 8000,
        location: { country: "CN", languages: ["zh-CN", "zh"] },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Firecrawl error:", data);
      return null;
    }

    const html = data.data?.html || data.html || "";
    console.log("Firecrawl HTML length:", html.length);
    return html || null;
  } catch (error) {
    console.error("Firecrawl error:", error);
    return null;
  }
}

// ===== Article Read Mode: Return static HTML for AI bots =====
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatContentToHtml(text: string): string {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");
}

// Replace video iframes with accessible links for SSR output
function replaceVideoIframesForSsr(html: string, sourceUrl?: string | null): string {
  const proxyBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/image-proxy?url=`;
  let result = html.replace(
    /<iframe[^>]*class="video_iframe[^"]*"[^>]*>/gi,
    (match) => {
      // Extract cover image
      const coverMatch = match.match(/data-cover="([^"]*)"/);
      const coverUrl = coverMatch ? coverMatch[1].replace(/&amp;/g, "&") : null;
      const proxiedCover = coverUrl ? `${proxyBase}${encodeURIComponent(coverUrl)}` : null;
      const linkUrl = sourceUrl || "#";

      const coverHtml = proxiedCover
        ? `<div style="position:relative;background:#000;text-align:center;"><img src="${proxiedCover}" style="max-width:100%;opacity:0.85;" alt="视频封面"/><span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:3em;">▶️</span></div>`
        : `<div style="background:#000;padding:40px;text-align:center;"><span style="font-size:3em;">▶️</span></div>`;

      return `<div style="border:1px solid #ddd;border-radius:8px;overflow:hidden;margin:16px 0;">` +
        `<a href="${linkUrl}" target="_blank" rel="noopener" style="display:block;text-decoration:none;color:inherit;">` +
        coverHtml +
        `<div style="padding:12px 16px;background:#f9f9f9;">` +
        `<b>📹 点击查看原文播放视频</b>` +
        `</div></a></div>`;
    }
  );
  result = result.replace(/<\/iframe>/gi, "");
  result = result.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  return result;
}

// Proxy WeChat image URLs for SSR output
function proxyImagesForSsr(html: string): string {
  const proxyBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/image-proxy?url=`;
  return html.replace(
    /src="(https?:\/\/mmbiz\.qpic\.cn[^"]*)"/g,
    (_, url: string) => {
      const decoded = url.replace(/&amp;/g, "&");
      return `src="${proxyBase}${encodeURIComponent(decoded)}"`;
    }
  );
}

async function handleReadMode(slug: string | null, articleId: string | null): Promise<Response> {
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
    console.error("Article not found:", error);
    return new Response("Article not found.", {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Increment view count (fire and forget)
  supabase.rpc("increment_view_count", { article_id: article.id }).then(() => {});

  const publishInfo = article.publish_time ? `<p><strong>发布时间：</strong>${escapeHtml(article.publish_time)}</p>` : "";
  const sourceLink = article.source_url ? `<p><strong>原文链接：</strong><a href="${escapeHtml(article.source_url)}">${escapeHtml(article.source_url)}</a></p>` : "";

  // Use raw_html (with images) if available, otherwise fall back to plain text
  let contentBody: string;
  if (article.raw_html) {
    let sanitized = article.raw_html;
    sanitized = sanitized.replace(/data-src="([^"]+)"/g, 'src="$1"');
    sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, "");
    sanitized = sanitized.replace(/<style[\s\S]*?<\/style>/gi, "");
    sanitized = sanitized.replace(/\s+on\w+="[^"]*"/g, "");
    sanitized = sanitized.replace(/visibility:\s*hidden[^;]*;?/g, "");
    sanitized = sanitized.replace(/opacity:\s*0[^;]*;?/g, "");
    sanitized = proxyImagesForSsr(sanitized);
    sanitized = replaceVideoIframesForSsr(sanitized, article.source_url);
    contentBody = sanitized;
  } else {
    contentBody = formatContentToHtml(article.content);
  }

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
      ${contentBody}
    </div>
    <div class="footer">
      ${sourceLink}
      <p>由微信公众号 AI 阅读器提供</p>
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
}

// ===== Main Handler =====
console.log("wechat-reader function loaded");
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET request: check if this is a "read mode" request (?s= or ?id=)
    if (req.method === "GET") {
      const params = new URL(req.url).searchParams;
      const slug = params.get("s");
      const articleId = params.get("id");

      // If s= or id= param present, serve static HTML for AI bots
      if (slug || articleId) {
        console.log("Read mode: slug=", slug, "id=", articleId);
        return await handleReadMode(slug, articleId);
      }

      // Otherwise, treat as a scrape request with ?url= param
      const url = params.get("url");
      if (!url) {
        return new Response(
          JSON.stringify({ success: false, error: "请提供微信文章链接" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Fall through to scrape logic below with this url
      return await handleScrape(url);
    }

    // POST request: scrape or submit article
    if (req.method === "POST") {
      const body = await req.json();

      // Handle direct article submission (from bookmarklet)
      if (body.action === "submit") {
        return await handleDirectSubmit(body);
      }

      // Handle URL scraping
      const url = body.url;
      if (!url) {
        return new Response(
          JSON.stringify({ success: false, error: "请提供微信文章链接" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return await handleScrape(url);
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: `处理请求失败: ${error instanceof Error ? error.message : "未知错误"}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ===== Handle direct article submission (from bookmarklet) =====
async function handleDirectSubmit(body: Record<string, unknown>): Promise<Response> {
  const title = typeof body.title === "string" ? body.title.trim().substring(0, 500) : "";
  const content = typeof body.content === "string" ? body.content.trim().substring(0, 500000) : "";
  const author = typeof body.author === "string" ? body.author.trim().substring(0, 100) : "未知作者";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim().substring(0, 2000) : null;
  const publishTime = typeof body.publishTime === "string" ? body.publishTime.trim().substring(0, 100) : null;

  // Validate required fields
  if (!title || title.length < 1) {
    return new Response(
      JSON.stringify({ success: false, error: "文章标题不能为空" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!content || content.length < 10) {
    return new Response(
      JSON.stringify({ success: false, error: "文章内容过短或为空" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate sourceUrl format if provided
  if (sourceUrl && !sourceUrl.startsWith("http")) {
    return new Response(
      JSON.stringify({ success: false, error: "无效的来源链接" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Extract slug from source URL
  let slug: string | null = null;
  if (sourceUrl) {
    const slugMatch = sourceUrl.match(/\/(s\/[^?#]+)/);
    if (slugMatch) slug = slugMatch[1];
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check for duplicate by source URL or slug
  if (sourceUrl || slug) {
    let existing = null;
    if (slug) {
      const { data } = await supabase.from("articles").select("id").eq("slug", slug).maybeSingle();
      existing = data;
    }
    if (!existing && sourceUrl) {
      const { data } = await supabase.from("articles").select("id").eq("source_url", sourceUrl).maybeSingle();
      existing = data;
    }
    if (existing) {
      return new Response(
        JSON.stringify({ success: true, cached: true, articleId: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const { data: saved, error: dbError } = await supabase
    .from("articles")
    .insert({
      title,
      author: author || "未知作者",
      content,
      source_url: sourceUrl,
      publish_time: publishTime,
      slug,
    })
    .select("id")
    .single();

  if (dbError) {
    console.error("DB error:", dbError);
    return new Response(
      JSON.stringify({ success: false, error: "保存文章失败，请稍后重试" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, cached: false, articleId: saved.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleScrape(url: string): Promise<Response> {
    if (!url.includes("mp.weixin.qq.com") && !url.includes("weixin.qq.com")) {
      return new Response(
        JSON.stringify({ success: false, error: "请提供有效的微信公众号文章链接" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract slug from URL (e.g., "s/L3Tbd4KMmPnahnStnunTVA" from WeChat URL)
    let slug: string | null = null;
    const slugMatch = url.match(/\/(s\/[^?#]+)/);
    if (slugMatch) {
      slug = slugMatch[1];
    }

    // Check cache by slug first, then by URL
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let existing = null;
    if (slug) {
      const { data } = await supabase
        .from("articles")
        .select("id, slug")
        .eq("slug", slug)
        .maybeSingle();
      existing = data;
    }
    if (!existing) {
      const { data } = await supabase
        .from("articles")
        .select("id, slug")
        .eq("source_url", url)
        .maybeSingle();
      existing = data;
    }

    if (existing) {
      console.log("Cache hit:", existing.id);
      return new Response(
        JSON.stringify({ success: true, cached: true, articleId: existing.id, slug: existing.slug }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try scraping methods
    let html = await tryDirectFetch(url);

    if (!html || html.length < 500) {
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (firecrawlKey) {
        html = await tryFirecrawl(url, firecrawlKey);
      }
    }

    if (!html || html.length < 500) {
      return new Response(
        JSON.stringify({ success: false, error: "无法获取文章内容，请稍后重试" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for verification page
    if (isVerificationPage(html)) {
      return new Response(
        JSON.stringify({ success: false, error: "微信需要验证，暂时无法自动抓取此文章。请稍后重试。" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract metadata and content
    const metadata = extractMetadata(html);
    const { contentHtml, textContent } = extractFormattedContent(html);

    if (!textContent || textContent.length < 20) {
      return new Response(
        JSON.stringify({ success: false, error: "无法提取文章内容，文章可能已被删除或设置了访问限制。" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save to database - content stores plain text for AI, raw_html stores formatted HTML for display
    const { data: saved, error: dbError } = await supabase
      .from("articles")
      .insert({
        title: metadata.title.substring(0, 500),
        author: metadata.author,
        content: textContent,
        raw_html: contentHtml.substring(0, 500000),
        source_url: url,
        publish_time: metadata.publishTime,
        slug,
      })
      .select("id, slug")
      .single();

    if (dbError) {
      console.error("DB error:", dbError);
      return new Response(
        JSON.stringify({ success: false, error: "保存文章失败，请稍后重试" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Saved:", saved.id, saved.slug, metadata.title, "Text:", textContent.length, "HTML:", contentHtml.length);

    return new Response(
      JSON.stringify({ success: true, cached: false, articleId: saved.id, slug: saved.slug }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
}
