import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: any) => {
  console.log(`[check-payment] ${step}`, details ? JSON.stringify(details) : "");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
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
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const userEmail = userData.user.email!;
    log("User authenticated", { userId, email: userEmail });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find Stripe customer
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId: string | null = null;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      log("Found customer", { customerId });
    }

    if (!customerId) {
      log("No Stripe customer found");
      return new Response(JSON.stringify({ is_pro: false, subscription: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== 1. Check active subscriptions (new model) =====
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 5,
    });

    let hasActiveSubscription = false;
    let subscriptionEnd: string | null = null;
    let subscriptionInterval: string | null = null;
    let subscriptionStatus: string | null = null;

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      hasActiveSubscription = true;
      subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
      subscriptionInterval = sub.items.data[0]?.price?.recurring?.interval || null;
      subscriptionStatus = sub.status;
      log("Active subscription found", { id: sub.id, interval: subscriptionInterval, end: subscriptionEnd });

      // Sync Pro status
      await serviceClient
        .from("api_keys")
        .update({ tier: "pro", daily_limit: 2000 })
        .eq("user_id", userId)
        .eq("is_active", true)
        .neq("tier", "pro");

      // Also check for canceled-at-period-end subscriptions
    }

    // Also check subscriptions that are active but set to cancel
    const cancelingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 5,
    });
    const cancelingSub = cancelingSubscriptions.data.find(
      s => s.status === "active" && s.cancel_at_period_end
    );
    if (cancelingSub) {
      subscriptionStatus = "canceling";
      subscriptionEnd = new Date(cancelingSub.current_period_end * 1000).toISOString();
    }

    // ===== 2. Check legacy one-time payments =====
    let hasLegacyPro = false;
    if (!hasActiveSubscription) {
      const sessions = await stripe.checkout.sessions.list({
        customer: customerId,
        limit: 50,
      });
      const completedSessions = sessions.data.filter(
        (s) => s.payment_status === "paid" && s.status === "complete"
      );

      const proSessions = completedSessions.filter(
        (s) => (!s.metadata?.type || s.metadata?.type === "pro") && s.mode === "payment"
      );

      if (proSessions.length > 0) {
        // Check refunds
        let allRefunded = true;
        for (const session of proSessions) {
          if (session.payment_intent) {
            try {
              const refunds = await stripe.refunds.list({
                payment_intent: session.payment_intent as string,
                limit: 1,
              });
              if (refunds.data.length === 0 || refunds.data[0].status !== "succeeded") {
                allRefunded = false;
                break;
              }
            } catch {
              allRefunded = false;
              break;
            }
          }
        }

        if (!allRefunded) {
          hasLegacyPro = true;
          log("Legacy one-time Pro purchase found");
          await serviceClient
            .from("api_keys")
            .update({ tier: "pro", daily_limit: 2000 })
            .eq("user_id", userId)
            .eq("is_active", true)
            .neq("tier", "pro");
        }
      }

      // Process credit packs
      const creditSessions = completedSessions.filter(
        (s) => s.metadata?.type === "credits"
      );
      for (const session of creditSessions) {
        const sessionId = session.id;
        const { data: existingCredit } = await serviceClient
          .from("daily_credits")
          .select("id")
          .eq("user_id", userId)
          .eq("claim_date", `credit_pack_${sessionId}` as any)
          .maybeSingle();

        if (!existingCredit) {
          const { data: activeKeys } = await serviceClient
            .from("api_keys")
            .select("id, bonus_credits")
            .eq("user_id", userId)
            .eq("is_active", true);

          if (activeKeys && activeKeys.length > 0) {
            await serviceClient
              .from("api_keys")
              .update({ bonus_credits: (activeKeys[0].bonus_credits || 0) + 500 })
              .eq("id", activeKeys[0].id);
            log("Added 500 bonus credits", { sessionId });
          }

          await serviceClient.from("daily_credits").insert({
            user_id: userId,
            claim_date: new Date().toISOString().split("T")[0],
            credits_claimed: 0,
          }).then(() => {});
        }
      }

      // If no subscription AND no legacy pro, downgrade
      if (!hasLegacyPro) {
        await serviceClient
          .from("api_keys")
          .update({ tier: "free", daily_limit: 50 })
          .eq("user_id", userId)
          .eq("is_active", true)
          .eq("tier", "pro");
      }
    }

    const isPro = hasActiveSubscription || hasLegacyPro;

    return new Response(JSON.stringify({
      is_pro: isPro,
      subscription: hasActiveSubscription ? {
        status: subscriptionStatus,
        interval: subscriptionInterval,
        current_period_end: subscriptionEnd,
      } : null,
      legacy: hasLegacyPro,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Check payment error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
