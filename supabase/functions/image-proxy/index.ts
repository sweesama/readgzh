const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    let imageUrl = searchParams.get("url");

    if (!imageUrl) {
      return new Response("Missing url parameter", { status: 400, headers: corsHeaders });
    }

    // Decode any HTML entities that may have leaked through
    imageUrl = imageUrl.replace(/&amp;/g, "&");

    // Only allow WeChat image domains
    const allowed = ["mmbiz.qpic.cn", "mmbiz.qlogo.cn", "wx.qlogo.cn"];
    let hostname: string;
    try {
      hostname = new URL(imageUrl).hostname;
    } catch {
      return new Response("Invalid URL", { status: 400, headers: corsHeaders });
    }

    if (!allowed.some((d) => hostname.endsWith(d))) {
      return new Response("Domain not allowed", { status: 403, headers: corsHeaders });
    }

    console.log("Proxying image:", imageUrl.substring(0, 100));

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
