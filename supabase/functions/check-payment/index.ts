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

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId: string | null = null;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      log("Found customer", { customerId });
    } else {
      log("No Stripe customer found, trying to find by payment intent metadata");
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let completedSessions: Stripe.Checkout.Session[] = [];

    if (customerId) {
      // Standard path: find sessions by customer
      const sessions = await stripe.checkout.sessions.list({
        customer: customerId,
        limit: 50,
      });
      completedSessions = sessions.data.filter(
        (s) => s.payment_status === "paid" && s.status === "complete"
      );
      log("Found sessions by customer", { count: completedSessions.length });
    }

    // Fallback: if no sessions found, search by payment intents with metadata
    if (completedSessions.length === 0) {
      log("Trying fallback: search all recent checkout sessions");
      // List recent checkout sessions and filter by email
      const allSessions = await stripe.checkout.sessions.list({ limit: 100 });
      completedSessions = allSessions.data.filter(
        (s) =>
          s.payment_status === "paid" &&
          s.status === "complete" &&
          (s.customer_email === userEmail ||
            s.customer_details?.email === userEmail ||
            s.metadata?.user_id === userId)
      );
      log("Fallback found sessions", { count: completedSessions.length });

      // If we found sessions but no customer, create the customer now for future lookups
      if (completedSessions.length > 0 && !customerId) {
        const newCustomer = await stripe.customers.create({
          email: userEmail,
          metadata: { supabase_user_id: userId },
        });
        customerId = newCustomer.id;
        log("Created customer for future lookups", { customerId });

        // Update the payment intents to associate with this customer
        for (const session of completedSessions) {
          if (session.payment_intent) {
            try {
              await stripe.paymentIntents.update(session.payment_intent as string, {
                customer: customerId,
              });
            } catch (e) {
              // Ignore errors on associating old PIs
            }
          }
        }
      }
    }

    if (completedSessions.length === 0) {
      log("No completed sessions found");
      return new Response(JSON.stringify({ is_pro: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Separate Pro purchases from credit pack purchases
    const hasProPurchase = completedSessions.some(
      (s) => !s.metadata?.type || s.metadata?.type === "pro"
    );
    log("Has Pro purchase", { hasProPurchase });

    // Process credit pack purchases
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

    // Sync Pro status to database
    if (hasProPurchase) {
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
              break;
            }
          } catch {
            isRefunded = false;
            break;
          }
        }
      }

      if (!isRefunded) {
        log("Upgrading user to Pro");
        await serviceClient
          .from("api_keys")
          .update({ tier: "pro", daily_limit: 2000 })
          .eq("user_id", userId)
          .eq("is_active", true)
          .neq("tier", "pro");

        return new Response(JSON.stringify({ is_pro: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        log("All refunded, downgrading");
        await serviceClient
          .from("api_keys")
          .update({ tier: "free", daily_limit: 50 })
          .eq("user_id", userId)
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
