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

// Check if WeChat returned an error page (deleted/invalid article)
function isWeChatErrorPage(html: string): string | null {
  // These patterns indicate actual error *content* displayed to the user,
  // NOT template CSS class names that appear in every WeChat page.
  const errorPatterns: [string, string][] = [
    ["该内容已被发布者删除", "该文章已被发布者删除。"],
    ["此内容因违规无法查看", "该文章因违规已被微信删除。"],
    ["此内容被投诉且经审核涉嫌侵权", "该文章因侵权投诉已被删除。"],
    ["该公众号已被封禁", "该公众号已被封禁，文章不可访问。"],
    ["此帐号已被屏蔽", "该帐号已被屏蔽，文章不可访问。"],
    ["page_rumor", "该文章已被标记为不实信息。"],
  ];
  for (const [pattern, message] of errorPatterns) {
    if (html.includes(pattern)) return message;
  }

  // Check for WeChat's actual error page structure (not just CSS class presence).
  // The error page has a very short body with "weui-icon-warn" prominently displayed
  // and no #js_content element. Normal articles always have #js_content.
  if (!html.includes('id="js_content"') && !html.includes("picture_page_info_list")) {
    // No article content container at all — likely an error or non-article page
    if (html.includes("weui-msg") || html.includes("Parameter error")) {
      return "微信返回了错误页面，文章可能已被删除或链接无效。";
    }
  }

  return null;
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

// ===== Picture Template (小绿书) Support =====
// Detect and extract content from WeChat picture/album posts
// These posts have no #js_content; data lives in window.picture_page_info_list and og:description

function isPictureTemplate(html: string): boolean {
  return html.includes("picture_page_info_list") && !html.includes('id="js_content"');
}

interface PicturePageInfo {
  cdn_url: string;
  width: number;
  height: number;
}

function extractPictureTemplate(html: string): { contentHtml: string; textContent: string; images: PicturePageInfo[] } | null {
  if (!isPictureTemplate(html)) return null;

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return null;

  // Extract text from og:description (contains the full text with \x0a linebreaks)
  const ogDesc = doc.querySelector('meta[property="og:description"]');
  let textContent = "";
  if (ogDesc) {
    textContent = (ogDesc as Element).getAttribute("content") || "";
    // Decode \x0a to newlines, \x26amp; to &
    textContent = textContent
      .replace(/\\x0a/g, "\n")
      .replace(/\\x26amp;/g, "&")
      .replace(/\\x26/g, "&")
      .replace(/&nbsp;/g, " ")
      .trim();
  }

  // Extract picture list from window.picture_page_info_list
  // Only grab top-level entries (not watermark_info or share_cover sub-objects)
  const images: PicturePageInfo[] = [];
  const listMatch = html.match(/window\.picture_page_info_list\s*=\s*\[([\s\S]*?)\];\s*\n/);
  if (listMatch) {
    // Split by top-level object boundaries: each main image starts with "{\n      width:"
    const entries = listMatch[1].split(/\},\s*\n\s*\{/);
    for (const entry of entries) {
      // Only grab the FIRST cdn_url and width/height in each entry (the main image)
      const cdnMatch = entry.match(/^\s*(?:\{)?\s*\n?\s*width:\s*'(\d+)'[\s\S]*?height:\s*'(\d+)'[\s\S]*?cdn_url:\s*'([^']+)'/);
      if (!cdnMatch) {
        // Try alternate order: cdn_url before width/height
        const altMatch = entry.match(/^\s*(?:\{)?\s*\n?\s*cdn_url:\s*'([^']+)'[\s\S]*?width:\s*'(\d+)'[\s\S]*?height:\s*'(\d+)'/);
        if (altMatch) {
          images.push({
            cdn_url: altMatch[1].replace(/\\x26amp;/g, "&").replace(/\\x26/g, "&"),
            width: parseInt(altMatch[2]),
            height: parseInt(altMatch[3]),
          });
        }
      } else {
        images.push({
          cdn_url: cdnMatch[3].replace(/\\x26amp;/g, "&").replace(/\\x26/g, "&"),
          width: parseInt(cdnMatch[1]),
          height: parseInt(cdnMatch[2]),
        });
      }
    }
  }

  if (!textContent && images.length === 0) return null;

  // Build HTML content with images and text
  const proxyBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/image-proxy?url=`;
  const imgHtml = images
    .map((img) => {
      const proxied = `${proxyBase}${encodeURIComponent(img.cdn_url)}`;
      return `<figure><img src="${proxied}" width="${img.width}" height="${img.height}" alt="图片" style="max-width:100%;height:auto;" /></figure>`;
    })
    .join("\n");

  const textHtml = textContent
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `<p>${l}</p>`)
    .join("\n");

  const contentHtml = imgHtml + (textHtml ? `\n<div class="picture-text">${textHtml}</div>` : "");

  return { contentHtml, textContent, images };
}

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

// Firecrawl fallback - returns { html, markdown } for maximum extraction
async function tryFirecrawl(url: string, apiKey: string): Promise<{ html: string | null; markdown: string | null }> {
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
        formats: ["html", "markdown"],
        onlyMainContent: true,
        waitFor: 15000,
        location: { country: "CN", languages: ["zh-CN", "zh"] },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Firecrawl error:", data);
      return { html: null, markdown: null };
    }

    const html = data.data?.html || data.html || "";
    const markdown = data.data?.markdown || data.markdown || "";
    console.log("Firecrawl HTML length:", html.length, "Markdown length:", markdown.length);
    return { html: html || null, markdown: markdown || null };
  } catch (error) {
    console.error("Firecrawl error:", error);
    return { html: null, markdown: null };
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

      if (proxiedCover) {
        return `<div style="border:1px solid #ddd;border-radius:8px;overflow:hidden;margin:16px 0;">` +
          `<a href="${linkUrl}" target="_blank" rel="noopener" style="display:block;text-decoration:none;color:inherit;">` +
          `<div style="position:relative;background:#000;text-align:center;"><img src="${proxiedCover}" style="max-width:100%;opacity:0.85;" alt="视频封面"/><span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:3em;">▶️</span></div>` +
          `<div style="padding:10px 16px;background:#f9f9f9;font-size:0.9em;">📹 点击查看原文播放视频</div>` +
          `</a></div>`;
      }
      // No cover: compact inline link
      return `<div style="margin:12px 0;padding:10px 16px;border:1px solid #ddd;border-radius:8px;background:#f9f9f9;display:flex;align-items:center;gap:8px;">` +
        `<span>📹</span>` +
        `<a href="${linkUrl}" target="_blank" rel="noopener"><b>点击查看原文播放视频 →</b></a>` +
        `</div>`;
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
    // Strip ALL inline style attributes – AI doesn't need styling
    sanitized = sanitized.replace(/\s*style="[^"]*"/gi, "");
    sanitized = sanitized.replace(/\s*style='[^']*'/gi, "");
    // Remove class attributes
    sanitized = sanitized.replace(/\s*class="[^"]*"/gi, "");
    sanitized = sanitized.replace(/\s*class='[^']*'/gi, "");
    // Remove all data-* and id attributes (zero value for AI)
    sanitized = sanitized.replace(/\s*data-[\w-]+="[^"]*"/gi, "");
    sanitized = sanitized.replace(/\s*id="[^"]*"/gi, "");
    // Remove WeChat custom tags (mp-common-profile, mp-style-type, etc.)
    sanitized = sanitized.replace(/<mp-[\w-]+[^>]*>[\s\S]*?<\/mp-[\w-]+>/gi, "");
    sanitized = sanitized.replace(/<mp-[\w-]+[^>]*\/>/gi, "");
    // Replace <br> with real newlines – saves tokens, easier for AI to parse
    sanitized = sanitized.replace(/<br\s*\/?>/gi, "\n");
    // Collapse &nbsp; to regular spaces
    sanitized = sanitized.replace(/&nbsp;/gi, " ");
    // Remove empty tags and deeply nested empty wrappers (run multiple passes)
    for (let i = 0; i < 3; i++) {
      sanitized = sanitized.replace(/<(div|span|section|p)>\s*<\/\1>/gi, "");
    }
    // Collapse excessive whitespace/newlines
    sanitized = sanitized.replace(/\n{3,}/g, "\n\n");
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

// ===== Rate Limiting =====
function getClientIp(req: Request): string {
  // Check common proxy headers
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

const DAILY_LIMIT = 100;

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function checkApiKeyAuth(req: Request): Promise<{
  isApiKey: boolean;
  allowed: boolean;
  current: number;
  remaining: number;
  limit: number;
  tier?: string;
  keyHash?: string;
} | null> {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer sk_live_")) return null;

  const apiKey = authHeader.replace("Bearer ", "");
  const keyHash = await hashApiKey(apiKey);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabase.rpc("validate_api_key", { p_key_hash: keyHash });
    if (error) {
      console.error("API key validation error:", error);
      return { isApiKey: true, allowed: false, current: 0, remaining: 0, limit: 0 };
    }
    const result = data as { valid: boolean; allowed: boolean; current: number; limit: number; remaining: number; tier?: string };
    if (!result.valid) {
      return { isApiKey: true, allowed: false, current: 0, remaining: 0, limit: 0 };
    }
    return {
      isApiKey: true,
      allowed: result.allowed,
      current: result.current,
      remaining: result.remaining,
      limit: result.limit,
      tier: result.tier,
      keyHash,
    };
  } catch (err) {
    console.error("API key auth error:", err);
    return { isApiKey: true, allowed: false, current: 0, remaining: 0, limit: 0 };
  }
}

async function checkRateLimit(req: Request): Promise<{ allowed: boolean; current: number; remaining: number; limit: number; isApiKey?: boolean; tier?: string; keyHash?: string } | null> {
  const apiKeyResult = await checkApiKeyAuth(req);
  if (apiKeyResult) return apiKeyResult;

  const ip = getClientIp(req);
  if (ip === "unknown") return { allowed: true, current: 0, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_ip: ip,
      p_daily_limit: DAILY_LIMIT,
    });
    if (error) {
      console.error("Rate limit check error:", error);
      return { allowed: true, current: 0, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };
    }
    const result = data as { allowed: boolean; current: number; remaining: number };
    return { ...result, limit: DAILY_LIMIT };
  } catch (err) {
    console.error("Rate limit error:", err);
    return { allowed: true, current: 0, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };
  }
}

