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
          error: "请提供微信文章链接",
        }),
        {
          status: 400,
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
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Scraping WeChat article:", url);

    // Use Firecrawl to scrape the article
    const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 2000, // Wait for dynamic content
      }),
    });

    const scrapeData = await scrapeResponse.json();

    if (!scrapeResponse.ok) {
      console.error("Firecrawl API error:", scrapeData);
      return new Response(
        JSON.stringify({
          success: false,
          error: scrapeData.error || "抓取文章失败，请稍后重试",
        }),
        {
          status: scrapeResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Firecrawl response received");

    // Extract article data from Firecrawl response
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

    // Parse title from metadata or markdown
    let title = metadata.title || "";
    // Clean up title - remove site suffix
    if (title.includes("|")) {
      title = title.split("|")[0].trim();
    }
    if (title.includes("-")) {
      title = title.split("-")[0].trim();
    }

    // Extract author - try metadata first, then look in content
    let author = metadata.author || "未知作者";
    
    // Try to extract publish time from metadata
    const publishTime = metadata.publishedTime || metadata.date || undefined;

    // Clean up markdown content
    let content = markdown;
    
    // Remove image references since we're not storing images
    content = content.replace(/!\[.*?\]\(.*?\)/g, "");
    // Remove empty lines created by removed images
    content = content.replace(/\n{3,}/g, "\n\n");
    // Remove any remaining markdown headers that might be the title
    if (title && content.startsWith(`# ${title}`)) {
      content = content.replace(`# ${title}`, "").trim();
    }

    const articleData: ArticleData = {
      title: title || "无标题",
      author,
      content: content.trim(),
      publishTime,
      sourceUrl: url,
    };

    console.log("Article extracted successfully:", articleData.title);

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
    const errorMessage =
      error instanceof Error ? error.message : "未知错误";
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
