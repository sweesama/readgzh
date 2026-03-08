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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/articles-api\/?/, "");

  try {
    // GET /articles-api/search?q=keyword&limit=5
    if (path === "search" || path === "search/") {
      const query = url.searchParams.get("q") || "";
      const limit = Math.min(Number(url.searchParams.get("limit")) || 5, 20);

      if (!query) {
        return new Response(
          JSON.stringify({ success: false, error: "missing_query", message: "Parameter 'q' is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: articles, error } = await supabase
        .from("articles")
        .select("title, author, publish_time, slug, source_url, view_count, created_at")
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: "db_error", message: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          articles: (articles || []).map((a) => ({
            title: a.title,
            author: a.author,
            publish_time: a.publish_time,
            slug: a.slug,
            url: a.slug ? `https://readgzh.site/${a.slug}` : null,
            view_count: a.view_count,
          })),
          total: (articles || []).length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Credit-Cost": "0" } }
      );
    }

    // GET /articles-api/recent?limit=10
    if (path === "recent" || path === "recent/" || path === "" || path === "/") {
      const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 50);

      const { data: articles, error } = await supabase
        .from("articles")
        .select("title, author, publish_time, slug, source_url, view_count, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: "db_error", message: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          articles: (articles || []).map((a) => ({
            title: a.title,
            author: a.author,
            publish_time: a.publish_time,
            slug: a.slug,
            url: a.slug ? `https://readgzh.site/${a.slug}` : null,
            view_count: a.view_count,
          })),
          total: (articles || []).length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json", "X-Credit-Cost": "0" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "not_found", message: "Unknown endpoint. Use /search?q=keyword or /recent?limit=10" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: "internal_error", message: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
