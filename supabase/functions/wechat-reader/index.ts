import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Clean article text content
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

// Extract text from HTML element recursively, preserving paragraph structure
function extractText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return "";

  const contentEl = doc.querySelector("#js_content");
  if (!contentEl) return "";

  // Get all paragraph-like elements
  const paragraphs: string[] = [];
  const elements = contentEl.querySelectorAll("p, section, h1, h2, h3, h4, h5, h6, blockquote, li");

  if (elements.length > 0) {
    for (const el of elements) {
      const text = (el as any).textContent?.trim();
      if (text && text.length > 0) {
        paragraphs.push(text);
      }
    }
  }

  // Fallback: get all text content
  if (paragraphs.length === 0) {
    const allText = (contentEl as any).textContent?.trim();
    if (allText) {
      return allText;
    }
  }

  return paragraphs.join("\n\n");
}

// Try to extract article data from WeChat HTML
function parseWeChatHTML(html: string, sourceUrl: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return null;

  // Check for verification page
  const bodyText = (doc.body as any)?.textContent || "";
  if (
    bodyText.includes("环境异常") ||
    bodyText.includes("完成验证") ||
    bodyText.includes("去验证")
  ) {
    return null; // Verification page
  }

  // Extract title
  let title = "";
  const titleEl = doc.querySelector("#activity-name");
  if (titleEl) {
    title = (titleEl as any).textContent?.trim() || "";
  }
  if (!title) {
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      title = (ogTitle as any).getAttribute("content") || "";
    }
  }
  if (!title) {
    const titleTag = doc.querySelector("title");
    if (titleTag) {
      title = (titleTag as any).textContent?.trim() || "";
      // Remove common suffixes
      title = title.replace(/\s*[-|_]\s*微信公众平台.*$/, "").trim();
    }
  }

  // Extract author
  let author = "";
  const authorEl = doc.querySelector("#js_name");
  if (authorEl) {
    author = (authorEl as any).textContent?.trim() || "";
  }
  if (!author) {
    const ogAuthor = doc.querySelector('meta[property="og:article:author"]');
    if (ogAuthor) {
      author = (ogAuthor as any).getAttribute("content") || "";
    }
  }

  // Extract content
  const content = extractText(html);

  // Extract description as fallback
  let description = "";
  const ogDesc = doc.querySelector('meta[property="og:description"]');
  if (ogDesc) {
    description = (ogDesc as any).getAttribute("content") || "";
  }

  // Extract publish time
  let publishTime = "";
  const pubTimeEl = doc.querySelector("#publish_time");
  if (pubTimeEl) {
    publishTime = (pubTimeEl as any).textContent?.trim() || "";
  }

  return {
    title: title || "无标题",
    author: author || "公众号文章",
    content: content || description || "",
    publishTime: publishTime || null,
  };
}

// Attempt 1: Direct fetch with browser-like headers
async function tryDirectFetch(url: string): Promise<string | null> {
  console.log("Attempt 1: Direct fetch with browser headers");

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
  };

  try {
    const response = await fetch(url, {
      headers,
      redirect: "follow",
    });

    if (!response.ok) {
      console.log("Direct fetch failed with status:", response.status);
      return null;
    }

    const html = await response.text();
    console.log("Direct fetch got HTML, length:", html.length);
    return html;
  } catch (error) {
    console.error("Direct fetch error:", error);
    return null;
  }
}

// Attempt 2: Use Firecrawl as fallback
async function tryFirecrawl(
  url: string,
  apiKey: string
): Promise<string | null> {
  console.log("Attempt 2: Firecrawl scraping");

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        formats: ["html"],
        onlyMainContent: false,
        waitFor: 8000,
        location: {
          country: "CN",
          languages: ["zh-CN", "zh"],
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Firecrawl error:", data);
      return null;
    }

    const html = data.data?.html || data.html || "";
    console.log("Firecrawl got HTML, length:", html.length);
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
    // Get URL from request
    let url: string | null = null;

    if (req.method === "POST") {
      const body = await req.json();
      url = body.url;
    } else if (req.method === "GET") {
      const urlParams = new URL(req.url).searchParams;
      url = urlParams.get("url");
    }

    if (!url) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "请提供微信文章链接",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate WeChat URL
    if (!url.includes("mp.weixin.qq.com") && !url.includes("weixin.qq.com")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "请提供有效的微信公众号文章链接",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check cache first
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingArticle } = await supabase
      .from("articles")
      .select("id")
      .eq("source_url", url)
      .maybeSingle();

    if (existingArticle) {
      console.log("Article already cached:", existingArticle.id);
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          articleId: existingArticle.id,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Try multiple scraping methods
    let html: string | null = null;

    // Method 1: Direct fetch
    html = await tryDirectFetch(url);

    // Method 2: Firecrawl fallback
    if (!html || html.length < 500) {
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (firecrawlKey) {
        html = await tryFirecrawl(url, firecrawlKey);
      }
    }

    if (!html || html.length < 500) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "无法获取文章内容，请稍后重试",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse the HTML
    const article = parseWeChatHTML(html, url);

    if (!article) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "微信需要验证，暂时无法自动抓取此文章。请稍后重试。",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!article.content || article.content.length < 20) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "无法提取文章内容，文章可能已被删除或设置了访问限制。",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Save to database
    const { data: savedArticle, error: dbError } = await supabase
      .from("articles")
      .insert({
        title: article.title.substring(0, 500),
        author: article.author,
        content: article.content,
        raw_html: html.substring(0, 500000), // Limit raw HTML size
        source_url: url,
        publish_time: article.publishTime,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("Database save error:", dbError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "保存文章失败，请稍后重试",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      "Article saved:",
      savedArticle.id,
      article.title,
      "Content length:",
      article.content.length
    );

    return new Response(
      JSON.stringify({
        success: true,
        cached: false,
        articleId: savedArticle.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: `处理请求失败: ${error instanceof Error ? error.message : "未知错误"}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
