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

    // Check for completed checkout sessions (one-time payment)
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      limit: 10,
    });

    const hasPaid = sessions.data.some(
      (s) => s.payment_status === "paid" && s.status === "complete"
    );

    // ===== CRITICAL: Sync Pro status to database =====
    // If user has paid, upgrade all their active API keys to Pro tier with 2000 daily limit
    if (hasPaid) {
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error: updateError } = await serviceClient
        .from("api_keys")
        .update({ tier: "pro", daily_limit: 2000 })
        .eq("user_id", userData.user.id)
        .eq("is_active", true)
        .neq("tier", "pro"); // Only update if not already pro

      if (updateError) {
        console.error("Failed to sync Pro status to API keys:", updateError);
      } else {
        console.log("Pro status synced to API keys for user:", userData.user.id);
      }

      // Auto-claim credits for Pro users (so they don't need to manually claim)
      const today = new Date().toISOString().split("T")[0];
      const { data: existingClaim } = await serviceClient
        .from("daily_credits")
        .select("id")
        .eq("user_id", userData.user.id)
        .eq("claim_date", today)
        .maybeSingle();

      if (!existingClaim) {
        await serviceClient.from("daily_credits").insert({
          user_id: userData.user.id,
          claim_date: today,
          credits_claimed: 2000,
        });
        console.log("Auto-claimed 2000 credits for Pro user:", userData.user.id);
      }
    }

    // Check for refunds — if ALL payments are refunded, downgrade back to free
    if (hasPaid) {
      const paidSessions = sessions.data.filter(
        (s) => s.payment_status === "paid" && s.status === "complete"
      );
      
      let allRefunded = true;
      for (const session of paidSessions) {
        if (session.payment_intent) {
          const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
          // Check if fully refunded
          if (pi.status !== "canceled" && pi.amount_received > (pi.amount_received - (pi.amount || 0))) {
            // Check refunds
            const refunds = await stripe.refunds.list({ payment_intent: pi.id, limit: 1 });
            if (refunds.data.length === 0 || refunds.data[0].status !== "succeeded") {
              allRefunded = false;
              break;
            }
          } else {
            allRefunded = false;
            break;
          }
        }
      }

      if (allRefunded && paidSessions.length > 0) {
        // Downgrade: all payments refunded
        const serviceClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await serviceClient
          .from("api_keys")
          .update({ tier: "free", daily_limit: 50 })
          .eq("user_id", userData.user.id)
          .eq("is_active", true)
          .eq("tier", "pro");

        console.log("User refunded, downgraded to free:", userData.user.id);
        return new Response(JSON.stringify({ is_pro: false, refunded: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ is_pro: hasPaid }), {
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
