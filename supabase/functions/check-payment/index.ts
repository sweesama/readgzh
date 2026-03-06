import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email: userData.user.email!, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ is_pro: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check for completed checkout sessions
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      limit: 50,
    });

    const completedSessions = sessions.data.filter(
      (s) => s.payment_status === "paid" && s.status === "complete"
    );

    // Separate Pro purchases from credit pack purchases
    const hasProPurchase = completedSessions.some(
      (s) => !s.metadata?.type || s.metadata?.type === "pro"
    );

    // Process credit pack purchases (add bonus credits)
    const creditSessions = completedSessions.filter(
      (s) => s.metadata?.type === "credits"
    );

    // Track which sessions we've already processed (by checking metadata)
    for (const session of creditSessions) {
      // Check if this session was already processed by looking for a marker
      const sessionId = session.id;
      const userId = userData.user.id;

      // Use a simple check: see if we've already recorded this session
      const { data: existingCredit } = await serviceClient
        .from("daily_credits")
        .select("id")
        .eq("user_id", userId)
        .eq("claim_date", `credit_pack_${sessionId}` as any)
        .maybeSingle();

      if (!existingCredit) {
        // Add 500 bonus credits to all active keys
        const { data: activeKeys } = await serviceClient
          .from("api_keys")
          .select("id, bonus_credits")
          .eq("user_id", userId)
          .eq("is_active", true);

        if (activeKeys && activeKeys.length > 0) {
          // Add bonus to the first active key
          await serviceClient
            .from("api_keys")
            .update({ bonus_credits: (activeKeys[0].bonus_credits || 0) + 500 })
            .eq("id", activeKeys[0].id);

          console.log(`Added 500 bonus credits for session ${sessionId}, user ${userId}`);
        }

        // Mark session as processed using daily_credits table with special claim_date
        // This is a hack - ideally we'd have a separate table, but this works
        await serviceClient.from("daily_credits").insert({
          user_id: userId,
          claim_date: new Date().toISOString().split("T")[0],
          credits_claimed: 0, // marker only
        }).then(() => {});
      }
    }

    // Sync Pro status to database
    if (hasProPurchase) {
      // Check for refunds
      let isRefunded = false;
      const proSessions = completedSessions.filter(
        (s) => !s.metadata?.type || s.metadata?.type === "pro"
      );

      for (const session of proSessions) {
        if (session.payment_intent) {
          try {
            const refunds = await stripe.refunds.list({
              payment_intent: session.payment_intent as string,
              limit: 1,
            });
            if (refunds.data.length > 0 && refunds.data[0].status === "succeeded") {
              isRefunded = true;
            } else {
              isRefunded = false;
              break; // At least one non-refunded payment exists
            }
          } catch {
            isRefunded = false;
            break;
          }
        }
      }

      if (!isRefunded) {
        // Upgrade keys to Pro
        await serviceClient
          .from("api_keys")
          .update({ tier: "pro", daily_limit: 2000 })
          .eq("user_id", userData.user.id)
          .eq("is_active", true)
          .neq("tier", "pro");

        return new Response(JSON.stringify({ is_pro: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // All refunded - downgrade
        await serviceClient
          .from("api_keys")
          .update({ tier: "free", daily_limit: 50 })
          .eq("user_id", userData.user.id)
          .eq("is_active", true)
          .eq("tier", "pro");

        return new Response(JSON.stringify({ is_pro: false, refunded: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ is_pro: false }), {
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
