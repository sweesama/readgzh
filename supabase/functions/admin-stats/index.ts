import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "sweeyeah@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user || user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    // Run all queries in parallel
    const [
      profilesRes,
      articlesRes,
      apiKeysRes,
      proKeysRes,
      todayUsageRes,
      totalUsageRes,
      todayCreditsRes,
      recentUsersRes,
    ] = await Promise.all([
      svc.from("profiles").select("*", { count: "exact", head: true }),
      svc.from("articles").select("*", { count: "exact", head: true }),
      svc.from("api_keys").select("*", { count: "exact", head: true }).eq("is_active", true),
      svc.from("api_keys").select("*", { count: "exact", head: true }).eq("is_active", true).in("tier", ["pro", "pro_lifetime"]),
      svc.from("api_usage").select("request_count, cached_count").eq("usage_date", today),
      svc.from("api_usage").select("request_count, cached_count"),
      svc.from("daily_credits").select("*", { count: "exact", head: true }).eq("claim_date", today),
      svc.from("profiles").select("id, email, display_name, created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    const todayRequests = (todayUsageRes.data || []).reduce((s: number, r: any) => s + r.request_count, 0);
    const todayCached = (todayUsageRes.data || []).reduce((s: number, r: any) => s + r.cached_count, 0);
    const totalRequests = (totalUsageRes.data || []).reduce((s: number, r: any) => s + r.request_count, 0);
    const totalCached = (totalUsageRes.data || []).reduce((s: number, r: any) => s + r.cached_count, 0);

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total_users: profilesRes.count || 0,
          total_articles: articlesRes.count || 0,
          active_api_keys: apiKeysRes.count || 0,
          pro_users: proKeysRes.count || 0,
          today_requests: todayRequests,
          today_cached: todayCached,
          today_active_users: todayCreditsRes.count || 0,
          total_requests: totalRequests,
          total_cached: totalCached,
        },
        recent_users: recentUsersRes.data || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin stats error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