function rateLimitResponse(rateInfo: { current: number; remaining: number; limit?: number; isApiKey?: boolean }): Response {
  const limit = rateInfo.limit || DAILY_LIMIT;
  const errorMsg = rateInfo.isApiKey
    ? `API Key 额度已用完，今日限制 ${limit} 次`
    : `请求过于频繁，每天限制 ${DAILY_LIMIT} 次调用`;
  const hint = rateInfo.isApiKey
    ? "请到 readgzh.site/dashboard 领取免费额度或升级套餐"
    : "如需更多额度，请到 readgzh.site/dashboard 获取 API Key";

  return new Response(
    JSON.stringify({
      success: false,
      error: errorMsg,
      hint,
      current: rateInfo.current,
      limit,
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(rateInfo.remaining),
      },
    }
  );
}

// ===== Main Handler =====
console.log("wechat-reader function loaded");
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET and HEAD requests: check if this is a "read mode" request (?s= or ?id=)
    if (req.method === "GET" || req.method === "HEAD") {
      const params = new URL(req.url).searchParams;
      const slug = params.get("s");
      const articleId = params.get("id");

      // Read mode (serving cached articles) - no rate limit needed
      if (slug || articleId) {
        console.log("Read mode: slug=", slug, "id=", articleId);
        const response = await handleReadMode(slug, articleId);
        // For HEAD requests, return headers only (no body)
        if (req.method === "HEAD") {
          return new Response(null, { status: response.status, headers: response.headers });
        }
        return response;
      }

      // Scrape request with ?url= - rate limit applies (GET only, not HEAD)
      if (req.method === "HEAD") {
        return new Response(null, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const url = params.get("url");
      if (!url) {
        return new Response(
          JSON.stringify({ success: false, error: "请提供微信文章链接" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check rate limit for scrape requests
      const rateInfo = await checkRateLimit(req);
      if (rateInfo && !rateInfo.allowed) {
        return rateLimitResponse(rateInfo);
      }

      return await handleScrapeAndRedirect(url);
    }

    // POST request: scrape or submit article
    if (req.method === "POST") {
      const body = await req.json();

      // Handle direct article submission (from bookmarklet) - rate limit applies
      if (body.action === "submit") {
        const rateInfo = await checkRateLimit(req);
        if (rateInfo && !rateInfo.allowed) {
          return rateLimitResponse(rateInfo);
        }
        return await handleDirectSubmit(body);
      }

      // Handle URL scraping - rate limit applies
      const url = body.url;
      if (!url) {
        return new Response(
          JSON.stringify({ success: false, error: "请提供微信文章链接" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check rate limit
      const rateInfo = await checkRateLimit(req);
      if (rateInfo && !rateInfo.allowed) {
        return rateLimitResponse(rateInfo);
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

// GET ?url= handler: scrape, store, then return SSR HTML directly (no redirect)
async function handleScrapeAndRedirect(url: string): Promise<Response> {
  if (!url.includes("mp.weixin.qq.com") && !url.includes("weixin.qq.com")) {
    return new Response(
      `<!DOCTYPE html><html><body><h1>错误</h1><p>请提供有效的微信公众号文章链接</p></body></html>`,
      { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // First try cache
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let slug: string | null = null;
  const slugMatch = url.match(/\/(s\/[^?#]+)/);
  if (slugMatch) slug = slugMatch[1];

  let existing = null;
  if (slug) {
    const { data } = await supabase.from("articles").select("id, slug").eq("slug", slug).maybeSingle();
    existing = data;
  }
  if (!existing) {
    const { data } = await supabase.from("articles").select("id, slug").eq("source_url", url).maybeSingle();
    existing = data;
  }

  if (existing) {
    // Already cached – return SSR HTML directly
    const slugId = existing.slug?.replace(/^s\//, "") || "";
    return await handleReadMode(slugId || null, slugId ? null : existing.id);
  }

  // Not cached – scrape via handleScrape (which stores it), then return HTML
  const scrapeResult = await handleScrape(url);
  const resultData = await scrapeResult.json();

  if (!resultData.success) {
    return new Response(
      `<!DOCTYPE html><html><body><h1>抓取失败</h1><p>${resultData.error || "未知错误"}</p><p>请稍后重试</p></body></html>`,
      { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Return SSR HTML directly (no redirect)
  const savedSlug = resultData.slug?.replace(/^s\//, "") || "";
  return await handleReadMode(savedSlug || null, savedSlug ? null : resultData.articleId);
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

    // Minimum content length to consider extraction successful
    const MIN_CONTENT_LENGTH = 100;

    // Try scraping methods
    let html = await tryDirectFetch(url);

    if (!html || html.length < 500) {
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (firecrawlKey) {
        const fc = await tryFirecrawl(url, firecrawlKey);
        html = fc.html;
      }
    }

    if (!html || html.length < 500) {
      return new Response(
        JSON.stringify({ success: false, error: "无法获取文章内容，请稍后重试" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if WeChat returned an error page (deleted/invalid article)
    const wechatError = isWeChatErrorPage(html);
    if (wechatError) {
      console.log("WeChat error page detected:", wechatError);
      return new Response(
        JSON.stringify({ success: false, error: wechatError }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for verification page
    if (isVerificationPage(html)) {
      // Try Firecrawl as fallback for verification pages
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (firecrawlKey) {
        console.log("Verification page detected, trying Firecrawl fallback");
        const fc = await tryFirecrawl(url, firecrawlKey);
        const firecrawlHtml = fc.html;
        if (firecrawlHtml && firecrawlHtml.length > 500 && !isVerificationPage(firecrawlHtml)) {
          html = firecrawlHtml;
        } else {
          return new Response(
            JSON.stringify({ success: false, error: "微信需要验证，暂时无法自动抓取此文章。请稍后重试。" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ success: false, error: "微信需要验证，暂时无法自动抓取此文章。请稍后重试。" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Helper: attempt content extraction from a given HTML string
    function tryExtractContent(srcHtml: string): { metadata: ReturnType<typeof extractMetadata>; contentHtml: string; textContent: string } {
      const meta = extractMetadata(srcHtml);
      // Try picture template first (小绿书 format)
      const pictureData = extractPictureTemplate(srcHtml);
      if (pictureData) {
        console.log("Detected picture template (小绿书), images:", pictureData.images.length);
        if (meta.title === "无标题") {
          const doc = new DOMParser().parseFromString(srcHtml, "text/html");
          const ogTitle = doc?.querySelector('meta[property="og:title"]');
          if (ogTitle) meta.title = (ogTitle as Element).getAttribute("content") || "无标题";
        }
        return { metadata: meta, contentHtml: pictureData.contentHtml, textContent: pictureData.textContent };
      }
      // Standard article extraction
      const extracted = extractFormattedContent(srcHtml);
      return { metadata: meta, contentHtml: extracted.contentHtml, textContent: extracted.textContent };
    }

    // First extraction attempt
    let result = tryExtractContent(html);

    // If content is too short, try Firecrawl (which renders JS) as fallback
    if (!result.textContent || result.textContent.length < MIN_CONTENT_LENGTH) {
      console.log(`Content too short (${result.textContent?.length || 0} chars), trying Firecrawl fallback`);
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (firecrawlKey) {
        const fc = await tryFirecrawl(url, firecrawlKey);
        // Try HTML extraction first
        if (fc.html && fc.html.length > 500) {
          const firecrawlResult = tryExtractContent(fc.html);
          if (firecrawlResult.textContent && firecrawlResult.textContent.length > (result.textContent?.length || 0)) {
            console.log(`Firecrawl HTML got better content: ${firecrawlResult.textContent.length} chars`);
            result = firecrawlResult;
            html = fc.html;
          }
        }
        // If HTML extraction still failed, use markdown directly as content
        if ((!result.textContent || result.textContent.length < MIN_CONTENT_LENGTH) && fc.markdown && fc.markdown.length >= MIN_CONTENT_LENGTH) {
          console.log(`Using Firecrawl markdown as content: ${fc.markdown.length} chars`);
          const meta = extractMetadata(html);
          // If markdown has a title line (# Title), extract it
          const mdTitleMatch = fc.markdown.match(/^#\s+(.+)/m);
          if (mdTitleMatch && meta.title === "无标题") {
            meta.title = mdTitleMatch[1].trim();
          }
          result = {
            metadata: meta,
            contentHtml: fc.markdown.split("\n").filter(l => l.trim()).map(l => `<p>${l}</p>`).join("\n"),
            textContent: fc.markdown,
          };
        }
      }
    }

    const { metadata, contentHtml, textContent } = result;

    if (!textContent || textContent.length < MIN_CONTENT_LENGTH) {
      return new Response(
        JSON.stringify({ success: false, error: "无法提取文章内容，文章可能已被删除或需要在微信中打开。", hint: "部分文章内容通过 JavaScript 动态加载，服务端无法直接获取。" }),
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
