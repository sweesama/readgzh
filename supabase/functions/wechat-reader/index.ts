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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let url: string | null = null;

    if (req.method === "POST") {
      const body = await req.json();
      url = body.url;
    } else if (req.method === "GET") {
      url = new URL(req.url).searchParams.get("url");
    }

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "请提供微信文章链接" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!url.includes("mp.weixin.qq.com") && !url.includes("weixin.qq.com")) {
      return new Response(
        JSON.stringify({ success: false, error: "请提供有效的微信公众号文章链接" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cache
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existing } = await supabase
      .from("articles")
      .select("id")
      .eq("source_url", url)
      .maybeSingle();

    if (existing) {
      console.log("Cache hit:", existing.id);
      return new Response(
        JSON.stringify({ success: true, cached: true, articleId: existing.id }),
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

    console.log("Saved:", saved.id, metadata.title, "Text:", textContent.length, "HTML:", contentHtml.length);

    return new Response(
      JSON.stringify({ success: true, cached: false, articleId: saved.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: `处理请求失败: ${error instanceof Error ? error.message : "未知错误"}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
