// ReadGZH short URL proxy → wechat-reader edge function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const baseUrl = Deno.env.get("SUPABASE_URL")!;
  const targetUrl = `${baseUrl}/functions/v1/wechat-reader${url.search}`;

  const headers = new Headers();
  // Forward relevant headers
  for (const [key, value] of req.headers.entries()) {
    if (key !== "host") headers.set(key, value);
  }

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined,
  });

  const responseHeaders = new Headers(response.headers);
  // Ensure CORS
  responseHeaders.set("Access-Control-Allow-Origin", "*");

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
});
