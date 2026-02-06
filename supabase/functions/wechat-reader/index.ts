const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ArticleData {
  title: string;
  author: string;
  content: string;
  publishTime?: string;
  sourceUrl: string;
}

// Check if content indicates a verification/captcha page
function isVerificationPage(content: string, title: string): boolean {
  const verificationPatterns = [
    "环境异常",
    "完成验证",
    "去验证",
    "验证码",
    "滑块",
    "拼图",
    "Weixin Official Accounts Platform",
    "请完成安全验证",
    "访问过于频繁",
  ];
  
  const combinedText = `${title} ${content}`.toLowerCase();
  return verificationPatterns.some(pattern => 
    combinedText.includes(pattern.toLowerCase())
  );
}

// Extract author from WeChat page content
function extractAuthor(markdown: string, metadata: Record<string, unknown>): string {
  // Try metadata first
  if (metadata.author && typeof metadata.author === "string") {
    return metadata.author;
  }
  
  // Look for common WeChat author patterns in content
  const authorPatterns = [
    /作者[：:]\s*([^\n]+)/,
    /来源[：:]\s*([^\n]+)/,
    /原创[：:]\s*([^\n]+)/,
    /文[：:]\s*([^\n]+)/,
  ];
  
  for (const pattern of authorPatterns) {
    const match = markdown.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return "公众号文章";
}

// Clean article title
function cleanTitle(title: string): string {
  if (!title) return "无标题";
  
  // Remove common suffixes
  const suffixes = [
    "| 微信公众平台",
    "- 微信公众平台", 
    "_微信公众平台",
    "| Weixin Official Accounts Platform",
    "- Weixin Official Accounts Platform",
  ];
  
  let cleanedTitle = title;
  for (const suffix of suffixes) {
    if (cleanedTitle.includes(suffix)) {
      cleanedTitle = cleanedTitle.split(suffix)[0].trim();
    }
  }
  
  // Also try splitting on common delimiters
  if (cleanedTitle.includes("|")) {
    cleanedTitle = cleanedTitle.split("|")[0].trim();
  }
  if (cleanedTitle.includes(" - ") && cleanedTitle.length > 50) {
    cleanedTitle = cleanedTitle.split(" - ")[0].trim();
  }
  
  return cleanedTitle || "无标题";
}

// Clean markdown content
function cleanContent(markdown: string, title: string): string {
  let content = markdown;
  
  // Remove image references
  content = content.replace(/!\[.*?\]\(.*?\)/g, "");
  
  // Remove the title if it appears at the start
  if (title) {
    content = content.replace(new RegExp(`^#\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\n*`, 'i'), "");
  }
  
  // Remove WeChat specific elements
  const removePatterns = [
    /轻点两下取消赞/g,
    /轻点两下取消在看/g,
    /\.VideoMini Program/g,
    /Like.*?Wow/g,
    /阅读原文/g,
    /\[.*?\]\(javascript:.*?\)/g,
    /预览时标签不可点/g,
    /微信扫一扫/g,
    /关注该公众号/g,
  ];
  
  for (const pattern of removePatterns) {
    content = content.replace(pattern, "");
  }
  
  // Clean up excessive newlines
  content = content.replace(/\n{3,}/g, "\n\n");
  
  // Remove leading/trailing whitespace
  content = content.trim();
  
  return content;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "服务配置错误，请联系管理员",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get URL from request body or query params
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
          code: "INVALID_REQUEST",
          error: "请提供微信文章链接",
        }),
        {
          // NOTE: supabase-js 会把非 2xx 状态当成异常并丢失 body，所以这里统一返回 200
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
          code: "INVALID_WECHAT_URL",
          error: "请提供有效的微信公众号文章链接",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Scraping WeChat article:", url);

    // Use Firecrawl to scrape the article with optimized settings
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        formats: ["markdown", "html"],
        onlyMainContent: true,
        waitFor: 5000, // Increased wait time for JS rendering
        location: {
          country: "CN",
          languages: ["zh-CN", "zh"],
        },
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error("Firecrawl API error:", scrapeData);
      return new Response(
        JSON.stringify({
          success: false,
          code: "SCRAPE_FAILED",
          upstreamStatus: scrapeResponse.status,
          error: scrapeData.error || "抓取文章失败，请稍后重试",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Firecrawl response received");

    // Extract article data from Firecrawl response
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};
    const rawTitle = metadata.title || "";

    // Check if we got a verification page instead of actual content
    if (isVerificationPage(markdown, rawTitle)) {
      console.log("Detected verification page, returning error");
      return new Response(
        JSON.stringify({
          success: false,
          code: "WECHAT_VERIFICATION_REQUIRED",
          error: "微信需要验证，无法直接抓取此文章。请尝试其他文章链接，或稍后重试。",
          hint: "某些热门文章或新发布的文章可能有更严格的访问限制。",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Clean and process the data
    const title = cleanTitle(rawTitle);
    const author = extractAuthor(markdown, metadata);
    const content = cleanContent(markdown, title);
    
    // Check if we got meaningful content
    if (!content || content.length < 50) {
      console.log("Content too short or empty:", content.length);
      return new Response(
        JSON.stringify({
          success: false,
          code: "CONTENT_NOT_FOUND",
          error: "无法提取文章内容，文章可能已被删除或设置了访问限制。",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Try to extract publish time
    const publishTime = metadata.publishedTime || metadata.date || undefined;

    const articleData: ArticleData = {
      title,
      author,
      content,
      publishTime,
      sourceUrl: url,
    };

    console.log("Article extracted successfully:", articleData.title, "- Content length:", content.length);

    return new Response(
      JSON.stringify({
        success: true,
        data: articleData,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    const errorMessage = error instanceof Error ? error.message : "未知错误";
    return new Response(
      JSON.stringify({
        success: false,
        error: `处理请求失败: ${errorMessage}`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
