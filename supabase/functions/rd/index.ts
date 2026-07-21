// ReadGZH short URL proxy → backend edge function
// Anonymous IP rate-limited (shared 10/IP/day pool with Web/MCP).
// Requests carrying a user API Key (sk_live_*) bypass IP limits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ANON_DAILY_LIMIT = 10;

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function hasUserApiKey(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const token = auth.slice(7).trim();
  if (!token) return false;
  // JWT (anon/service) starts with "eyJ" — treat as anonymous.
  if (token.startsWith("eyJ")) return false;
  return true;
}

function queryKeyNotSupportedResponse(): Response {
  return new Response(
    JSON.stringify({
      success: false,
      code: "query_key_not_supported",
      error: "query_key_not_supported",
      message: "为避免 API Key 出现在浏览器历史、服务器日志或分享链接中，ReadGZH 已不再接受 URL 参数 ?key=...。",
      hint: "请把 Key 放到请求头：Authorization: Bearer sk_live_...。注意：Stripe 等第三方密钥不能作为 ReadGZH API Key 使用；请在 ReadGZH 控制台创建 sk_live_ 开头的 Key。",
      dashboard_url: "https://readgzh.site/dashboard",
      docs_url: "https://readgzh.site/docs",
    }),
    {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (url.searchParams.has("key")) {
    return queryKeyNotSupportedResponse();
  }

  // P0: Cache-hit bypass. If ?s=slug points to an already-cached article,
  // skip the IP rate limit entirely — serving cache is zero-cost.
  let cacheHit = false;
  const slugParam = url.searchParams.get("s");
  if (slugParam && !hasUserApiKey(req)) {
    // Validate slug strictly to prevent PostgREST filter injection in .or().
    if (/^[a-zA-Z0-9/_-]{1,120}$/.test(slugParam)) {
      try {
        const normalized = slugParam.startsWith("s/") ? slugParam : `s/${slugParam}`;
        const { data: art } = await supabase
          .from("articles")
          .select("id")
          .or(`slug.eq.${normalized},slug.eq.${slugParam}`)
          .limit(1)
          .maybeSingle();
        if (art) cacheHit = true;
      } catch (e) {
        console.error("[rd] cache lookup failed:", e);
      }
    }
  }

  // Rate limit anonymous traffic (no user API key, no cache hit).
  if (!hasUserApiKey(req) && !cacheHit) {
    const ip = getClientIp(req);
    if (ip !== "unknown") {
      try {
        const { data, error } = await supabase.rpc("check_rate_limit", {
          p_ip: ip,
          p_daily_limit: ANON_DAILY_LIMIT,
        });
        if (!error) {
          const result = data as { allowed: boolean; current: number };
          if (!result.allowed) {
            console.log(`[rd] Anon rate limit exceeded for IP: ${ip}, current: ${result.current}`);
            return new Response(
              JSON.stringify({
                success: false,
                code: "rate_limited",
                error: "rate_limited",
                message: `Anonymous limit reached (${ANON_DAILY_LIMIT}/IP/day).`,
                retry_after: 86400,
                hint: "Pass an API Key in the Authorization header (Bearer sk_live_...) to bypass IP limits. Cached articles can be fetched via /rd?s={slug}&format=text without consuming the IP quota. If you are on shared infrastructure (Replit/Vercel/ChatGPT/etc.), the IP pool may already be exhausted by other users.",
                dashboard_url: "https://readgzh.site/dashboard",
                upgrade_url: "https://readgzh.site/pricing",
                use_api_key: "https://readgzh.site/dashboard",
                docs_url: "https://readgzh.site/docs",
              }),
              {
                status: 429,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                  "Retry-After": "86400",
                  "X-RateLimit-Limit": String(ANON_DAILY_LIMIT),
                  "X-RateLimit-Remaining": "0",
                },
              }
            );
          }
        }
      } catch (e) {
        console.error("[rd] rate limit check failed:", e);
      }
    }
  }

  const targetUrl = `${SUPABASE_URL}/functions/v1/wechat-reader${url.search}`;

  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (key !== "host") headers.set(key, value);
  }

  // Guard the upstream call so wechat-reader crashes / timeouts don't surface
  // as opaque 502s to end users. Cap below the edge runtime wall-clock (~60s).
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 55000);

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === "AbortError";
    console.error(`[rd] upstream fetch failed (${isAbort ? "timeout" : "error"}):`, err);
    return new Response(
      JSON.stringify({
        success: false,
        code: isAbort ? "upstream_timeout" : "upstream_unavailable",
        error: isAbort ? "upstream_timeout" : "upstream_unavailable",
        message: isAbort
          ? "Article reader timed out. The source page may be slow or temporarily blocked."
          : "Article reader is temporarily unavailable. Please retry in a moment.",
        hint: "This request did not consume credits. Retry the same URL — most transient failures resolve on the next attempt.",
        retry_after: 5,
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": "5",
        },
      }
    );
  }
});
