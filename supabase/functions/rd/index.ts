// ReadGZH short URL proxy → backend edge function
// Anonymous IP rate-limited (shared 10/IP/day pool with Web/MCP).
// Requests carrying a user API Key (rgz_*) bypass IP limits.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limit anonymous traffic (no user API key).
  if (!hasUserApiKey(req)) {
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
                error: `Anonymous limit reached (${ANON_DAILY_LIMIT}/IP/day). Register at https://readgzh.site/dashboard for daily credits, or upgrade to Lite/Pro.`,
                hint: "If you are calling from shared infrastructure (Replit, Vercel, Cloudflare Workers, etc.), the IP quota may already be exhausted by other users. Use an API Key in the Authorization header (Bearer rgz_...) to bypass IP limits. Get a free key at https://readgzh.site/dashboard.",
                dashboard_url: "https://readgzh.site/dashboard",
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

  const url = new URL(req.url);
  const targetUrl = `${SUPABASE_URL}/functions/v1/wechat-reader${url.search}`;

  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (key !== "host") headers.set(key, value);
  }

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined,
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
});
