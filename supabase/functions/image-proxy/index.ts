// WeChat image proxy with referer whitelist + IP rate limit to prevent egress abuse.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Referer whitelist: only our site + WeChat sources (some clients echo mp.weixin referer).
const ALLOWED_REFERER_HOSTS = [
  "readgzh.site",
  "www.readgzh.site",
  "api.readgzh.site",
  "readgzh.lovable.app",
  "id-preview--655ade8f-2aee-427f-9651-08611be168ea.lovable.app",
  "mp.weixin.qq.com",
];

// Higher daily ceiling — a single article page can pull dozens of images.
const IMG_DAILY_LIMIT = 500;

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function refererAllowed(req: Request): boolean {
  const ref = req.headers.get("referer") || req.headers.get("origin");
  // No referer → allow (some browsers/clients strip it; SSR/AI agents won't send it).
  // Abuse vector is mainly hot-linking from third-party sites, which DO send a referer.
  if (!ref) return true;
  try {
    const host = new URL(ref).hostname;
    return ALLOWED_REFERER_HOSTS.some(
      (h) => host === h || host.endsWith(`.${h}`)
    );
  } catch {
    return true;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Referer whitelist (block hot-linking from other sites).
  if (!refererAllowed(req)) {
    console.log("[image-proxy] Blocked referer:", req.headers.get("referer"));
    return new Response("Referer not allowed", { status: 403, headers: corsHeaders });
  }

  // 2. IP rate limit to cap egress per IP per day.
  const ip = getClientIp(req);
  if (ip !== "unknown") {
    try {
      const { data, error } = await supabase.rpc("check_rate_limit", {
        p_ip: `img:${ip}`,
        p_daily_limit: IMG_DAILY_LIMIT,
      });
      if (!error) {
        const result = data as { allowed: boolean; current: number };
        if (!result.allowed) {
          console.log(`[image-proxy] Rate limit exceeded for IP: ${ip}, current: ${result.current}`);
          return new Response("Rate limit exceeded", { status: 429, headers: corsHeaders });
        }
      }
    } catch (e) {
      console.error("[image-proxy] rate limit check failed:", e);
    }
  }

  try {
    const { searchParams } = new URL(req.url);
    let imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return new Response("Missing url parameter", { status: 400, headers: corsHeaders });
    }

    imageUrl = imageUrl.replace(/&amp;/g, "&");

    // Allow all WeChat image CDN subdomains (mmbiz.qpic.cn, mmecoa.qpic.cn, etc.)
    const allowedSuffixes = [".qpic.cn", ".qlogo.cn"];
    let hostname: string;
    try {
      hostname = new URL(imageUrl).hostname;
    } catch {
      return new Response("Invalid URL", { status: 400, headers: corsHeaders });
    }

    if (!allowedSuffixes.some((d) => hostname.endsWith(d))) {
      return new Response("Domain not allowed", { status: 403, headers: corsHeaders });
    }

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://mp.weixin.qq.com/",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
      },
    });

    if (!response.ok) {
      console.error("Image fetch failed:", response.status);
      return new Response("Failed to fetch image", { status: 502, headers: corsHeaders });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const imageData = await response.arrayBuffer();

    return new Response(imageData, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
        "Access-Control-Expose-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});
