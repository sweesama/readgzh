import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "sweeyeah@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("No Bearer token found in headers");
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Use SUPABASE_SERVICE_ROLE_KEY to call getUser - this bypasses any RLS/JWT issues
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate the user token using service role client
    const { data: { user }, error: userError } = await svc.auth.getUser(token);

    if (userError || !user) {
      console.error("getUser failed:", userError?.message);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Authenticated user:", user.email);

    if (user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];

    // Run all queries in parallel using service client
    const [
      profilesRes,
      articlesRes,
      apiKeysRes,
      proKeysRes,
      todayUsageRes,
      totalUsageRes,
      todayCreditsRes,
      recentUsersRes,
      todayAnonRes,
      totalAnonRes,
      todayArticlesRes,
      totalViewsRes,
    ] = await Promise.all([
      svc.from("profiles").select("*", { count: "exact", head: true }),
      svc.from("articles").select("*", { count: "exact", head: true }),
      svc.from("api_keys").select("*", { count: "exact", head: true }).eq("is_active", true),
      svc.from("api_keys").select("*", { count: "exact", head: true }).eq("is_active", true).in("tier", ["pro", "pro_lifetime"]),
      // Use server-side RPC aggregation instead of fetching all rows
      svc.rpc("get_api_usage_stats", { p_date: today }),
      svc.rpc("get_api_usage_stats"),
      svc.from("daily_credits").select("*", { count: "exact", head: true }).eq("claim_date", today),
      svc.from("profiles").select("id, email, display_name, created_at").order("created_at", { ascending: false }).limit(50),
      // Anonymous requests - use RPC aggregation
      svc.rpc("get_total_anon_requests", { p_date: today }),
      svc.rpc("get_total_anon_requests"),
      // Today's new articles
      svc.from("articles").select("*", { count: "exact", head: true }).gte("created_at", today + "T00:00:00Z"),
      // Total article views - use RPC aggregation
      svc.rpc("get_total_views"),
    ]);

    const todayUsage = todayUsageRes.data || { request_count: 0, cached_count: 0 };
    const totalUsage = totalUsageRes.data || { request_count: 0, cached_count: 0 };
    // request_count in api_usage actually stores credits consumed (3 per request)
    const CREDIT_PER_REQUEST = 3;
    const todayCreditsConsumed = Number(todayUsage.request_count || 0);
    const totalCreditsConsumed = Number(totalUsage.request_count || 0);
    const todayApiRequests = Math.round(todayCreditsConsumed / CREDIT_PER_REQUEST);
    const totalApiRequests = Math.round(totalCreditsConsumed / CREDIT_PER_REQUEST);
    const todayCached = todayUsage.cached_count || 0;
    const totalCached = totalUsage.cached_count || 0;
    const todayAnonRequests = todayAnonRes.data || 0;
    const totalAnonRequests = totalAnonRes.data || 0;
    const totalViews = totalViewsRes.data || 0;

    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          total_users: profilesRes.count || 0,
          total_articles: articlesRes.count || 0,
          active_api_keys: apiKeysRes.count || 0,
          pro_users: proKeysRes.count || 0,
          today_api_requests: todayApiRequests,
          today_credits_consumed: todayCreditsConsumed,
          today_anon_requests: todayAnonRequests,
          today_all_requests: todayApiRequests + todayAnonRequests,
          today_cached: todayCached,
          today_active_users: todayCreditsRes.count || 0,
          today_new_articles: todayArticlesRes.count || 0,
          total_api_requests: totalApiRequests,
          total_credits_consumed: totalCreditsConsumed,
          total_anon_requests: totalAnonRequests,
          total_all_requests: totalApiRequests + totalAnonRequests,
          total_cached: totalCached,
          total_views: totalViews,
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
