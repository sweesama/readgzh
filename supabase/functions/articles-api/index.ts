import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Powered-By": "ReadGZH (readgzh.site)",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Extract API key from request (header or query param)
function extractApiKey(req: Request, url: URL): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return url.searchParams.get("key") || null;
}

// Hash API key (same logic as other functions)
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Check IP rate limit for anonymous users
async function checkAnonymousRateLimit(req: Request): Promise<{ allowed: boolean; current: number; limit: number }> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  const dailyLimit = 10; // 10 requests/IP/day for anonymous
  const { data } = await supabase.rpc("check_rate_limit", { p_ip: ip, p_daily_limit: dailyLimit });

  if (data) {
    return { allowed: data.allowed, current: data.current, limit: data.limit };
  }
  return { allowed: true, current: 0, limit: dailyLimit };
}

// Rate limit exceeded response with compelling registration CTA
function rateLimitResponse(current: number, limit: number) {
  return new Response(
    JSON.stringify({
      success: false,
      error: "rate_limit_exceeded",
      message: `Anonymous API access limit reached (${current}/${limit} requests today).`,
    hint: "🔑 免费注册获取 API Key，每天 30 积分。Lite ¥9/月 300积分，Pro ¥39/月 2000积分。",
      benefits: [
        "✅ 每日 30 积分免费使用",
        "✅ 缓存文章免费读取",
        "✅ 用量统计面板",
        "✅ WebMCP 协议支持",
      ],
      register_url: "https://readgzh.site/dashboard",
      docs_url: "https://readgzh.site/docs",
      pricing_url: "https://readgzh.site/pricing",
      powered_by: "ReadGZH (https://readgzh.site) - 让 AI 读懂微信公众号",
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-Credit-Cost": "0",
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(Math.max(0, limit - current)),
      },
    }
  );
}

// Format article list response
function formatArticles(articles: any[]) {
  return (articles || []).map((a) => ({
    title: a.title,
    author: a.author,
    publish_time: a.publish_time,
    slug: a.slug,
    url: a.slug ? `https://readgzh.site/${a.slug}` : null,
    view_count: a.view_count,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/articles-api\/?/, "");

  try {
    // --- Auth & Rate Limiting ---
    const apiKey = extractApiKey(req, url);
    let isAuthenticated = false;

    if (apiKey) {
      const keyHash = await hashKey(apiKey);
      const { data } = await supabase.rpc("validate_api_key", { p_key_hash: keyHash, p_credit_cost: 0 });
      isAuthenticated = data?.valid === true;
    }

    if (!isAuthenticated) {
      const rateCheck = await checkAnonymousRateLimit(req);
      if (!rateCheck.allowed) {
        return rateLimitResponse(rateCheck.current, rateCheck.limit);
      }
    }

    // --- Search endpoint ---
    if (path === "search" || path === "search/") {
      const query = url.searchParams.get("q") || "";
      const limit = Math.min(Number(url.searchParams.get("limit")) || 5, 20);

      if (!query) {
        return new Response(
          JSON.stringify({
            success: false, code: "missing_query", error: "missing_query",
            message: "缺少搜索关键词。请提供参数 q。",
            hint: "示例：/articles-api/search?q=人工智能&limit=10。limit 默认 5，最大 20。",
            docs_url: "https://readgzh.site/docs", dashboard_url: "https://readgzh.site/dashboard",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Strip PostgREST filter metacharacters to prevent .or() filter injection.
      const safeQuery = query.replace(/[,.()'"\\:*]/g, "").slice(0, 100);
      const { data: articles, error } = await supabase
        .from("articles")
        .select("title, author, publish_time, slug, source_url, view_count, created_at")
        .or(`title.ilike.%${safeQuery}%,content.ilike.%${safeQuery}%`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return new Response(
          JSON.stringify({
            success: false, code: "db_error", error: "db_error", message: error.message,
            hint: "数据库查询异常，请稍后重试。若持续出现请反馈。",
            support_url: "https://readgzh.site/#feedback",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          articles: formatArticles(articles || []),
          total: (articles || []).length,
          powered_by: "ReadGZH (https://readgzh.site)",
          upgrade_hint: "免费注册每天 30 积分 · Lite ¥9/月 · Pro ¥39/月 → readgzh.site/dashboard",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Credit-Cost": "0" } }
      );
    }

    // --- Recent/List endpoint ---
    if (path === "recent" || path === "recent/" || path === "" || path === "/") {
      const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 50);

      const { data: articles, error } = await supabase
        .from("articles")
        .select("title, author, publish_time, slug, source_url, view_count, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return new Response(
          JSON.stringify({
            success: false, code: "db_error", error: "db_error", message: error.message,
            hint: "数据库查询异常，请稍后重试。",
            support_url: "https://readgzh.site/#feedback",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          articles: formatArticles(articles || []),
          total: (articles || []).length,
          powered_by: "ReadGZH (https://readgzh.site)",
          upgrade_hint: "免费注册每天 30 积分 · Lite ¥9/月 · Pro ¥39/月 → readgzh.site/dashboard",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Credit-Cost": "0" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false, code: "not_found", error: "not_found",
        message: "未知接口。可用端点：/search?q=keyword、/recent?limit=10。",
        hint: "完整接口列表见开发者文档。",
        available_endpoints: ["/search?q=keyword&limit=10", "/recent?limit=10"],
        docs_url: "https://readgzh.site/docs", dashboard_url: "https://readgzh.site/dashboard",
      }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false, code: "internal_error", error: "internal_error",
        message: err instanceof Error ? err.message : "Unknown error",
        hint: "服务端异常，请稍后重试。若持续出现请反馈。",
        support_url: "https://readgzh.site/#feedback",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
